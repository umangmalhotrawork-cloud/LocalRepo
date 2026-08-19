/**
 * TEST EXECUTOR
 * 
 * Executes test commands in isolated child processes scoped strictly to the workspace.
 * Captures stdout/stderr, enforces configurable timeouts, handles cancellation,
 * parses structured failures, and redacts secrets.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { testRunnerDetector } = require('./TestRunnerDetector');
const { testResultParser } = require('./TestResultParser');
const secretFilter = require('../../security/secretFilter');
const { evidenceGraph, PROVENANCE_CLASSES, NODE_TYPES } = require('../evidence/EvidenceGraph');

const MAX_OUTPUT_BYTES = 500 * 1024; // 500 KB output limit to prevent unbounded memory growth
const DEFAULT_TIMEOUT_MS = 300 * 1000; // 5 minutes default timeout

class TestExecutor {
  constructor() {
    this.activeProcesses = new Map();
  }

  /**
   * Runs tests for a workspace.
   * @param {object} payload - { workspacePath, runner, command, timeoutMs, target }
   * @returns {Promise<object>} Structured test run execution result.
   */
  async runTests(payload = {}) {
    const {
      workspacePath = process.cwd(),
      runner: requestedRunner,
      command: requestedCommand,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      target,
    } = payload;

    const normWorkspace = path.resolve(workspacePath);
    if (!fs.existsSync(normWorkspace)) {
      return {
        runId: `run_${Date.now()}`,
        status: 'ERROR',
        error: `Workspace path does not exist: ${workspacePath}`,
        exitCode: 1,
        durationMs: 0,
        stdout: '',
        stderr: `Workspace path does not exist: ${workspacePath}`,
        workspacePath: normWorkspace,
      };
    }

    // Auto-detect runner if neither command nor runner is explicitly passed
    let runner = requestedRunner;
    let command = requestedCommand;

    if (!command) {
      const detection = testRunnerDetector.detect(normWorkspace);
      if (!detection.detected || !detection.command) {
        return {
          runId: `run_${Date.now()}`,
          status: 'NOT_CONFIGURED',
          error: 'No runnable test runner detected in workspace',
          exitCode: 0,
          durationMs: 0,
          stdout: '',
          stderr: 'No test configuration or supported test runner detected in repository.',
          workspacePath: normWorkspace,
          failures: [],
        };
      }
      runner = runner || detection.preferredRunner;
      command = detection.command;
    } else {
      runner = runner || 'custom';
    }

    // Append target file if provided and valid
    let finalCommand = command;
    if (target && typeof target === 'string') {
      const cleanTarget = path.normalize(target).replace(/^[/\\]+/, '');
      const absTarget = path.resolve(normWorkspace, cleanTarget);
      if (absTarget.startsWith(normWorkspace + path.sep)) {
        finalCommand = `${command} ${cleanTarget}`;
      }
    }

    const runId = payload.runId || `test_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let outputTruncated = false;
      let isTimedOut = false;
      let isCancelled = false;

      // Spawn shell command inside workspace directory
      const isWin = process.platform === 'win32';
      const shellCmd = isWin ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWin ? ['/d', '/s', '/c', finalCommand] : ['-c', finalCommand];

      const child = spawn(shellCmd, shellArgs, {
        cwd: normWorkspace,
        env: {
          ...process.env,
          CI: 'true',
          FORCE_COLOR: '0',
          PYTHONUNBUFFERED: '1',
        },
      });

      this.activeProcesses.set(runId, {
        process: child,
        cancel: () => {
          isCancelled = true;
          try {
            child.kill('SIGTERM');
            setTimeout(() => {
              try { child.kill('SIGKILL'); } catch (e) {}
            }, 1000);
          } catch (e) {}
        },
      });

      const timeoutTimer = setTimeout(() => {
        isTimedOut = true;
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (e) {}
          }, 1000);
        } catch (e) {}
      }, Math.min(timeoutMs, 10 * 60 * 1000)); // Cap at max 10 mins

      child.stdout?.on('data', (data) => {
        const text = data.toString('utf-8');
        if (stdoutBuffer.length < MAX_OUTPUT_BYTES) {
          stdoutBuffer += text;
        } else {
          outputTruncated = true;
        }
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString('utf-8');
        if (stderrBuffer.length < MAX_OUTPUT_BYTES) {
          stderrBuffer += text;
        } else {
          outputTruncated = true;
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        this.activeProcesses.delete(runId);
        const durationMs = Date.now() - startTime;

        resolve({
          runId,
          status: 'ERROR',
          exitCode: 1,
          durationMs,
          stdout: secretFilter.sanitizeString(stdoutBuffer),
          stderr: secretFilter.sanitizeString(`Failed to spawn test process: ${err.message}`),
          command: finalCommand,
          runner,
          workspacePath: normWorkspace,
          timedOut: false,
          cancelled: false,
          failures: [{ testFile: 'system', testName: 'process_error', message: err.message }],
        });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        this.activeProcesses.delete(runId);
        const durationMs = Date.now() - startTime;

        let status = 'PASSED';
        if (isTimedOut) {
          status = 'TIMEOUT';
        } else if (isCancelled) {
          status = 'CANCELLED';
        } else if (code !== 0) {
          status = 'FAILED';
        }

        const safeStdout = secretFilter.sanitizeString(stdoutBuffer);
        const safeStderr = secretFilter.sanitizeString(stderrBuffer);

        const parseRes = testResultParser.parse(runner, safeStdout, safeStderr, code);

        try {
          evidenceGraph.addNode({
            sessionId: payload.sessionId || 'default_session',
            type: NODE_TYPES.TEST_RESULT,
            provenance: PROVENANCE_CLASSES.TEST_VERIFIED,
            verified: status === 'PASSED',
            statement: `Test execution (${runner}): ${status} (${parseRes.summary?.passed || 0} passed, ${parseRes.summary?.failed || 0} failed)`,
            workspacePath: normWorkspace,
            metadata: { runId, runner, command: finalCommand, status, exitCode: code, summary: parseRes.summary },
          });
        } catch (e) {}

        resolve({
          runId,
          status,
          exitCode: code !== null ? code : (isTimedOut ? 124 : 1),
          durationMs,
          stdout: safeStdout,
          stderr: safeStderr,
          command: finalCommand,
          runner,
          workspacePath: normWorkspace,
          timedOut: isTimedOut,
          cancelled: isCancelled,
          outputTruncated,
          summary: parseRes.summary,
          failures: parseRes.failures,
          timestamp: Date.now(),
        });
      });
    });
  }

  /**
   * Cancels a running test process by runId.
   * @param {string} runId
   * @returns {boolean} Whether the process was found and cancel signal sent.
   */
  cancel(runId) {
    if (!runId || !this.activeProcesses.has(runId)) {
      return false;
    }
    const item = this.activeProcesses.get(runId);
    if (item && typeof item.cancel === 'function') {
      item.cancel();
      this.activeProcesses.delete(runId);
      return true;
    }
    return false;
  }

  /**
   * Cancels all currently running test child processes to prevent orphaned processes.
   */
  cancelAll() {
    let count = 0;
    for (const runId of Array.from(this.activeProcesses.keys())) {
      if (this.cancel(runId)) {
        count++;
      }
    }
    return count;
  }
}

const testExecutor = new TestExecutor();

module.exports = {
  TestExecutor,
  testExecutor,
  MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
};
