let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

async function getPyodide(): Promise<any> {
  if (pyodideInstance) {
    return pyodideInstance;
  }
  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  pyodideLoadingPromise = (async () => {
    if (typeof window !== "undefined") {
      if (!(window as any).loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";
          script.onload = () => resolve();
          script.onerror = (e) => reject(new Error("Failed to load Pyodide CDN script"));
          document.head.appendChild(script);
        });
      }
      const loadPyodideFn = (window as any).loadPyodide;
      const pyodide = await loadPyodideFn({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
      });
      pyodideInstance = pyodide;
      return pyodide;
    }
    throw new Error("Pyodide can only be loaded in a browser environment");
  })();

  return pyodideLoadingPromise;
}

export async function runPython(code: string): Promise<{ stdout: string; stderr: string }> {
  const stdoutLogs: string[] = [];
  const stderrLogs: string[] = [];

  try {
    const pyodide = await getPyodide();

    pyodide.setStdout({
      batched: (text: string) => {
        stdoutLogs.push(text);
      },
    });

    pyodide.setStderr({
      batched: (text: string) => {
        stderrLogs.push(text);
      },
    });

    await pyodide.runPythonAsync(code);
  } catch (err: any) {
    stderrLogs.push(err.message || String(err));
  }

  return {
    stdout: stdoutLogs.join("\n"),
    stderr: stderrLogs.join("\n"),
  };
}
