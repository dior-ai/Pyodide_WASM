import "./styles/globals.css";

import { loadPyodideRuntime, type PyodideInterface } from "./runtime/pyodide-loader";
import { store } from "./state/store";
import { runAgent } from "./agent/controller";
import { mountHeader } from "./ui/header";
import { mountTaskInput } from "./ui/task-input";
import { mountConsole } from "./ui/console";
import { mountResultPanel } from "./ui/result-panel";
import { mountToolSidebar } from "./ui/tool-sidebar";
import { mountPhaseFlow } from "./ui/phase-flow";
import { mountWorkspacePanel } from "./ui/workspace-panel";
import { mountReplPanel } from "./ui/repl-panel";
import { exportRunReport } from "./ui/export";

let pyodide: PyodideInterface | null = null;

async function main(): Promise<void> {
  buildLayout();

  store.pushLog({
    source: "System",
    level: "info",
    message: "Initializing browser-native AI runtime...",
  });
  store.set({
    phase: "loading_runtime",
    runtime: { ...store.get().runtime, statusText: "Loading WebAssembly..." },
  });

  const { pyodide: py, loadMs } = await loadPyodideRuntime((msg) =>
    store.set({ runtime: { ...store.get().runtime, statusText: msg } }),
  );

  pyodide = py;
  store.set({
    phase: "ready",
    runtime: {
      pyodideReady: true,
      loadMs,
      statusText: `Pyodide ${getPyVersion(py)} ready`,
    },
  });
  store.pushLog({
    source: "System",
    level: "ok",
    message: `WebAssembly runtime online (${loadMs} ms). Drop files into the workspace to begin.`,
  });
}

function getPyVersion(py: PyodideInterface): string {
  try {
    py.runPython(
      "import sys, json as _j; __pv__ = _j.dumps(list(sys.version_info[:3]))",
    );
    const raw = py.globals.get("__pv__") as string;
    const parts = JSON.parse(raw);
    return `${parts[0]}.${parts[1]}`;
  } catch {
    return "3.x";
  }
}

function buildLayout(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  // animated background
  const bg = document.createElement("div");
  bg.className = "bg-stage";
  document.body.appendChild(bg);

  // shell
  const shell = document.createElement("div");
  shell.className = "px-6 py-5 flex flex-col gap-5 max-w-[1480px] mx-auto w-full flex-1";
  app.appendChild(shell);

  mountHeader(shell);

  const grid = document.createElement("div");
  grid.className = "grid gap-5 grid-cols-1 lg:grid-cols-[1fr_360px] flex-1";
  shell.appendChild(grid);

  const left = document.createElement("div");
  left.className = "flex flex-col gap-5 min-w-0";
  grid.appendChild(left);

  const right = document.createElement("div");
  right.className = "flex flex-col gap-5 min-w-0";
  grid.appendChild(right);

  mountTaskInput(left, {
    onRun: async (task) => {
      if (!pyodide) {
        store.pushLog({
          source: "System",
          level: "error",
          message: "Runtime not ready yet.",
        });
        return;
      }
      try {
        await runAgent({ task, pyodide });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.pushLog({ source: "System", level: "error", message });
      }
    },
    onExport: (fmt) => exportRunReport(fmt),
  });

  mountPhaseFlow(left);
  mountWorkspacePanel(left);
  mountConsole(left);
  mountResultPanel(left);
  mountReplPanel(left, { getPyodide: () => pyodide });
  mountToolSidebar(right);

  // footer
  const footer = document.createElement("footer");
  footer.className =
    "text-center text-[11px] text-slate-600 text-mono py-2 border-t border-white/5";
  footer.innerHTML =
    'Pyodide Agent Runtime · CPython compiled to WebAssembly · everything you see runs in your browser.';
  shell.appendChild(footer);
}

main().catch((err) => {
  console.error("fatal boot error", err);
  store.set({
    phase: "error",
    runtime: { ...store.get().runtime, statusText: "Boot failed" },
  });
  store.pushLog({
    source: "System",
    level: "error",
    message: err instanceof Error ? err.message : String(err),
  });
});
