import { store, type LogLine } from "../state/store";

const LEVEL_COLORS: Record<LogLine["level"], string> = {
  info: "text-slate-300",
  ok: "text-accent-green",
  warn: "text-accent-amber",
  error: "text-accent-rose",
};

const SOURCE_COLORS: Record<string, string> = {
  Planner: "text-accent-violet",
  ToolRouter: "text-accent-cyan",
  Executor: "text-accent-cyan",
  Summarizer: "text-accent-violet",
  Pyodide: "text-amber-300",
  Result: "text-accent-green",
  System: "text-slate-400",
};

export function mountConsole(root: HTMLElement): void {
  const el = document.createElement("section");
  el.className = "glass flex flex-col min-h-[360px] flex-1";
  el.innerHTML = /*html*/ `
    <div class="px-5 py-3 border-b border-white/5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-accent-rose/70"></span>
        <span class="w-2 h-2 rounded-full bg-accent-amber/70"></span>
        <span class="w-2 h-2 rounded-full bg-accent-green/70"></span>
        <h2 class="ml-3 text-xs uppercase tracking-[0.2em] text-slate-400">Execution Console</h2>
      </div>
      <span id="console-meta" class="text-[10px] text-slate-500 text-mono"></span>
    </div>
    <div id="log-stream" class="flex-1 overflow-y-auto thin-scroll text-mono text-[12.5px] leading-relaxed px-5 py-4 space-y-1"></div>
  `;
  root.appendChild(el);

  const stream = el.querySelector<HTMLElement>("#log-stream")!;
  const meta = el.querySelector<HTMLElement>("#console-meta")!;
  let lastSeen = 0;

  store.subscribe((s) => {
    meta.textContent = `${s.logs.length} event${s.logs.length === 1 ? "" : "s"} · phase: ${s.phase}`;

    if (s.logs.length < lastSeen) {
      // Reset triggered (new run): clear existing lines.
      stream.innerHTML = "";
      lastSeen = 0;
    }

    for (let i = lastSeen; i < s.logs.length; i++) {
      const line = s.logs[i];
      stream.appendChild(renderLine(line));
    }
    lastSeen = s.logs.length;
    stream.scrollTop = stream.scrollHeight;
  });
}

function renderLine(line: LogLine): HTMLElement {
  const row = document.createElement("div");
  row.className = "flex gap-3 items-baseline";
  const ts = new Date(line.ts);
  const time = ts.toTimeString().slice(0, 8);
  const sourceColor = SOURCE_COLORS[line.source] ?? "text-slate-400";
  const levelColor = LEVEL_COLORS[line.level];
  row.innerHTML = /*html*/ `
    <span class="text-slate-600 text-[11px] tabular-nums">${time}</span>
    <span class="${sourceColor} font-semibold w-[88px] flex-shrink-0">[${escapeHtml(line.source)}]</span>
    <span class="${levelColor} flex-1">${escapeHtml(line.message)}</span>
  `;
  return row;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
