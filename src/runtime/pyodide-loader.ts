// Pyodide is a real npm dependency (see package.json). The runtime assets are
// copied out of node_modules/pyodide into public/pyodide/ at install time by
// scripts/copy-pyodide.mjs. The IIFE build is loaded via a <script> tag in
// index.html — that's the supported way to consume static files under
// public/ in Vite (importing public files from JS source is forbidden by
// Vite's plugin pipeline). End result: 100% self-hosted, no CDN.

import type {
  PyodideInterface as PyodideAPI,
  loadPyodide as loadPyodideFn,
} from "pyodide";

export type PyodideInterface = PyodideAPI;

declare global {
  interface Window {
    loadPyodide: typeof loadPyodideFn;
  }
}

const PYODIDE_INDEX = "/pyodide/";

let pyodidePromise: Promise<{ pyodide: PyodideInterface; loadMs: number }> | null = null;

export function loadPyodideRuntime(
  onProgress?: (msg: string) => void,
): Promise<{ pyodide: PyodideInterface; loadMs: number }> {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    const t0 = performance.now();
    onProgress?.("Loading WebAssembly runtime from /pyodide/...");

    if (typeof window.loadPyodide !== "function") {
      throw new Error(
        "window.loadPyodide is not defined. The <script src=\"/pyodide/pyodide.js\"> tag in index.html may have failed to load — verify that public/pyodide/ exists (run `npm run copy-pyodide`).",
      );
    }

    const pyodide = await window.loadPyodide({
      indexURL: PYODIDE_INDEX,
      stdout: (msg: string) => console.debug("[py.stdout]", msg),
      stderr: (msg: string) => console.warn("[py.stderr]", msg),
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
