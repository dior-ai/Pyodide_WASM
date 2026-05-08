import { store, type AgentState } from "../state/store";
import { TOOL_REGISTRY } from "../tools/registry";

export function mountToolSidebar(root: HTMLElement): void {
  const el = document.createElement("aside");
  el.className = "glass p-4 flex flex-col gap-4";
  el.innerHTML = /*html*/ `
    <div>
      <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Agent Topology</h2>
      <div id="agents-list" class="space-y-2"></div>
    </div>

    <div class="border-t border-white/5 pt-4">
      <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Tool Registry</h2>
      <div id="tools-list" class="space-y-2"></div>
    </div>

    <div class="border-t border-white/5 pt-4">
      <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Live State</h2>
      <pre id="state-json" class="text-[10.5px] leading-relaxed text-mono bg-black/40 border border-white/5 rounded-lg p-3 max-h-[300px] overflow-auto thin-scroll text-slate-300"></pre>
    </div>
  `;
  root.appendChild(el);

  renderStaticTools(el.querySelector<HTMLElement>("#tools-list")!);
  renderStaticAgents(el.querySelector<HTMLElement>("#agents-list")!);

  const stateJsonEl = el.querySelector<HTMLElement>("#state-json")!;
  const toolPills = el.querySelector<HTMLElement>("#tools-list")!;
  const agentPills = el.querySelector<HTMLElement>("#agents-list")!;

  store.subscribe((s) => {
    paintActive(toolPills, agentPills, s);
    stateJsonEl.textContent = JSON.stringify(serialize(s), null, 2);
  });
}

function renderStaticTools(container: HTMLElement): void {
  container.innerHTML = TOOL_REGISTRY.map(
    (t) => /*html*/ `
    <div class="tool-pill flex items-center gap-3 rounded-lg px-3 py-2 border border-white/5 bg-black/20 transition-all" data-tool="${t.name}">
      <span class="dot w-1.5 h-1.5 rounded-full bg-slate-600 transition-colors"></span>
      <div class="flex-1 min-w-0">
        <div class="text-[12px] font-semibold text-slate-200 text-mono">${t.name}</div>
        <div class="text-[10px] text-slate-500 truncate">${escapeHtml(t.description)}</div>
      </div>
      <span class="status text-[9px] uppercase tracking-wider text-slate-600">idle</span>
    </div>
  `,
  ).join("");
}

function renderStaticAgents(container: HTMLElement): void {
  const agents = [
    { name: "Planner", role: "Parses intent, produces a plan" },
    { name: "Executor", role: "Drives Pyodide tool calls" },
    { name: "Summarizer", role: "Synthesizes the final report" },
  ];
  container.innerHTML = agents
    .map(
      (a) => /*html*/ `
      <div class="agent-pill flex items-center gap-3 rounded-lg px-3 py-2 border border-white/5 bg-black/20" data-agent="${a.name}">
        <span class="dot w-1.5 h-1.5 rounded-full bg-slate-600 transition-colors"></span>
        <div class="flex-1 min-w-0">
          <div class="text-[12px] font-semibold text-slate-200">${a.name}</div>
          <div class="text-[10px] text-slate-500 truncate">${a.role}</div>
        </div>
      </div>
    `,
    )
    .join("");
}

function paintActive(
  tools: HTMLElement,
  agents: HTMLElement,
  s: AgentState,
): void {
  tools.querySelectorAll<HTMLElement>(".tool-pill").forEach((pill) => {
    const name = pill.dataset.tool!;
    const dot = pill.querySelector<HTMLElement>(".dot")!;
    const status = pill.querySelector<HTMLElement>(".status")!;

    const isActive = s.activeTool === name;
    const isCompleted = s.tool_history.some((h) => h.tool === name);

    pill.classList.remove(
      "border-accent-cyan/60",
      "bg-accent-cyan/5",
      "shadow-glow",
      "border-accent-violet/40",
    );
    dot.classList.remove(
      "bg-slate-600",
      "bg-accent-cyan",
      "bg-accent-green",
      "pulse-glow",
    );

    if (isActive) {
      pill.classList.add("border-accent-cyan/60", "bg-accent-cyan/5", "shadow-glow");
      dot.classList.add("bg-accent-cyan", "pulse-glow");
      status.textContent = "running";
      status.className = "status text-[9px] uppercase tracking-wider text-accent-cyan";
    } else if (isCompleted) {
      pill.classList.add("border-accent-violet/40");
      dot.classList.add("bg-accent-green");
      const entry = s.tool_history.find((h) => h.tool === name);
      status.textContent = entry ? `${entry.durationMs}ms` : "done";
      status.className = "status text-[9px] uppercase tracking-wider text-accent-green text-mono";
    } else {
      dot.classList.add("bg-slate-600");
      status.textContent = "idle";
      status.className = "status text-[9px] uppercase tracking-wider text-slate-600";
    }
  });

  agents.querySelectorAll<HTMLElement>(".agent-pill").forEach((pill) => {
    const name = pill.dataset.agent!;
    const dot = pill.querySelector<HTMLElement>(".dot")!;
    const phaseToAgent: Record<string, string> = {
      parsing: "Planner",
      routing: "Planner",
      executing: "Executor",
      summarizing: "Summarizer",
    };
    const isActive = phaseToAgent[s.phase] === name;
    dot.classList.remove("bg-slate-600", "bg-accent-violet", "pulse-glow-violet", "bg-accent-green");
    pill.classList.remove("border-accent-violet/50", "bg-accent-violet/5");
    if (isActive) {
      dot.classList.add("bg-accent-violet", "pulse-glow-violet");
      pill.classList.add("border-accent-violet/50", "bg-accent-violet/5");
    } else {
      dot.classList.add("bg-slate-600");
    }
  });
}

function serialize(s: AgentState) {
  return {
    task: s.task,
    phase: s.phase,
    activeTool: s.activeTool,
    selectedTools: s.selectedTools,
    steps: s.steps,
    tool_history: s.tool_history.map((h) => ({
      tool: h.tool,
      owner: h.owner,
      durationMs: h.durationMs,
    })),
    final_output: s.final_output,
    totalDurationMs: s.totalDurationMs,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
