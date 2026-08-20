/**
 * NEXUS CODEX HARNESS TOOL - RUN TESTS
 * Executes test suites safely using TestRunnerDetector and TestExecutor.
 */

const path = require('path');
const { testExecutor } = require('../../testing/TestExecutor');
const secretFilter = require('../../../security/secretFilter');

const RunTestsTool = {
  name: 'run_tests',
  description: 'Executes unit tests or test suites in the workspace and returns structured outcomes.',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'Optional file or folder path target to scope test execution (e.g. "tests/test_cart.py")',
      },
      command: {
        type: 'string',
        description: 'Optional custom test runner command override (e.g. "pytest -v")',
      },
    },
  },
  requiresApproval: false,

  async execute(args = {}, context = {}) {
    const workspaceRoot = path.resolve(context.workspacePath || process.cwd());

    try {
      const runResult = await testExecutor.runTests({
        workspacePath: workspaceRoot,
        target: args.scope || undefined,
        command: args.command || undefined,
        timeoutMs: 60000, // 60s timeout for harness tool runs
      });

      if (!runResult) {
        return {
          success: false,
          error: 'Test executor returned empty result',
        };
      }

      return {
        success: runResult.status !== 'ERROR',
        status: runResult.status,
        exitCode: runResult.exitCode,
        durationMs: runResult.durationMs,
        command: runResult.command,
        runner: runResult.runner,
        summary: runResult.summary || {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        },
        failures: Array.isArray(runResult.failures)
          ? runResult.failures.slice(0, 10).map((f) => ({
              testFile: f.testFile,
              testName: f.testName,
              message: secretFilter.sanitizeString(f.message || ''),
            }))
          : [],
        stdout: secretFilter.sanitizeString((runResult.stdout || '').slice(0, 4000)),
        stderr: secretFilter.sanitizeString((runResult.stderr || '').slice(0, 4000)),
      };
    } catch (err) {
      return {
        success: false,
        error: `Test execution failed: ${err.message}`,
      };
    }
  },
};

module.exports = RunTestsTool;
