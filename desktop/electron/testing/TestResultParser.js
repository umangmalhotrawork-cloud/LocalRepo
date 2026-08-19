/**
 * TEST RESULT PARSER
 * 
 * Parses test runner stdout and stderr into structured diagnostic records.
 * Extracts test totals, passed/failed counts, durations, and structured failures.
 * 
 * CRITICAL RULE: Never invents structured failure information. Preserves raw output.
 */

class TestResultParser {
  /**
   * Parses test output into structured result metrics.
   * @param {string} framework - 'pytest' | 'unittest' | 'jest' | 'vitest' | 'npm'
   * @param {string} stdout - Standard output from test process
   * @param {string} stderr - Standard error from test process
   * @param {number} exitCode - Process exit code
   * @returns {object} Structured parse result
   */
  parse(framework, stdout = '', stderr = '', exitCode = 0) {
    const rawOutput = `${stdout}\n${stderr}`.trim();
    const failures = [];
    let summary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: null,
    };

    if (framework === 'pytest') {
      this.parsePytest(rawOutput, summary, failures);
    } else if (framework === 'unittest') {
      this.parseUnittest(rawOutput, summary, failures);
    } else if (framework === 'jest' || framework === 'vitest' || framework === 'npm') {
      this.parseJsTests(rawOutput, summary, failures);
    }

    // If exit code is non-zero and no failures parsed, record fallback failure
    if (exitCode !== 0 && failures.length === 0) {
      failures.push({
        testFile: 'unknown',
        testName: 'Test execution failed',
        message: stderr.slice(0, 300) || stdout.slice(-300) || `Process exited with code ${exitCode}`,
      });
      summary.failed = Math.max(1, summary.failed);
    }

    return {
      summary,
      failures,
      hasFailures: failures.length > 0 || exitCode !== 0,
    };
  }

  parsePytest(output, summary, failures) {
    // Summary line: e.g. "== 2 failed, 10 passed in 1.23s =="
    const summaryMatch = output.match(/=+\s*([\d\w\s,]+)\s+in\s+([\d.]+)s/);
    if (summaryMatch) {
      const parts = summaryMatch[1];
      const durationSec = parseFloat(summaryMatch[2]);
      summary.durationMs = isNaN(durationSec) ? null : Math.round(durationSec * 1000);

      const passMatch = parts.match(/(\d+)\s+passed/);
      if (passMatch) summary.passed = parseInt(passMatch[1], 10);

      const failMatch = parts.match(/(\d+)\s+failed/);
      if (failMatch) summary.failed = parseInt(failMatch[1], 10);

      const skipMatch = parts.match(/(\d+)\s+skipped/);
      if (skipMatch) summary.skipped = parseInt(skipMatch[1], 10);

      summary.total = summary.passed + summary.failed + summary.skipped;
    }

    // Failures block: e.g. "FAILED tests/test_calc.py::test_add - AssertionError: assert 5 == 6"
    const failureLines = output.split('\n');
    for (const line of failureLines) {
      const failMatch = line.match(/^FAILED\s+([^:]+)::(\w+)(?:\s+-\s+(.+))?/);
      if (failMatch) {
        failures.push({
          testFile: failMatch[1].trim(),
          testName: failMatch[2].trim(),
          message: failMatch[3] ? failMatch[3].trim() : 'Test assertion failed',
        });
      }
    }
  }

  parseUnittest(output, summary, failures) {
    // Summary: e.g. "Ran 12 tests in 0.045s"
    const ranMatch = output.match(/Ran (\d+) tests? in ([\d.]+)s/);
    if (ranMatch) {
      summary.total = parseInt(ranMatch[1], 10);
      const durationSec = parseFloat(ranMatch[2]);
      summary.durationMs = isNaN(durationSec) ? null : Math.round(durationSec * 1000);
    }

    if (output.includes('OK')) {
      summary.passed = summary.total;
    } else {
      const failMatch = output.match(/FAILED \((?:failures=(\d+))?(?:, )?(?:errors=(\d+))?\)/);
      if (failMatch) {
        const fails = parseInt(failMatch[1] || '0', 10);
        const errors = parseInt(failMatch[2] || '0', 10);
        summary.failed = fails + errors;
        summary.passed = Math.max(0, summary.total - summary.failed);
      }
    }

    // Parse FAIL: test_name (test_module.TestClass)
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const failHeader = line.match(/^(?:FAIL|ERROR):\s+(\w+)\s+\(([^)]+)\)/);
      if (failHeader) {
        const testName = failHeader[1];
        const testModule = failHeader[2];
        let message = 'AssertionError';
        // Look ahead for traceback error message
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          if (lines[j].startsWith('AssertionError:') || lines[j].startsWith('Error:')) {
            message = lines[j];
            break;
          }
        }
        failures.push({
          testFile: testModule,
          testName,
          message,
        });
      }
    }
  }

  parseJsTests(output, summary, failures) {
    // Jest/Vitest summary line: "Tests:       2 failed, 8 passed, 10 total"
    const testsMatch = output.match(/Tests:\s+([^\n]+)/);
    if (testsMatch) {
      const line = testsMatch[1];
      const passMatch = line.match(/(\d+)\s+passed/);
      if (passMatch) summary.passed = parseInt(passMatch[1], 10);

      const failMatch = line.match(/(\d+)\s+failed/);
      if (failMatch) summary.failed = parseInt(failMatch[1], 10);

      const totalMatch = line.match(/(\d+)\s+total/);
      if (totalMatch) summary.total = parseInt(totalMatch[1], 10);
      else summary.total = summary.passed + summary.failed;
    }

    // Parse Jest failure: "● TestSuite › testName"
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('● ') || line.includes('FAIL ')) {
        const testTitle = line.replace(/^[●\sFAIL]+/, '').trim();
        let message = 'Test failed';
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('Expected:') || lines[j].includes('Received:') || lines[j].includes('Error:')) {
            message = lines[j].trim();
            break;
          }
        }
        if (testTitle && !testTitle.includes('Tests:')) {
          failures.push({
            testFile: 'test',
            testName: testTitle,
            message,
          });
        }
      }
    }
  }
}

const testResultParser = new TestResultParser();

module.exports = {
  TestResultParser,
  testResultParser,
};
