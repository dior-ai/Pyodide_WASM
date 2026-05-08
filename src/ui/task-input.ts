import { store } from "../state/store";

export interface TaskInputCallbacks {
  onRun: (task: string) => void | Promise<void>;
  onExport: () => void;
}

const SUGGESTIONS = [
  "Analyze current files and summarize them",
  "Count the files and group them by type",
  "Inspect the workspace and produce a report",
  "How many JSON files do we have?",
];

export function mountTaskInput(root: HTMLElement, cb: TaskInputCallbacks): void {
  const el = document.createElement("section");
  el.className = "glass p-5 flex flex-col gap-3";
  el.innerHTML = /*html*/ `
    <div class="flex items-center justify-between">
      <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400">Task Input</h2>
      <span class="text-[10px] text-slate-500 text-mono">natural language → agent plan</span>
    </div>

    <div class="flex gap-2">
      <input id="task-input" type="text"
        placeholder="e.g. Analyze current files and summarize them"
        class="flex-1 bg-black/30 border border-white/10 focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/30 outline-none rounded-lg px-4 py-3 text-sm text-mono placeholder-slate-600 transition-colors"
        autocomplete="off"
        spellcheck="false"
      />
      <button id="run-btn"
        class="px-5 py-3 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/25 hover:shadow-glow transition-all text-sm font-semibold disabled:hover:bg-accent-cyan/15 disabled:hover:shadow-none">
        ▶ Run
      </button>
      <button id="export-btn"
        class="px-3 py-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all text-xs"
        title="Export the latest run as JSON">
        ⇩ Report
      </button>
    </div>

    <div id="suggestions" class="flex flex-wrap gap-1.5"></div>
  `;
  root.appendChild(el);

  const input = el.querySelector<HTMLInputElement>("#task-input")!;
  const runBtn = el.querySelector<HTMLButtonElement>("#run-btn")!;
  const exportBtn = el.querySelector<HTMLButtonElement>("#export-btn")!;
  const suggestionsEl = el.querySelector<HTMLElement>("#suggestions")!;

  for (const s of SUGGESTIONS) {
    const chip = document.createElement("button");
    chip.className =
      "text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/5 text-slate-400 hover:text-accent-cyan hover:border-accent-cyan/40 transition-colors text-mono";
    chip.textContent = s;
    chip.addEventListener("click", () => {
      input.value = s;
      input.focus();
    });
    suggestionsEl.appendChild(chip);
  }

  const trigger = async () => {
    const task = input.value.trim();
    if (!task) {
      input.focus();
      return;
    }
    if (runBtn.disabled) return;
    await cb.onRun(task);
  };

  runBtn.addEventListener("click", trigger);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trigger();
  });
  exportBtn.addEventListener("click", () => cb.onExport());

  store.subscribe((s) => {
    const busy =
      s.phase === "parsing" ||
      s.phase === "routing" ||
      s.phase === "executing" ||
      s.phase === "summarizing";
    runBtn.disabled = !s.runtime.pyodideReady || busy;
    runBtn.textContent = busy ? "● Running..." : "▶ Run";
    exportBtn.disabled = s.tool_history.length === 0;
  });
}
