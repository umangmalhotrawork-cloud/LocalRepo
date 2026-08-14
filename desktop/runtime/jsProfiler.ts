export type JsProfileFunction = {
  name: string;
  calls: number;
  totalTime: number; // in ms
  cumulativeTime: number; // in ms
  file: string;
  line: number;
};

export type JsProfileResult = {
  success: boolean;
  type: 'javascript';
  file: string;
  totalTime: number;
  durationMs: number;
  functions: JsProfileFunction[];
  error?: string;
};

/**
 * Profile JavaScript / TypeScript execution timing
 */
export async function profileJavaScript(
  code: string,
  filePath: string = 'snippet.ts'
): Promise<JsProfileResult> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.profiler?.javascript) {
    try {
      const res = await (window as any).electronAPI.profiler.javascript({ code, filePath });
      if (res) return res;
    } catch (e) {
      console.error('[PROFILER] JS profile IPC failed:', e);
    }
  }

  const start = performance.now();
  let evalError: string | undefined;
  try {
    const fn = new Function(code);
    fn();
  } catch (e: any) {
    evalError = e.message;
  }
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  return {
    success: !evalError,
    type: 'javascript',
    file: filePath,
    totalTime: durationMs,
    durationMs,
    functions: [
      { name: 'main', calls: 1, totalTime: durationMs, cumulativeTime: durationMs, file: filePath, line: 1 },
    ],
    error: evalError,
  };
}

/**
 * Measure duration of an async function
 */
export async function profileAsyncExecution<T>(
  fn: () => Promise<T>,
  label: string = 'async_task'
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  return { result, durationMs };
}

/**
 * Measure duration of a synchronous function
 */
export function measureExecutionTime(
  fn: () => void,
  label: string = 'sync_task'
): { durationMs: number } {
  const start = performance.now();
  fn();
  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  return { durationMs };
}
