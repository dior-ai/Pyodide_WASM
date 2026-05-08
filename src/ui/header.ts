import { store, type AgentState } from "../state/store";

export function mountHeader(root: HTMLElement): void {
  const el = document.createElement("header");
  el.className =
    "glass-strong neon-border px-6 py-4 flex items-center justify-between";
  el.innerHTML = /*html*/ `
    <div class="flex items-center gap-3">
      <div class="relative w-8 h-8">
        <div class="absolute inset-0 rounded-full bg-accent-cyan opacity-20 blur-md"></div>
        <div class="absolute inset-1.5 rounded-full bg-accent-cyan"></div>
        <div class="absolute inset-2.5 rounded-full bg-canvas"></div>
        <div class="absolute inset-3 rounded-full bg-accent-cyan"></div>
      </div>
      <div class="flex flex-col leading-tight">
        <span class="text-sm uppercase tracking-[0.2em] text-slate-400">Pyodide Agent Runtime</span>
        <span class="text-xs text-slate-500 text-mono">browser-native · webassembly · zero-server</span>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div id="status-block" class="flex items-center gap-2 text-xs text-mono"></div>
      <a href="https://github.com/dior-ai/Pyodide_WASM" target="_blank" rel="noreferrer"
         class="text-xs text-slate-400 hover:text-accent-cyan transition-colors">
        ↗ source
      </a>
    </div>
  `;
  root.appendChild(el);

  const statusBlock = el.querySelector<HTMLElement>("#status-block")!;

  const render = (s: AgentState) => {
    const phase = s.runtime.pyodideReady ? "READY" : "LOADING";
    const dotColor = s.runtime.pyodideReady ? "bg-accent-green" : "bg-accent-amber";
    const dotPulse = s.runtime.pyodideReady ? "" : "pulse-glow-violet";
    const loadInfo = s.runtime.loadMs
      ? `<span class="text-slate-500">· wasm in ${s.runtime.loadMs}ms</span>`
      : "";
    statusBlock.innerHTML = /*html*/ `
      <span class="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
        <span class="w-1.5 h-1.5 rounded-full ${dotColor} ${dotPulse}"></span>
        <span class="font-medium tracking-wider text-slate-200">${phase}</span>
      </span>
      <span class="text-slate-500">${escapeHtml(s.runtime.statusText)}</span>
      ${loadInfo}
    `;
  };

  store.subscribe(render);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
