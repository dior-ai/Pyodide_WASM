import { store, type AgentPhase } from "../state/store";

interface FlowStep {
  id: AgentPhase;
  label: string;
  hint: string;
}

const FLOW: FlowStep[] = [
  { id: "parsing", label: "Plan", hint: "intent → plan" },
  { id: "routing", label: "Route", hint: "plan → tools" },
  { id: "executing", label: "Execute", hint: "tools in WASM" },
  { id: "summarizing", label: "Summarize", hint: "→ prose" },
  { id: "done", label: "Done", hint: "report ready" },
];

const ORDER = FLOW.map((f) => f.id);

export function mountPhaseFlow(root: HTMLElement): void {
  const el = document.createElement("section");
  el.className = "glass px-5 py-3";
  el.innerHTML = /*html*/ `
    <div class="flex items-center gap-2 overflow-x-auto thin-scroll">
      ${FLOW.map(
        (f, i) => /*html*/ `
        <div class="flex items-center gap-2 flex-shrink-0" data-step="${f.id}">
          <div class="step flex flex-col items-start">
            <div class="flex items-center gap-2">
              <span class="dot w-1.5 h-1.5 rounded-full bg-slate-700 transition-colors"></span>
              <span class="label text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold transition-colors">${f.label}</span>
            </div>
            <span class="text-[9px] text-slate-600 ml-3.5">${f.hint}</span>
          </div>
          ${
            i < FLOW.length - 1
              ? `<svg width="36" height="10" class="connector flex-shrink-0">
                   <line class="line" x1="2" y1="5" x2="34" y2="5"
                     stroke="currentColor" stroke-width="1.5"
                     stroke-dasharray="4 4" />
                 </svg>`
              : ""
          }
        </div>
      `,
      ).join("")}
    </div>
  `;
  root.appendChild(el);

  store.subscribe((s) => paint(el, s.phase));
}

function paint(el: HTMLElement, phase: AgentPhase): void {
  const activeIdx = ORDER.indexOf(phase);
  el.querySelectorAll<HTMLElement>("[data-step]").forEach((node, i) => {
    const dot = node.querySelector<HTMLElement>(".dot")!;
    const label = node.querySelector<HTMLElement>(".label")!;
    const connector = node.querySelector<HTMLElement>(".connector");

    dot.classList.remove("bg-slate-700", "bg-accent-cyan", "bg-accent-violet", "bg-accent-green", "pulse-glow");
    label.classList.remove("text-slate-500", "text-accent-cyan", "text-accent-violet", "text-accent-green");

    if (activeIdx === -1) {
      dot.classList.add("bg-slate-700");
      label.classList.add("text-slate-500");
    } else if (i < activeIdx) {
      dot.classList.add("bg-accent-violet");
      label.classList.add("text-accent-violet");
    } else if (i === activeIdx) {
      dot.classList.add("bg-accent-cyan", "pulse-glow");
      label.classList.add("text-accent-cyan");
    } else {
      dot.classList.add("bg-slate-700");
      label.classList.add("text-slate-500");
    }

    if (connector) {
      const line = connector.querySelector<SVGElement>(".line")!;
      line.style.color =
        i < activeIdx ? "rgba(168, 85, 247, 0.55)" : "rgba(148, 163, 184, 0.18)";
    }
  });
}
