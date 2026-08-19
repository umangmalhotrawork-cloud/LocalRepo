/**
 * TEST RUNNER DETECTOR
 * 
 * Inspects workspace configuration and filesystem evidence to deterministically
 * detect supported test runners (pytest, unittest, npm test, jest, vitest).
 * 
 * CRITICAL RULE: Never invents a test runner without repository evidence.
 */

const fs = require('fs');
const path = require('path');

class TestRunnerDetector {
  /**
   * Detects available test runners in the specified workspace.
   * @param {string} workspacePath - Absolute path to workspace root.
   * @returns {object} Structured discovery result.
   */
  detect(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string' || !fs.existsSync(workspacePath)) {
      return {
        detected: false,
        reason: 'INVALID_WORKSPACE_PATH',
        detectedRunners: [],
        preferredRunner: null,
      };
    }

    const normWorkspace = path.resolve(workspacePath);
    const detectedRunners = [];

    // -------------------------------------------------------------
    // 1. Python Test Runners (pytest / unittest)
    // -------------------------------------------------------------
    this.detectPythonRunners(normWorkspace, detectedRunners);

    // -------------------------------------------------------------
    // 2. JavaScript / TypeScript Test Runners (npm / jest / vitest)
    // -------------------------------------------------------------
    this.detectJsTsRunners(normWorkspace, detectedRunners);

    if (detectedRunners.length === 0) {
      return {
        detected: false,
        workspacePath: normWorkspace,
        reason: 'NO_TEST_RUNNER_DETECTED',
        detectedRunners: [],
        preferredRunner: null,
      };
    }

    // Select preferred runner (highest confidence)
    detectedRunners.sort((a, b) => b.confidence - a.confidence);
    const preferred = detectedRunners[0];

    return {
      detected: true,
      workspacePath: normWorkspace,
      detectedRunners,
      preferredRunner: preferred.framework,
      command: preferred.command,
      confidence: preferred.confidence,
      evidence: preferred.evidence,
    };
  }

  detectPythonRunners(workspace, runners) {
    const pyprojectPath = path.join(workspace, 'pyproject.toml');
    const pytestIniPath = path.join(workspace, 'pytest.ini');
    const setupCfgPath = path.join(workspace, 'setup.cfg');
    const conftestPath = path.join(workspace, 'conftest.py');
    const testsDirPath = path.join(workspace, 'tests');

    let pytestEvidence = [];
    let unittestEvidence = [];

    if (fs.existsSync(pytestIniPath)) {
      pytestEvidence.push('pytest.ini configuration file exists');
    }

    if (fs.existsSync(conftestPath)) {
      pytestEvidence.push('conftest.py root test fixture exists');
    }

    if (fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        if (content.includes('[tool.pytest') || content.includes('pytest')) {
          pytestEvidence.push('pyproject.toml contains pytest configuration');
        }
      } catch (e) {}
    }

    if (fs.existsSync(setupCfgPath)) {
      try {
        const content = fs.readFileSync(setupCfgPath, 'utf-8');
        if (content.includes('[tool:pytest]') || content.includes('pytest')) {
          pytestEvidence.push('setup.cfg contains pytest configuration');
        }
      } catch (e) {}
    }

    // Check tests directory or test files
    if (fs.existsSync(testsDirPath) && fs.statSync(testsDirPath).isDirectory()) {
      try {
        const files = fs.readdirSync(testsDirPath);
        const pyTestFiles = files.filter(f => f.startsWith('test_') || f.endsWith('_test.py'));
        if (pyTestFiles.length > 0) {
          if (pytestEvidence.length > 0) {
            pytestEvidence.push(`tests/ directory contains ${pyTestFiles.length} Python test files`);
          } else {
            // Check if test files use unittest or pytest
            let hasUnittest = false;
            for (const tf of pyTestFiles.slice(0, 5)) {
              const fileContent = fs.readFileSync(path.join(testsDirPath, tf), 'utf-8');
              if (fileContent.includes('unittest.TestCase') || fileContent.includes('import unittest')) {
                hasUnittest = true;
                break;
              }
            }
            if (hasUnittest) {
              unittestEvidence.push('tests/ directory contains unittest test cases');
            } else {
              pytestEvidence.push(`tests/ directory contains ${pyTestFiles.length} Python test files`);
            }
          }
        }
      } catch (e) {}
    }

    if (pytestEvidence.length > 0) {
      runners.push({
        language: 'python',
        framework: 'pytest',
        command: 'pytest',
        confidence: pytestEvidence.some(e => e.includes('pytest.ini') || e.includes('pyproject.toml')) ? 0.95 : 0.85,
        evidence: pytestEvidence,
      });
    } else if (unittestEvidence.length > 0) {
      runners.push({
        language: 'python',
        framework: 'unittest',
        command: 'python -m unittest discover',
        confidence: 0.85,
        evidence: unittestEvidence,
      });
    }
  }

  detectJsTsRunners(workspace, runners) {
    const pkgJsonPath = path.join(workspace, 'package.json');
    const jestConfigJs = path.join(workspace, 'jest.config.js');
    const jestConfigTs = path.join(workspace, 'jest.config.ts');
    const vitestConfigJs = path.join(workspace, 'vitest.config.js');
    const vitestConfigTs = path.join(workspace, 'vitest.config.ts');

    if (!fs.existsSync(pkgJsonPath)) return;

    let pkg = null;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    } catch (e) {
      return;
    }

    const scripts = pkg.scripts || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    // Vitest detection
    let vitestEvidence = [];
    if (fs.existsSync(vitestConfigJs) || fs.existsSync(vitestConfigTs)) {
      vitestEvidence.push('vitest.config file exists in workspace');
    }
    if (deps.vitest) {
      vitestEvidence.push('vitest package listed in dependencies');
    }
    if (scripts.test && scripts.test.includes('vitest')) {
      vitestEvidence.push('package.json "test" script invokes vitest');
    }

    if (vitestEvidence.length > 0) {
      runners.push({
        language: 'javascript',
        framework: 'vitest',
        command: scripts.test ? 'npm test' : 'npx vitest run',
        confidence: 0.95,
        evidence: vitestEvidence,
      });
    }

    // Jest detection
    let jestEvidence = [];
    if (fs.existsSync(jestConfigJs) || fs.existsSync(jestConfigTs)) {
      jestEvidence.push('jest.config file exists in workspace');
    }
    if (deps.jest || pkg.jest) {
      jestEvidence.push('jest package or configuration listed in package.json');
    }
    if (scripts.test && scripts.test.includes('jest')) {
      jestEvidence.push('package.json "test" script invokes jest');
    }

    if (jestEvidence.length > 0 && !vitestEvidence.length) {
      runners.push({
        language: 'javascript',
        framework: 'jest',
        command: scripts.test ? 'npm test' : 'npx jest',
        confidence: 0.95,
        evidence: jestEvidence,
      });
    }

    // Standard npm test detection (if not already added as jest/vitest)
    if (scripts.test) {
      const isUnconfigured = scripts.test.includes('no test specified') && scripts.test.includes('exit 1');
      if (!isUnconfigured) {
        const alreadyHasNpmRunner = runners.some(r => r.framework === 'jest' || r.framework === 'vitest');
        if (!alreadyHasNpmRunner) {
          runners.push({
            language: 'javascript',
            framework: 'npm',
            command: 'npm test',
            confidence: 0.90,
            evidence: [`package.json script "test": "${scripts.test}"`],
          });
        }
      }
    }
  }
}

const testRunnerDetector = new TestRunnerDetector();

module.exports = {
  TestRunnerDetector,
  testRunnerDetector,
};
