// Pyodide is a real npm dependency (see package.json). The runtime assets are
// copied out of node_modules/pyodide into public/pyodide/ at install time by
// scripts/copy-pyodide.mjs. We then load the official `pyodide.mjs` wrapper as
// a runtime dynamic import so Vite doesn't try to statically bundle Pyodide's
// conditional Node-only code paths. End result: 100% self-hosted, no CDN.

// Import the official type definitions from the npm package so our TS code
// stays strictly typed even though the wrapper is loaded at runtime.
import type { PyodideInterface as PyodideAPI } from "pyodide";

export type PyodideInterface = PyodideAPI;

const PYODIDE_INDEX = "/pyodide/";
const PYODIDE_ENTRY = `${PYODIDE_INDEX}pyodide.mjs`;

let pyodidePromise: Promise<{ pyodide: PyodideInterface; loadMs: number }> | null = null;

export function loadPyodideRuntime(
  onProgress?: (msg: string) => void,
): Promise<{ pyodide: PyodideInterface; loadMs: number }> {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    const t0 = performance.now();
    onProgress?.("Loading WebAssembly runtime from /pyodide/...");

    // Vite ignores this string (we want runtime resolution, not bundling).
    const mod = (await import(/* @vite-ignore */ PYODIDE_ENTRY)) as {
      loadPyodide: (opts: {
        indexURL: string;
        stdout?: (m: string) => void;
        stderr?: (m: string) => void;
      }) => Promise<PyodideInterface>;
    };

    const pyodide = await mod.loadPyodide({
      indexURL: PYODIDE_INDEX,
      stdout: (msg) => console.debug("[py.stdout]", msg),
      stderr: (msg) => console.warn("[py.stderr]", msg),
    });

    onProgress?.("Bootstrapping CPython 3.12 in WASM...");
    pyodide.runPython("import sys, json, time, io");

    onProgress?.("Loading micropip (for runtime package installs)...");
    await pyodide.loadPackage("micropip");

    onProgress?.("Runtime ready.");
    const loadMs = Math.round(performance.now() - t0);
    return { pyodide, loadMs };
  })();

  return pyodidePromise;
}

/** Lazily install a PyPI package via micropip. Memoized per package name. */
const installed = new Map<string, Promise<void>>();
export function ensurePackage(
  pyodide: PyodideInterface,
  pkg: string,
): Promise<void> {
  if (!installed.has(pkg)) {
    installed.set(
      pkg,
      pyodide
        .runPythonAsync(
          `import micropip\nawait micropip.install("${pkg}")\n`,
        )
        .then(() => undefined),
    );
  }
  return installed.get(pkg)!;
}
