declare global {
  interface Window {
    loadPyodide: (opts?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

export interface PyodideInterface {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    set: (name: string, value: unknown) => void;
    get: (name: string) => unknown;
  };
  toPy: (obj: unknown) => unknown;
  registerJsModule: (name: string, module: unknown) => void;
}

const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";

let pyodidePromise: Promise<{ pyodide: PyodideInterface; loadMs: number }> | null = null;

export function loadPyodideRuntime(
  onProgress?: (msg: string) => void,
): Promise<{ pyodide: PyodideInterface; loadMs: number }> {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    const t0 = performance.now();
    onProgress?.("Fetching WebAssembly runtime...");

    if (typeof window.loadPyodide !== "function") {
      throw new Error(
        "Pyodide global not found. Verify the CDN <script> tag in index.html.",
      );
    }

    const pyodide = await window.loadPyodide({ indexURL: PYODIDE_INDEX });
    onProgress?.("Initializing CPython 3.12 in WASM...");

    pyodide.runPython("import sys, json, time");
    onProgress?.("Runtime ready.");

    const loadMs = Math.round(performance.now() - t0);
    return { pyodide, loadMs };
  })();

  return pyodidePromise;
}
