import { runRepl } from "../runtime/repl";
import type { PyodideInterface } from "../runtime/pyodide-loader";
import { store } from "../state/store";

const STARTER = `# This is real CPython 3.12 running in WebAssembly.
# 'workspace' is bound to the files you've loaded.

print(f"workspace has {len(workspace)} file(s)")
for f in workspace:
    print(f"  {f['name']:<28} {f['size_bytes']:>8} bytes  ({f.get('mime') or '?'})")

# Show first 200 chars of any markdown file
for f in workspace:
    if f.get('ext') == 'md' and f.get('text'):
        print('---'); print(f['text'][:200])
        break
`;

export interface ReplCallbacks {
  getPyodide: () => PyodideInterface | null;
}

interface Entry {
  code: string;
  result: {
    ok: boolean;
    stdout: string;
    stderr: string;
    value: string | null;
    durationMs: number;
  };
}

export function mountReplPanel(root: HTMLElement, cb: ReplCallbacks): void {
  const el = document.createElement("section");
  el.className = "glass p-4 flex flex-col gap-3";
  el.innerHTML = /*html*/ `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-accent-violet pulse-glow-violet"></span>
        <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400">Python REPL</h2>
        <span class="text-[10px] text-slate-500">· same Pyodide instance the agent uses</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-slate-600 text-mono hidden sm:inline">⌘/Ctrl+Enter to run</span>
        <button id="repl-clear" class="text-[10px] text-slate-500 hover:text-accent-rose px-2 py-1">clear</button>
        <button id="repl-run" class="text-[11px] px-3 py-1.5 rounded-md bg-accent-violet/15 border border-accent-violet/40 text-accent-violet hover:bg-accent-violet/25 transition-colors">▶ Run</button>
      </div>
    </div>

    <textarea id="repl-input" spellcheck="false" autocomplete="off"
      class="w-full bg-black/40 border border-white/10 focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/30 outline-none rounded-lg px-3 py-2.5 text-[12.5px] text-mono text-slate-200 leading-relaxed resize-y min-h-[140px]"
    ></textarea>

    <div id="repl-history" class="flex flex-col gap-2 max-h-[280px] overflow-y-auto thin-scroll"></div>
  `;
  root.appendChild(el);

  const input = el.querySelector<HTMLTextAreaElement>("#repl-input")!;
  const history = el.querySelector<HTMLElement>("#repl-history")!;
  const runBtn = el.querySelector<HTMLButtonElement>("#repl-run")!;
  const clearBtn = el.querySelector<HTMLButtonElement>("#repl-clear")!;

  input.value = STARTER;

  const entries: Entry[] = [];

  const exec = async () => {
    const code = input.value;
    if (!code.trim()) return;
    const py = cb.getPyodide();
    if (!py) {
      store.pushLog({
        source: "REPL",
        level: "error",
        message: "Runtime not ready yet.",
      });
      return;
    }
    runBtn.disabled = true;
    runBtn.textContent = "● Running...";
    try {
      const result = await runRepl(py, code);
      entries.unshift({ code, result });
      renderHistory(history, entries);
      store.pushLog({
        source: "REPL",
        level: result.ok ? "ok" : "error",
        message: `Ran ${code.split("\n").length} line(s) in ${result.durationMs} ms.`,
      });
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = "▶ Run";
    }
  };

  runBtn.addEventListener("click", exec);
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      exec();
    }
  });
  clearBtn.addEventListener("click", () => {
    entries.length = 0;
    renderHistory(history, entries);
  });

  store.subscribe((s) => {
    runBtn.disabled = !s.runtime.pyodideReady;
  });
}

function renderHistory(root: HTMLElement, entries: Entry[]): void {
  if (entries.length === 0) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = entries
    .map(({ code, result }) => {
      const codePreview = code.length > 240 ? code.slice(0, 240) + "..." : code;
      const stdout = result.stdout ? esc(result.stdout) : "";
      const stderr = result.stderr ? esc(result.stderr) : "";
      const value = result.value ? esc(result.value) : "";
      return /*html*/ `
      <div class="rounded-lg border border-white/5 bg-black/30 overflow-hidden">
        <div class="px-3 py-1.5 flex items-center justify-between border-b border-white/5">
          <span class="text-[10px] uppercase tracking-wider ${result.ok ? "text-accent-green" : "text-accent-rose"}">
            ${result.ok ? "ok" : "error"}
          </span>
          <span class="text-[10px] text-slate-500 text-mono">${result.durationMs} ms</span>
        </div>
        <pre class="px-3 py-2 text-[11.5px] text-mono text-slate-400 whitespace-pre-wrap border-b border-white/5">${esc(codePreview)}</pre>
        ${stdout ? `<pre class="px-3 py-2 text-[12px] text-mono text-slate-200 whitespace-pre-wrap">${stdout}</pre>` : ""}
        ${value ? `<pre class="px-3 py-2 text-[12px] text-mono text-accent-cyan whitespace-pre-wrap border-t border-white/5">↵ ${value}</pre>` : ""}
        ${stderr ? `<pre class="px-3 py-2 text-[12px] text-mono text-accent-rose whitespace-pre-wrap border-t border-white/5">${stderr}</pre>` : ""}
      </div>`;
    })
    .join("");
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
