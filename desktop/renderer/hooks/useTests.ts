"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type TestCase = {
  id: string;
  name: string;
  filePath: string;
  suiteName?: string;
  line: number;
  type: 'test';
  framework: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  failureLine?: number;
  failureMessage?: string;
  stdout?: string;
  stderr?: string;
  command?: string;
};

export type TestSuite = {
  id: string;
  name: string;
  filePath: string;
  line: number;
  type: 'suite';
  framework: string;
  children: TestCase[];
};

export type TestFile = {
  filePath: string;
  relativeFilePath: string;
  name: string;
  framework: string;
  children: (TestSuite | TestCase)[];
  testCount: number;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
};

export type CoverageFile = {
  filePath: string;
  relativeFilePath: string;
  name: string;
  lineCoveragePct: number;
  coveredCount: number;
  uncoveredCount: number;
  totalLines: number;
  coveredLines: number[];
  uncoveredLines: number[];
};

export type CoverageReport = {
  overallCoveragePct: number;
  totalCoveredLines: number;
  totalExecutableLines: number;
  files: CoverageFile[];
};

export type TestOutputLog = {
  command: string;
  stdout: string;
  stderr: string;
  status: 'passed' | 'failed' | 'running';
  durationMs: number;
  failureLine?: number;
  failureMessage?: string;
};

export function useTests(workspacePath: string) {
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [totalTests, setTotalTests] = useState<number>(0);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [coverageData, setCoverageData] = useState<CoverageReport | null>(null);
  const [coverageLoading, setCoverageLoading] = useState<boolean>(false);
  const [activeOutput, setActiveOutput] = useState<TestOutputLog | null>(null);

  // 1. Discover Tests
  const discoverTests = useCallback(async () => {
    if (!workspacePath) return;
    setDiscovering(true);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.tests?.discover) {
        const res = await (window as any).electronAPI.tests.discover(workspacePath);
        if (res && res.testFiles) {
          setTestFiles(res.testFiles);
          setTotalTests(res.totalTests || 0);
        }
      }
    } catch (err) {
      console.error("[TEST-HOOK] Error discovering tests:", err);
    } finally {
      setDiscovering(false);
    }
  }, [workspacePath]);

  // 2. Run Single Test
  const runSingleTest = useCallback(
    async (test: TestCase) => {
      setRunning(true);
      setActiveOutput({
        command: `Running ${test.name}...`,
        stdout: `Executing test ${test.name} (${test.framework})...\n`,
        stderr: '',
        status: 'running',
        durationMs: 0,
      });

      // Set test status to running
      setTestFiles((prev) =>
        prev.map((file) => {
          if (file.filePath !== test.filePath) return file;
          return {
            ...file,
            children: file.children.map((child) => {
              if (child.type === 'test' && child.id === test.id) {
                return { ...child, status: 'running' };
              }
              if (child.type === 'suite') {
                return {
                  ...child,
                  children: child.children.map((c) =>
                    c.id === test.id ? { ...c, status: 'running' } : c
                  ),
                };
              }
              return child;
            }),
          };
        })
      );

      try {
        let res: any;
        if (typeof window !== "undefined" && (window as any).electronAPI?.tests?.run) {
          res = await (window as any).electronAPI.tests.run({
            workspacePath,
            testId: test.id,
            filePath: test.filePath,
            suiteName: test.suiteName,
            testName: test.name,
            framework: test.framework,
          });
        } else {
          res = {
            testId: test.id,
            status: 'passed',
            stdout: `PASSED: ${test.name}`,
            stderr: '',
            durationMs: 25,
            command: `pytest ${test.filePath} -k "${test.name}"`,
          };
        }

        setActiveOutput({
          command: res.command || `Test ${test.name}`,
          stdout: res.stdout || '',
          stderr: res.stderr || '',
          status: res.status,
          durationMs: res.durationMs || 0,
          failureLine: res.failureLine,
          failureMessage: res.failureMessage,
        });

        setTestFiles((prev) =>
          prev.map((file) => {
            if (file.filePath !== test.filePath) return file;
            return {
              ...file,
              children: file.children.map((child) => {
                if (child.type === 'test' && child.id === test.id) {
                  return {
                    ...child,
                    status: res.status,
                    durationMs: res.durationMs,
                    failureLine: res.failureLine,
                    failureMessage: res.failureMessage,
                    stdout: res.stdout,
                    stderr: res.stderr,
                    command: res.command,
                  };
                }
                if (child.type === 'suite') {
                  return {
                    ...child,
                    children: child.children.map((c) =>
                      c.id === test.id
                        ? {
                            ...c,
                            status: res.status,
                            durationMs: res.durationMs,
                            failureLine: res.failureLine,
                            failureMessage: res.failureMessage,
                            stdout: res.stdout,
                            stderr: res.stderr,
                            command: res.command,
                          }
                        : c
                    ),
                  };
                }
                return child;
              }),
            };
          })
        );
      } catch (err: any) {
        console.error("[TEST-HOOK] Error executing single test:", err);
      } finally {
        setRunning(false);
      }
    },
    [workspacePath]
  );

  // 3. Run File Tests
  const runFileTests = useCallback(
    async (filePath: string, framework: string = 'pytest') => {
      setRunning(true);
      setActiveOutput({
        command: `Running file: ${filePath}...`,
        stdout: `Executing all tests in ${filePath}...\n`,
        stderr: '',
        status: 'running',
        durationMs: 0,
      });

      try {
        let res: any;
        if (typeof window !== "undefined" && (window as any).electronAPI?.tests?.runFile) {
          res = await (window as any).electronAPI.tests.runFile({
            workspacePath,
            filePath,
            framework,
          });
        } else {
          res = {
            filePath,
            status: 'passed',
            stdout: `File ${filePath} tests passed`,
            stderr: '',
            durationMs: 45,
            command: `pytest ${filePath}`,
          };
        }

        setActiveOutput({
          command: res.command || `File ${filePath}`,
          stdout: res.stdout || '',
          stderr: res.stderr || '',
          status: res.status,
          durationMs: res.durationMs || 0,
          failureLine: res.failureLine,
          failureMessage: res.failureMessage,
        });

        setTestFiles((prev) =>
          prev.map((file) => {
            if (file.filePath !== filePath) return file;
            return {
              ...file,
              status: res.status,
              children: file.children.map((child) => {
                if (child.type === 'test') {
                  return { ...child, status: res.status };
                }
                if (child.type === 'suite') {
                  return {
                    ...child,
                    children: child.children.map((c) => ({ ...c, status: res.status })),
                  };
                }
                return child;
              }),
            };
          })
        );
      } catch (err) {
        console.error("[TEST-HOOK] Error running file tests:", err);
      } finally {
        setRunning(false);
      }
    },
    [workspacePath]
  );

  // 4. Run All Workspace Tests
  const runAllTests = useCallback(async () => {
    if (!workspacePath) return;
    setRunning(true);
    setActiveOutput({
      command: `Running all workspace tests...`,
      stdout: `Scanning and executing all tests across workspace...\n`,
      stderr: '',
      status: 'running',
      durationMs: 0,
    });

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.tests?.runAll) {
        const res = await (window as any).electronAPI.tests.runAll({ workspacePath });
        if (res && res.results) {
          const resMap = new Map<string, any>(res.results.map((r: any) => [r.filePath, r]));
          setTestFiles((prev) =>
            prev.map((file) => {
              const r = resMap.get(file.filePath);
              const status = r ? r.status : 'passed';
              return {
                ...file,
                status,
                children: file.children.map((child) => {
                  if (child.type === 'test') return { ...child, status };
                  if (child.type === 'suite') {
                    return {
                      ...child,
                      children: child.children.map((c) => ({ ...c, status })),
                    };
                  }
                  return child;
                }),
              };
            })
          );

          setActiveOutput({
            command: `Run All Tests (${res.totalFiles} files)`,
            stdout: `Completed ${res.totalFiles} files: ${res.passedCount} passed, ${res.failedCount} failed in ${res.durationMs}ms`,
            stderr: '',
            status: res.failedCount > 0 ? 'failed' : 'passed',
            durationMs: res.durationMs,
          });
        }
      }
    } catch (err) {
      console.error("[TEST-HOOK] Error running all tests:", err);
    } finally {
      setRunning(false);
    }
  }, [workspacePath]);

  // 5. Fetch Coverage Report
  const fetchCoverage = useCallback(async () => {
    if (!workspacePath) return;
    setCoverageLoading(true);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.tests?.coverage) {
        const res = await (window as any).electronAPI.tests.coverage({ workspacePath });
        if (res && res.success) {
          setCoverageData(res);
        }
      }
    } catch (err) {
      console.error("[TEST-HOOK] Error fetching coverage:", err);
    } finally {
      setCoverageLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (workspacePath) {
      discoverTests();
    }
  }, [workspacePath, discoverTests]);

  return {
    testFiles,
    totalTests,
    discovering,
    running,
    activeOutput,
    coverageData,
    coverageLoading,
    discoverTests,
    runSingleTest,
    runFileTests,
    runAllTests,
    fetchCoverage,
  };
}
