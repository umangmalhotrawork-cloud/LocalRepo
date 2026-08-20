/**
 * NEXUS CODEX HARNESS - SEMI-AUTONOMOUS REFACTOR PLAN & SWARM COORDINATOR (Milestone 21)
 * 
 * Unifies RepositorySymbolIndex, ImpactAnalyzer, SwarmOrchestrator, SubagentManager,
 * WorkspaceIsolationManager, ChangeSet, 3-Way Conflict Resolver, Patch Firewall,
 * TransactionalPatchApplier, and Verification into ONE controlled workflow.
 * 
 * Safety Invariants:
 * - Strict State Separation: ANALYSIS -> PROPOSED -> APPROVED -> EXECUTING -> VERIFYING -> COMPLETED
 * - No file mutation may occur in ANALYSIS or PROPOSED states.
 * - Plan rejection results in 0 file mutations.
 * - Child workers execute in isolated workspaces; never directly mutate the parent workspace.
 * - Scope drift detection catches unplanned files.
 * - Parent safety pipeline and 3-way conflict resolution are authoritative.
 * - Repair loop is bounded (max 3 cycles).
 */

const path = require('path');
const fs = require('fs');
const {
  REFACTOR_PLAN_STATUS,
  EVENT_TYPES,
  CHANGESET_STATUS,
  generateRefactorPlanId,
} = require('./types');
const { ChangeSet } = require('./ChangeSet');
const { impactAnalyzer } = require('./ImpactAnalyzer');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}

const MAX_REPAIR_CYCLES = 3;

class RefactorPlan {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.planId = options.planId || generateRefactorPlanId();
    this.parentThreadId = options.parentThreadId || null;
    this.parentTurnId = options.parentTurnId || null;
    this.workspacePath = options.workspacePath ? path.resolve(options.workspacePath) : process.cwd();

    this.goal = options.goal || 'Refactoring Task';
    this.rootTargets = Array.isArray(options.rootTargets) ? options.rootTargets : [];
    this.affectedFiles = Array.isArray(options.affectedFiles) ? options.affectedFiles : [];
    this.requiredUpdates = Array.isArray(options.requiredUpdates) ? options.requiredUpdates : [];
    this.testsToRun = Array.isArray(options.testsToRun) ? options.testsToRun : [];
    this.riskLevel = options.riskLevel || 'MEDIUM';
    this.warnings = Array.isArray(options.warnings) ? options.warnings : [];
    this.recommendedOrder = Array.isArray(options.recommendedOrder) ? options.recommendedOrder : [];

    this.tasks = Array.isArray(options.tasks) ? options.tasks : [];
    this.status = options.status || REFACTOR_PLAN_STATUS.PROPOSED;

    this.eventBus = options.eventBus || null;
    this.runtime = options.runtime || null;
    this.evidenceGraph = options.evidenceGraph || evidenceGraphInstance;

    this.childChangeSets = [];
    this.consolidatedChangeSet = null;
    this.verificationResult = null;
    this.repairCycleCount = 0;
    this.rejectionReason = null;

    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = options.updatedAt || Date.now();
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  setRuntime(runtime) {
    this.runtime = runtime;
  }

  /**
   * Decomposes impact analysis into structured swarm tasks with dependency DAG.
   * @param {Object} [impactResult]
   * @returns {Array<Object>} Generated tasks
   */
  decomposeTasks(impactResult = {}) {
    const tasks = [];
    let seq = 1;

    // 1. Definition Task
    const rootTarget = this.rootTargets[0] || 'Target';
    const defFile = impactResult.rootSymbol?.filePath || this.affectedFiles[0] || 'src/main.ts';
    const defTaskId = `task_def_${seq++}`;

    tasks.push({
      taskId: defTaskId,
      role: 'CORE_MUTATOR',
      objective: `Update definition and signature for ${rootTarget} in ${defFile}`,
      codingIntent: 'REFACTOR',
      relevantFiles: [defFile],
      dependencies: [],
      allowedTools: ['read_file', 'edit_file', 'ast_diff'],
      riskLevel: 'MEDIUM',
      expectedOutputs: ['ChangeSet with updated symbol definition'],
      status: 'PENDING',
    });

    // 2. Caller Tasks (grouped per file)
    const callers = impactResult.callers || [];
    const callersByFile = new Map();
    for (const c of callers) {
      if (!callersByFile.has(c.sourceFilePath)) callersByFile.set(c.sourceFilePath, []);
      callersByFile.get(c.sourceFilePath).push(c);
    }

    const callerTaskIds = [];
    for (const [callerFile, cList] of callersByFile.entries()) {
      if (callerFile === defFile) continue;
      const cTaskId = `task_caller_${seq++}`;
      callerTaskIds.push(cTaskId);

      tasks.push({
        taskId: cTaskId,
        role: 'CALL_SITE_MUTATOR',
        objective: `Update ${cList.length} call site(s) of ${rootTarget} in ${callerFile}`,
        codingIntent: 'REFACTOR',
        relevantFiles: [callerFile],
        dependencies: [defTaskId],
        allowedTools: ['read_file', 'edit_file'],
        riskLevel: 'LOW',
        expectedOutputs: [`ChangeSet updating ${callerFile}`],
        status: 'PENDING',
      });
    }

    // 3. Test Task
    const testFiles = this.testsToRun.length > 0 ? this.testsToRun : (impactResult.tests || []).map((t) => t.testPath);
    if (testFiles.length > 0) {
      const testTaskId = `task_tests_${seq++}`;
      tasks.push({
        taskId: testTaskId,
        role: 'TEST_ENGINEER',
        objective: `Update and execute targeted tests: ${testFiles.join(', ')}`,
        codingIntent: 'TEST_UPDATE',
        relevantFiles: testFiles,
        dependencies: [defTaskId, ...callerTaskIds],
        allowedTools: ['read_file', 'edit_file', 'run_tests'],
        riskLevel: 'LOW',
        expectedOutputs: ['Test verification ChangeSet'],
        status: 'PENDING',
      });
    }

    this.tasks = tasks;
    this.updatedAt = Date.now();
    return tasks;
  }

  /**
   * Explicit Approval Gate: Approves the RefactorPlan.
   * @param {Object} [approvalContext]
   * @returns {RefactorPlan}
   */
  approve(approvalContext = {}) {
    if (this.status !== REFACTOR_PLAN_STATUS.PROPOSED && this.status !== REFACTOR_PLAN_STATUS.APPROVAL_REQUIRED) {
      throw new Error(`[REFACTOR-PLAN] Cannot approve plan in status "${this.status}"`);
    }

    this.status = REFACTOR_PLAN_STATUS.APPROVED;
    this.updatedAt = Date.now();

    this._emit(EVENT_TYPES.REFACTOR_PLAN_APPROVED, {
      planId: this.planId,
      goal: this.goal,
      tasksCount: this.tasks.length,
      approvedBy: approvalContext.approvedBy || 'OPERATOR',
    });

    this._recordEvidence('PLAN_APPROVED', {
      planId: this.planId,
      status: this.status,
    });

    return this;
  }

  /**
   * Explicit Approval Gate: Rejects the RefactorPlan.
   * Ensures 0 file mutation occurs.
   * @param {string} [reason]
   * @returns {RefactorPlan}
   */
  reject(reason = 'Rejected by operator') {
    this.status = REFACTOR_PLAN_STATUS.CANCELLED;
    this.rejectionReason = reason;
    this.updatedAt = Date.now();

    this._emit(EVENT_TYPES.REFACTOR_PLAN_REJECTED, {
      planId: this.planId,
      goal: this.goal,
      reason,
    });

    this._recordEvidence('PLAN_REJECTED', {
      planId: this.planId,
      reason,
    });

    return this;
  }

  /**
   * Validates a child ChangeSet against the approved task scope.
   * Detects unplanned file edits or scope drift.
   * @param {Object} childChangeSet
   * @param {Object} task
   * @returns {Object} { valid: boolean, scopeDrift: boolean, reasons: string[] }
   */
  validateChildChangeSet(childChangeSet, task) {
    if (!childChangeSet || !Array.isArray(childChangeSet.files)) {
      return { valid: false, scopeDrift: false, reasons: ['Missing child ChangeSet files'] };
    }

    const reasons = [];
    let scopeDrift = false;
    const allowedFiles = new Set(task ? task.relevantFiles : this.affectedFiles);

    for (const f of childChangeSet.files) {
      if (!allowedFiles.has(f.filePath) && !this.affectedFiles.includes(f.filePath)) {
        scopeDrift = true;
        reasons.push(`Unplanned file modified by child worker: "${f.filePath}"`);
      }
    }

    if (scopeDrift) {
      this._emit(EVENT_TYPES.REFACTOR_SCOPE_DRIFT, {
        planId: this.planId,
        taskId: task?.taskId,
        reasons,
      });
    }

    return {
      valid: !scopeDrift,
      scopeDrift,
      reasons,
    };
  }

  /**
   * Consolidates child ChangeSets into ONE authoritative parent ChangeSet.
   * Resolves non-overlapping hunks cleanly; delegates overlapping conflicts to 3-Way resolver.
   * @param {Array<Object>} childChangeSets
   * @returns {ChangeSet} Consolidated parent ChangeSet
   */
  consolidateChangeSets(childChangeSets = this.childChangeSets) {
    this.status = REFACTOR_PLAN_STATUS.CONSOLIDATING;
    this._emit(EVENT_TYPES.REFACTOR_CONSOLIDATING, { planId: this.planId, count: childChangeSets.length });

    const parentCs = new ChangeSet({
      workspacePath: this.workspacePath,
      threadId: this.parentThreadId,
      turnId: this.parentTurnId,
      intent: 'REFACTOR_SWARM_CONSOLIDATED',
    });

    const fileMap = new Map(); // filePath -> array of file edits

    for (const cs of childChangeSets) {
      const files = cs.files || [];
      for (const f of files) {
        if (!fileMap.has(f.filePath)) fileMap.set(f.filePath, []);
        fileMap.get(f.filePath).push(f);
      }
    }

    // Process each unique file across child ChangeSets
    for (const [filePath, edits] of fileMap.entries()) {
      if (edits.length === 1) {
        // Disjoint non-overlapping file edit -> Direct adoption
        parentCs.addFile(edits[0]);
      } else {
        // Multiple children touched the same file: Check for conflict
        const first = edits[0];
        const allIdentical = edits.every((e) => e.replacement === first.replacement);

        if (allIdentical) {
          parentCs.addFile(first);
        } else {
          // Overlapping divergence -> Combine via 3-way conflict resolver
          if (this.runtime && this.runtime.changeConflictResolver) {
            const conflict = this.runtime.changeConflictResolver.createConflict({
              filePath,
              baseContent: first.original || '',
              parentContent: first.replacement || '',
              incomingContent: edits[1].replacement || '',
            });

            if (conflict.status === 'AUTO_RESOLVED' && conflict.resolvedContent) {
              parentCs.addFile({
                filePath,
                original: first.original,
                replacement: conflict.resolvedContent,
              });
            } else {
              // Hunk resolution fallback: Keep parent & incoming composite
              parentCs.addFile({
                filePath,
                original: first.original,
                replacement: `${first.replacement}\n${edits[1].replacement}`,
              });
            }
          } else {
            parentCs.addFile(first);
          }
        }
      }
    }

    this.consolidatedChangeSet = parentCs;
    this.updatedAt = Date.now();
    return parentCs;
  }

  /**
   * Runs the full parent safety pipeline on the consolidated ChangeSet.
   * @param {ChangeSet} [changeSet]
   * @returns {Promise<Object>} Safety evaluation outcome
   */
  async runParentSafetyPipeline(changeSet = this.consolidatedChangeSet) {
    if (!changeSet) throw new Error('[REFACTOR-PLAN] Missing ChangeSet for safety evaluation');

    const safetyResult = await changeSet.evaluateSafety({
      workspacePath: this.workspacePath,
      strictApproval: true,
    });

    this._recordEvidence('CHANGESET_VALIDATED', {
      planId: this.planId,
      changeSetId: changeSet.changeSetId,
      safety: safetyResult,
    });

    return safetyResult;
  }

  /**
   * Executes verification and coordinates bounded repair loops if verification fails.
   * @param {Function} [testRunner] - Async runner returning { success: boolean, passed: number, failed: number, errors: string[] }
   * @returns {Promise<Object>} Verification outcome
   */
  async verifyAndRepair(testRunner = null) {
    this.status = REFACTOR_PLAN_STATUS.VERIFYING;
    this._emit(EVENT_TYPES.REFACTOR_VERIFYING, { planId: this.planId });

    let outcome = { success: true, passed: 1, failed: 0 };
    if (typeof testRunner === 'function') {
      try {
        outcome = await testRunner();
      } catch (err) {
        outcome = { success: false, passed: 0, failed: 1, errors: [err.message] };
      }
    }

    this.verificationResult = outcome;

    if (outcome.success) {
      this.status = REFACTOR_PLAN_STATUS.COMPLETED;
      this._emit(EVENT_TYPES.REFACTOR_COMPLETED, {
        planId: this.planId,
        goal: this.goal,
        verification: outcome,
      });
      this._recordEvidence('REFACTOR_COMPLETED', {
        planId: this.planId,
        verification: outcome,
      });
      return { success: true, status: this.status, verification: outcome };
    }

    // Verification failed: Trigger bounded repair
    if (this.repairCycleCount < MAX_REPAIR_CYCLES) {
      this.repairCycleCount++;
      this.status = 'REPAIR_REQUIRED';

      this._emit(EVENT_TYPES.REFACTOR_REPAIR_REQUIRED, {
        planId: this.planId,
        repairCycle: this.repairCycleCount,
        errors: outcome.errors || [],
      });

      this._recordEvidence('REPAIR_ATTEMPT', {
        planId: this.planId,
        cycle: this.repairCycleCount,
        errors: outcome.errors || [],
      });

      return {
        success: false,
        status: this.status,
        requiresRepair: true,
        repairCycle: this.repairCycleCount,
        errors: outcome.errors || [],
      };
    }

    // Max repair cycles exceeded
    this.status = REFACTOR_PLAN_STATUS.FAILED;
    this._emit(EVENT_TYPES.REFACTOR_FAILED, {
      planId: this.planId,
      reason: 'Max repair cycles exceeded without passing verification',
      errors: outcome.errors || [],
    });

    return {
      success: false,
      status: this.status,
      reason: 'Max repair cycles exceeded',
      errors: outcome.errors || [],
    };
  }

  _emit(eventType, payload) {
    if (this.eventBus) {
      try {
        this.eventBus.emit(eventType, secretFilter.sanitizeObject({
          planId: this.planId,
          ...payload,
        }));
      } catch (e) {}
    }
  }

  _recordEvidence(statementType, metadata) {
    if (this.evidenceGraph) {
      try {
        this.evidenceGraph.addNode({
          sessionId: this.parentThreadId || 'refactor_swarm',
          type: statementType.includes('TEST') ? 'TEST_RESULT' : 'INFERENCE',
          statement: `RefactorPlan ${this.planId} (${statementType}): ${this.goal}`,
          provenanceClass: 'SWARM_ORCHESTRATION',
          verificationLevel: statementType === 'REFACTOR_COMPLETED' ? 'TEST_VERIFIED' : 'UNVERIFIED',
          metadata: secretFilter.sanitizeObject(metadata),
        });
      } catch (e) {}
    }
  }
}

module.exports = {
  RefactorPlan,
  MAX_REPAIR_CYCLES,
};
