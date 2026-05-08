import { getStoredKey, setStoredKey } from "../agent/claude-planner";
import { store } from "../state/store";

export function mountClaudeKeyControl(root: HTMLElement): void {
  const el = document.createElement("section");
  el.className = "glass px-4 py-2.5 flex items-center gap-3 flex-wrap";
  el.innerHTML = /*html*/ `
    <div class="flex items-center gap-2">
      <span id="ck-dot" class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
      <span class="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">Planner</span>
      <span id="ck-status" class="text-[11px] text-slate-500"></span>
    </div>
    <div class="flex-1 min-w-[200px] flex items-center gap-2">
      <input id="ck-input" type="password" autocomplete="off" spellcheck="false"
        placeholder="(optional) sk-ant-... — enables Claude-driven planning"
        class="flex-1 bg-black/30 border border-white/10 focus:border-accent-violet/50 outline-none rounded-md px-3 py-1.5 text-[11.5px] text-mono placeholder-slate-600"
      />
      <button id="ck-save" class="text-[11px] px-3 py-1.5 rounded-md bg-accent-violet/15 border border-accent-violet/40 text-accent-violet hover:bg-accent-violet/25 transition-colors">save</button>
      <button id="ck-clear" class="text-[11px] px-2 py-1.5 text-slate-500 hover:text-accent-rose transition-colors">forget</button>
    </div>
    <p class="text-[10px] text-slate-600 w-full">
      Stored only in this browser's localStorage. Calls go directly from your browser to api.anthropic.com — no server in between.
    </p>
  `;
  root.appendChild(el);

  const dot = el.querySelector<HTMLElement>("#ck-dot")!;
  const status = el.querySelector<HTMLElement>("#ck-status")!;
  const input = el.querySelector<HTMLInputElement>("#ck-input")!;
  const saveBtn = el.querySelector<HTMLButtonElement>("#ck-save")!;
  const clearBtn = el.querySelector<HTMLButtonElement>("#ck-clear")!;

  const refresh = () => {
    const key = getStoredKey();
    if (key) {
      dot.className = "w-1.5 h-1.5 rounded-full bg-accent-violet pulse-glow-violet";
      status.textContent = `Claude (sonnet-4-6) — key …${key.slice(-4)}`;
      input.value = "";
      input.placeholder = "key saved — paste a new one to replace";
    } else {
      dot.className = "w-1.5 h-1.5 rounded-full bg-slate-600";
      status.textContent = "heuristic (no API key)";
      input.placeholder = "(optional) sk-ant-... — enables Claude-driven planning";
    }
  };

  saveBtn.addEventListener("click", () => {
    const key = input.value.trim();
    if (!key) return;
    if (!key.startsWith("sk-ant-")) {
      store.pushLog({
        source: "Planner",
        level: "warn",
        message: "Anthropic keys typically start with sk-ant-. Saving anyway.",
      });
    }
    setStoredKey(key);
    store.pushLog({
      source: "Planner",
      level: "ok",
      message: "Anthropic API key saved. Next run will use Claude for planning.",
    });
    refresh();
  });

  clearBtn.addEventListener("click", () => {
    setStoredKey(null);
    store.pushLog({
      source: "Planner",
      level: "info",
      message: "Anthropic API key cleared. Reverting to heuristic planner.",
    });
    refresh();
  });

  refresh();
}
