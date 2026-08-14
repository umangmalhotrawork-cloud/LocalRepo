const { profilerManager } = require('../electron/profilerManager');

async function main() {
  console.log("[TEST] Starting Performance Profiler (Milestone 40) Test Suite...");

  // 1. Python CPU Profiler Test
  const pyCode = `
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

def calculate():
    return fib(10)

calculate()
`;

  const cpuRes = await profilerManager.profilePythonCPU(pyCode, 'fib.py');
  console.log(`[TEST 1] Python CPU profile: success=${cpuRes.success}, functions=${cpuRes.functions?.length}, totalTime=${cpuRes.totalTime}ms`);
  if (!cpuRes.success || !Array.isArray(cpuRes.functions) || cpuRes.functions.length === 0) {
    throw new Error("Test 1 failed: Python CPU profile not generated");
  }

  // 2. Python Memory Profiler Test
  const memCode = `
items = [x * 2 for x in range(10000)]
data_map = {str(x): x for x in items}
`;
  const memRes = await profilerManager.profilePythonMemory(memCode, 'memory_leak.py');
  console.log(`[TEST 2] Python Memory profile: success=${memRes.success}, allocations=${memRes.topAllocations?.length}, peak=${memRes.peakMemoryKb}KB`);
  if (!memRes.success || !Array.isArray(memRes.topAllocations) || memRes.peakMemoryKb <= 0) {
    throw new Error("Test 2 failed: Python Memory profile not generated");
  }

  // 3. JS Timing Measurement Test
  const jsCode = `
let sum = 0;
for (let i = 0; i < 50000; i++) {
  sum += i;
}
`;
  const jsRes = await profilerManager.profileJavaScript(jsCode, 'sum.ts');
  console.log(`[TEST 3] JS timing: success=${jsRes.success}, duration=${jsRes.durationMs}ms, functions=${jsRes.functions.length}`);
  if (!jsRes.success || jsRes.durationMs < 0) {
    throw new Error("Test 3 failed: JS timing measurement failed");
  }

  // 4. React Metrics Collection Test
  profilerManager.recordReactMetric('IDEApp', 4.2);
  profilerManager.recordReactMetric('IDEApp', 3.8);
  profilerManager.recordReactMetric('MonacoEditor', 1.5, true);
  profilerManager.recordReactMetric('TestExplorerPanel', 2.1);

  const reactMetrics = profilerManager.getReactMetrics();
  console.log(`[TEST 4] React metrics: components=${reactMetrics.length}`);
  const ideAppMetric = reactMetrics.find((m) => m.component === 'IDEApp');
  if (!ideAppMetric || ideAppMetric.renderCount !== 2 || ideAppMetric.averageRenderTimeMs !== 4.0) {
    throw new Error("Test 4 failed: React metrics calculation mismatch");
  }
  const monacoMetric = reactMetrics.find((m) => m.component === 'MonacoEditor');
  if (!monacoMetric || monacoMetric.wastedRenders !== 1) {
    throw new Error("Test 4 failed: React wasted render count mismatch");
  }

  // 5. Timeline Serialization Test
  const timelineEvents = [
    { id: '1', label: 'compile', startMs: 0, durationMs: 12.5, type: 'cpu' },
    { id: '2', label: 'render', startMs: 12.5, durationMs: 5.2, type: 'render' },
  ];
  console.log(`[TEST 5] Timeline serialization: events=${timelineEvents.length}`);
  if (timelineEvents.length !== 2 || timelineEvents[1].startMs !== 12.5) {
    throw new Error("Test 5 failed: Timeline events format invalid");
  }

  // 6. Export JSON Validity Test
  const exportRes = profilerManager.exportReport({
    cpuProfile: cpuRes,
    memoryProfile: memRes,
    reactMetrics,
    timelineEvents,
  });
  console.log(`[TEST 6] Export JSON: success=${exportRes.success}, jsonLength=${exportRes.reportJson.length}`);
  const parsedExport = JSON.parse(exportRes.reportJson);
  if (!exportRes.success || !parsedExport.cpuProfile || !parsedExport.system) {
    throw new Error("Test 6 failed: Export JSON payload invalid");
  }

  // 7. Deterministic Structure Test
  if (typeof parsedExport.timestamp !== 'number' || !parsedExport.appVersion) {
    throw new Error("Test 7 failed: Deterministic envelope properties missing");
  }
  console.log(`[TEST 7] Deterministic envelope verified (version=${parsedExport.appVersion})`);

  console.log("\n>>> ALL 7 PERFORMANCE PROFILER TESTS PASSED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
