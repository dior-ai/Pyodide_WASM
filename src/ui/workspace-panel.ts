import { store } from "../state/store";
import { ingestFile, type WorkspaceFile } from "../state/workspace";

export function mountWorkspacePanel(root: HTMLElement): void {
  const el = document.createElement("section");
  el.className = "glass p-4 flex flex-col gap-3";
  el.innerHTML = /*html*/ `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace</h2>
        <p class="text-[10px] text-slate-500 mt-0.5">
          Drop real files — the agent will analyze the actual bytes in your browser.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button id="ws-clear"
          class="text-[10px] text-slate-500 hover:text-accent-rose transition-colors px-2 py-1 hidden">
          clear all
        </button>
        <label class="cursor-pointer text-[11px] px-3 py-1.5 rounded-md bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/25 transition-colors">
          ＋ Add files
          <input id="ws-input" type="file" multiple class="hidden" />
        </label>
      </div>
    </div>

    <div id="ws-drop"
      class="rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center text-xs text-slate-500 transition-colors">
      <span class="text-slate-400">Drop files here</span>
      <span class="text-slate-600"> · CSV, JSON, MD, TXT, code, anything</span>
    </div>

    <div id="ws-list" class="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto thin-scroll"></div>

    <div id="ws-empty" class="text-[11px] text-slate-600 italic px-1">
      No files loaded yet. The agent has no real input until you add some.
    </div>
  `;
  root.appendChild(el);

  const dropZone = el.querySelector<HTMLElement>("#ws-drop")!;
  const fileInput = el.querySelector<HTMLInputElement>("#ws-input")!;
  const list = el.querySelector<HTMLElement>("#ws-list")!;
  const empty = el.querySelector<HTMLElement>("#ws-empty")!;
  const clearBtn = el.querySelector<HTMLButtonElement>("#ws-clear")!;

  fileInput.addEventListener("change", async () => {
    if (fileInput.files) await ingestFiles(Array.from(fileInput.files));
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("border-accent-cyan/60", "bg-accent-cyan/5");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-accent-cyan/60", "bg-accent-cyan/5");
    });
  });
  dropZone.addEventListener("drop", async (e: DragEvent) => {
    if (!e.dataTransfer) return;
    const files = Array.from(e.dataTransfer.files);
    await ingestFiles(files);
  });

  clearBtn.addEventListener("click", () => store.clearWorkspace());

  store.subscribe((s) => render(s.workspace.files, list, empty, clearBtn));
}

async function ingestFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  const ingested: WorkspaceFile[] = [];
  for (const f of files) {
    try {
      ingested.push(await ingestFile(f));
    } catch (err) {
      console.warn("[workspace] failed to ingest", f.name, err);
    }
  }
  store.addWorkspaceFiles(ingested);
  store.pushLog({
    source: "Workspace",
    level: "ok",
    message: `Loaded ${ingested.length} file${ingested.length === 1 ? "" : "s"} into the workspace.`,
  });
}

function render(
  files: WorkspaceFile[],
  list: HTMLElement,
  empty: HTMLElement,
  clearBtn: HTMLButtonElement,
): void {
  empty.classList.toggle("hidden", files.length > 0);
  clearBtn.classList.toggle("hidden", files.length === 0);

  list.innerHTML = files
    .map(
      (f) => /*html*/ `
      <div class="flex items-center gap-2 px-2 py-1.5 rounded border border-white/5 bg-black/20 text-[11.5px] text-mono">
        <span class="text-accent-cyan w-10 flex-shrink-0">.${escapeHtml(f.ext || "?")}</span>
        <span class="text-slate-200 flex-1 truncate" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="text-slate-500 flex-shrink-0 text-[10.5px]">${humanBytes(f.size_bytes)}</span>
        <button data-id="${f.id}" class="ws-rm text-slate-600 hover:text-accent-rose transition-colors flex-shrink-0">×</button>
      </div>`,
    )
    .join("");

  list.querySelectorAll<HTMLButtonElement>(".ws-rm").forEach((btn) => {
    btn.addEventListener("click", () => store.removeWorkspaceFile(btn.dataset.id!));
  });
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
