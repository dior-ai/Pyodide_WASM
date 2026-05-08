import { store, type AgentState } from "../state/store";

export function mountResultPanel(root: HTMLElement): void {
  const el = document.createElement("section");
  el.className = "glass p-5";
  el.innerHTML = /*html*/ `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400">Final Output</h2>
      <span id="result-meta" class="text-[10px] text-slate-500 text-mono"></span>
    </div>
    <div id="result-body" class="text-sm text-slate-200 leading-relaxed min-h-[60px]"></div>
    <div id="result-bullets" class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2"></div>
  `;
  root.appendChild(el);

  const body = el.querySelector<HTMLElement>("#result-body")!;
  const bullets = el.querySelector<HTMLElement>("#result-bullets")!;
  const meta = el.querySelector<HTMLElement>("#result-meta")!;

  store.subscribe((s) => render(s, body, bullets, meta));
}

function render(
  s: AgentState,
  body: HTMLElement,
  bullets: HTMLElement,
  meta: HTMLElement,
): void {
  if (!s.final_output && s.phase !== "done") {
    body.innerHTML = `<span class="text-slate-500 italic">Awaiting agent run — submit a task above to see the synthesized output.</span>`;
    bullets.innerHTML = "";
    meta.textContent = "";
    return;
  }

  body.innerHTML = `<p>${escapeHtml(s.final_output || "")}</p>`;
  meta.textContent =
    s.phase === "done"
      ? `${s.tool_history.length} tools · ${s.totalDurationMs} ms total`
      : "";

  // Surface counter / inspector facts as KPI cards.
  const inspector = s.tool_history.find((h) => h.tool === "file_inspector");
  const counter = s.tool_history.find((h) => h.tool === "file_counter");
  const cards: { label: string; value: string }[] = [];

  if (counter) {
    const out = counter.output as Record<string, unknown>;
    cards.push({ label: "Files", value: String(out.count ?? 0) });
    if (typeof out.total_bytes === "number") {
      cards.push({ label: "Total Size", value: humanBytes(out.total_bytes) });
    }
    const byType = out.by_type as Record<string, number> | undefined;
    if (byType) {
      const types = Object.entries(byType).length;
      cards.push({ label: "Distinct Types", value: String(types) });
    }
  } else if (inspector) {
    const out = inspector.output as Record<string, unknown>;
    cards.push({ label: "Files Inspected", value: String(out.count ?? 0) });
  }

  bullets.innerHTML = cards
    .map(
      (c) => /*html*/ `
      <div class="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wider text-slate-500">${escapeHtml(c.label)}</div>
        <div class="text-base font-semibold text-accent-cyan text-mono mt-0.5">${escapeHtml(c.value)}</div>
      </div>
    `,
    )
    .join("");
}

function humanBytes(n: number): string {
  let v = n;
  for (const u of ["B", "KB", "MB", "GB"]) {
    if (v < 1024) return `${v.toFixed(1)} ${u}`;
    v /= 1024;
  }
  return `${v.toFixed(1)} TB`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
