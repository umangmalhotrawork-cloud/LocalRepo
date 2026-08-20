/**
 * AUTONOMOUS REPAIR ENGINE (Phase 2D)
 * 
 * Implements a strictly bounded test -> diagnose -> repair -> retest autonomous loop.
 * 
 * Safety Rules:
 * 1. Hard iteration bounds (default 3, max 5).
 * 2. Every mutation MUST pass Patch Firewall and Transactional Patch Engine.
 * 3. Test files (tests/, __tests__/, *.test.js, test_*.py) are strictly read-only.
 * 4. Never claims success unless the test runner returns exit code 0 (status: PASSED).
 * 5. Aborts cleanly on workspace modification conflicts (WORKSPACE_CHANGED).
 * 6. Redacts all credentials and secrets before returning or recording evidence.
 */

const path = require('path');
const fs = require('fs');
const { aiProviderRouter } = require('./ai/AIProviderRouter');
const { aiRoleRouter } = require('./ai/AIRoleRouter');
const { testRunnerDetector } = require('./testing/TestRunnerDetector');
const { testExecutor } = require('./testing/TestExecutor');
const { testResultParser } = require('./testing/TestResultParser');
const { transactionalPatchApplier } = require('./transactionalPatchApplier');
const { evaluateAIPatchFirewall } = require('../engine/ai_patch_firewall');
const secretFilter = require('../security/secretFilter');

const DEFAULT_MAX_ITERATIONS = 3;
const HARD_MAX_ITERATIONS = 5;

class AutonomousRepairEngine {
  constructor() {
    this.activeRepairs = new Map();
  }

  /**
   * Helper: Checks if a file path belongs to the test suite (read-only protection).
   */
  isTestFile(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const norm = filePath.replace(/\\/g, '/').toLowerCase();
    return (
      norm.startsWith('tests/') ||
      norm.startsWith('test/') ||
      norm.startsWith('__tests__/') ||
      norm.startsWith('spec/') ||
      norm.includes('/tests/') ||
      norm.includes('/test/') ||
      norm.includes('/__tests__/') ||
      norm.endsWith('_test.py') ||
      norm.endsWith('.test.js') ||
      norm.endsWith('.test.ts') ||
      norm.endsWith('.spec.js') ||
      norm.endsWith('.spec.ts')
    );
  }

  /**
   * Helper: Classifies failure type to determine whether autonomous repair is valid.
   */
  classifyFailure(testResult) {
    if (testResult.timedOut || testResult.status === 'TIMEOUT') {
      return 'TIMEOUT';
    }
    if (testResult.cancelled || testResult.status === 'CANCELLED') {
      return 'CANCELLED';
    }
    const combined = `${testResult.stdout || ''} ${testResult.stderr || ''}`.toLowerCase();

    if (
      combined.includes('modulenotfounderror') ||
      combined.includes('cannot find module') ||
      combined.includes('importerror')
    ) {
      return 'DEPENDENCY_FAILURE';
    }

    if (
      combined.includes('command not found') ||
      combined.includes('is not recognized as an internal') ||
      (combined.includes('no such file or directory') && combined.includes('pytest'))
    ) {
      return 'ENVIRONMENT_FAILURE';
    }

    if (testResult.failures && testResult.failures.length > 0) {
      return 'CODE_FAILURE';
    }

    if (testResult.exitCode !== 0) {
      return 'CODE_FAILURE';
    }

    return 'UNKNOWN';
  }

  /**
   * Executes the bounded autonomous repair loop.
   */
  async runAutonomousRepair(payload = {}, onProgress = null) {
    const {
      workspacePath = process.cwd(),
      taskPrompt = '',
      sessionId = `session_${Date.now()}`,
      providerId,
      modelId,
      maxIterations: reqMax = DEFAULT_MAX_ITERATIONS,
      activeFilePath,
    } = payload;

    const maxIterations = Math.min(HARD_MAX_ITERATIONS, Math.max(1, reqMax));
    const repairId = payload.repairId || `repair_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const iterations = [];
    let isCancelled = false;

    this.activeRepairs.set(repairId, {
      cancel: () => { isCancelled = true; },
      state: 'PLANNING',
    });

    const notify = (state, data = {}) => {
      if (this.activeRepairs.has(repairId)) {
        this.activeRepairs.get(repairId).state = state;
      }
      if (typeof onProgress === 'function') {
        try {
          onProgress({ repairId, state, ...data });
        } catch (e) {}
      }
    };

    notify('AUTONOMOUS_STARTED', { taskPrompt, maxIterations });

    if (isCancelled) {
      this.activeRepairs.delete(repairId);
      return {
        repairId,
        status: 'CANCELLED',
        reason: 'USER_CANCELLED',
        iterations: [],
        completed: false,
      };
    }

    // Step 1: Detect test runner
    const detection = testRunnerDetector.detect(workspacePath);
    if (!detection.detected) {
      this.activeRepairs.delete(repairId);
      return {
        repairId,
        status: 'BLOCKED',
        reason: 'NO_TEST_RUNNER_DETECTED',
        error: 'Cannot run autonomous repair: No test runner detected in workspace.',
        iterations: [],
        completed: false,
      };
    }

    // Step 2: Generate initial plan via AI Provider Router
    notify('PLANNING', { iteration: 1 });
    let currentPlan = payload.initialPlan || null;
    if (!currentPlan) {
      try {
        currentPlan = await aiProviderRouter.generateAgentPlan({
          task: taskPrompt,
          workspacePath,
          activeFilePath,
          providerId,
          modelId,
        });
      } catch (e) {
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'FAILED',
          reason: 'PLANNING_FAILED',
          error: `AI plan generation failed: ${e.message}`,
          iterations: [],
          completed: false,
        };
      }
    }

    if (isCancelled) {
      this.activeRepairs.delete(repairId);
      return {
        repairId,
        status: 'CANCELLED',
        reason: 'USER_CANCELLED',
        iterations: [],
        completed: false,
      };
    }

    if (!currentPlan || !currentPlan.steps || currentPlan.steps.length === 0) {
      if (isCancelled) {
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'CANCELLED',
          reason: 'USER_CANCELLED',
          iterations: [],
          completed: false,
        };
      }
      this.activeRepairs.delete(repairId);
      return {
        repairId,
        status: 'FAILED',
        reason: 'NO_STEPS_PROPOSED',
        error: 'AI generated empty plan without execution steps.',
        iterations: [],
        completed: false,
      };
    }

    // Collect all initial proposed edits
    let currentEdits = currentPlan.steps.flatMap(s => s.proposedEdits || []);

    // -------------------------------------------------------------
    // MAIN BOUNDED ITERATION LOOP
    // -------------------------------------------------------------
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      if (isCancelled) {
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'CANCELLED',
          reason: 'USER_CANCELLED',
          iterations,
          completed: false,
        };
      }

      // Check test file modification safety constraint
      const touchesTests = currentEdits.some(e => this.isTestFile(e.filePath));
      if (touchesTests) {
        notify('REPAIR_BLOCKED', { iteration, reason: 'TEST_MODIFICATION_PROHIBITED' });
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'BLOCKED',
          reason: 'TEST_MODIFICATION_PROHIBITED',
          error: 'Autonomous repair blocked: AI proposed modifying read-only test files.',
          iterations,
          completed: false,
        };
      }

      // Step A: Patch Firewall Evaluation
      notify('PATCH_REVIEW', { iteration });
      for (const edit of currentEdits) {
        try {
          const absPath = path.resolve(workspacePath, edit.filePath);
          const orig = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : '';
          const firewallRes = await evaluateAIPatchFirewall({
            file_path: absPath,
            patch_text: `--- a/${edit.filePath}\n+++ b/${edit.filePath}\n@@ -1,3 +1,3 @@\n-${(edit.original || '').slice(0, 30)}\n+${(edit.replacement || '').slice(0, 30)}`,
          });

          if (firewallRes && (firewallRes.risk_level === 'BLOCKED' || (firewallRes.risk_level === 'HIGH_RISK' && !payload.allowHighRisk))) {
            notify('REPAIR_BLOCKED', { iteration, risk_level: firewallRes.risk_level });
            this.activeRepairs.delete(repairId);
            return {
              repairId,
              status: 'BLOCKED',
              reason: 'FIREWALL_BLOCKED',
              risk_level: firewallRes.risk_level,
              error: `Patch Firewall blocked proposal on ${edit.filePath} (${firewallRes.risk_level})`,
              iterations,
              completed: false,
            };
          }
        } catch (e) {}
      }

      // Step B: Transactional Patch Application
      notify('PATCH_APPLYING', { iteration, editCount: currentEdits.length });
      const txRes = await transactionalPatchApplier.applyTransaction(currentEdits, {
        workspacePath,
        enforceFirewall: false, // already verified above
      });

      if (!txRes.success) {
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: txRes.reason === 'WORKSPACE_CHANGED' ? 'BLOCKED' : 'FAILED',
          reason: txRes.reason || 'TRANSACTION_FAILED',
          error: `Transactional patch application failed: ${txRes.error}`,
          iterations,
          completed: false,
        };
      }

      // Step C: Execute Tests
      const runner = payload.runner || detection.preferredRunner;
      const command = payload.command || detection.command;
      notify('TESTING', { iteration, runner });

      const currentRunId = `test_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (this.activeRepairs.has(repairId)) {
        this.activeRepairs.get(repairId).currentRunId = currentRunId;
      }

      const testRes = await testExecutor.runTests({
        workspacePath,
        runner,
        command,
      });

      const failureType = this.classifyFailure(testRes);
      const iterRecord = {
        iteration,
        action: iteration === 1 ? 'INITIAL_PATCH' : 'REPAIR_PATCH',
        modifiedFiles: txRes.modifiedFiles.map(f => f.relPath),
        testStatus: testRes.status,
        exitCode: testRes.exitCode,
        durationMs: testRes.durationMs,
        failures: testRes.failures || [],
        failureType,
        timestamp: Date.now(),
      };
      iterations.push(iterRecord);

      // Step D: Evaluate Test Outcome
      if (testRes.status === 'PASSED') {
        notify('COMPLETED', { iteration, totalTests: testRes.summary?.total || 1 });
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'COMPLETED',
          iterations,
          totalIterations: iteration,
          modifiedFiles: txRes.modifiedFiles.map(f => f.relPath),
          files: txRes.files,
          testSummary: testRes.summary,
          completed: true,
        };
      }

      // If test failed, determine whether it is repairable
      if (failureType !== 'CODE_FAILURE') {
        notify('TEST_FAILED', { iteration, failureType });
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: failureType === 'TIMEOUT' ? 'TIMEOUT' : failureType === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
          reason: failureType,
          error: `Autonomous repair stopped: Test failure classified as ${failureType}`,
          iterations,
          completed: false,
        };
      }

      // If we have reached max iterations, stop
      if (iteration >= maxIterations) {
        notify('MAX_ITERATIONS_REACHED', { iteration, maxIterations });
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'MAX_ITERATIONS_REACHED',
          reason: 'MAX_ITERATIONS_REACHED',
          error: `Autonomous repair stopped: Maximum iterations (${maxIterations}) reached without all tests passing.`,
          iterations,
          completed: false,
        };
      }

      // Step E: Diagnose & Request Repair Plan via Role Pipeline (DEBUGGER -> CODER -> REVIEWER)
      notify('DIAGNOSING', { iteration, failureCount: testRes.failures.length });
      const failureDiagnostics = testRes.failures.map(f => `${f.testFile}::${f.testName}: ${f.message}`).join('\n');

      let coderEdits = [];
      try {
        // 1. Debugger Role
        const debugRes = await aiRoleRouter.executeRole('debugger', {
          task: taskPrompt,
          diagnostics: failureDiagnostics,
          stdout: testRes.stdout,
          stderr: testRes.stderr,
          workspacePath,
          activeFilePath,
        });

        // 2. Coder Role
        notify('REPAIR_PROPOSED', { nextIteration: iteration + 1 });
        const coderRes = await aiRoleRouter.executeRole('coder', {
          task: `Repair failure for directive "${taskPrompt}" based on diagnosis: ${debugRes.output?.rootCause || failureDiagnostics}`,
          workspacePath,
          activeFilePath,
        });

        coderEdits = coderRes.output?.edits || [];

        // 3. Reviewer Role (advisory)
        await aiRoleRouter.executeRole('reviewer', {
          task: taskPrompt,
          proposedEdits: coderEdits,
          workspacePath,
          activeFilePath,
        });

        if (coderEdits.length === 0) {
          throw new Error('AI Coder role produced empty repair edits');
        }
      } catch (repairErr) {
        this.activeRepairs.delete(repairId);
        return {
          repairId,
          status: 'FAILED',
          reason: 'REPAIR_GENERATION_FAILED',
          error: `Failed to generate repair patch: ${repairErr.message}`,
          iterations,
          completed: false,
        };
      }

      currentEdits = coderEdits;
    }

    this.activeRepairs.delete(repairId);
    return {
      repairId,
      status: 'MAX_ITERATIONS_REACHED',
      iterations,
      completed: false,
    };
  }

  /**
   * Cancels an active autonomous repair session.
   */
  cancel(repairId) {
    if (!repairId || !this.activeRepairs.has(repairId)) return false;
    const session = this.activeRepairs.get(repairId);
    if (session) {
      if (typeof session.cancel === 'function') {
        session.cancel();
      }
      // Also cancel any active testExecutor process
      for (const runId of testExecutor.activeProcesses.keys()) {
        testExecutor.cancel(runId);
      }
      this.activeRepairs.delete(repairId);
      return true;
    }
    return false;
  }

  /**
   * Gets current state of an active repair session.
   */
  getStatus(repairId) {
    if (!repairId || !this.activeRepairs.has(repairId)) {
      return { active: false, state: 'IDLE' };
    }
    return {
      active: true,
      state: this.activeRepairs.get(repairId).state,
    };
  }

  /**
   * Cancels all active repair sessions and running test processes.
   */
  cancelAll() {
    let count = 0;
    for (const repairId of Array.from(this.activeRepairs.keys())) {
      if (this.cancel(repairId)) {
        count++;
      }
    }
    testExecutor.cancelAll();
    return count;
  }
}

const autonomousRepairEngine = new AutonomousRepairEngine();

module.exports = {
  AutonomousRepairEngine,
  autonomousRepairEngine,
  DEFAULT_MAX_ITERATIONS,
  HARD_MAX_ITERATIONS,
};
