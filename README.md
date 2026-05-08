# Pyodide Agent Runtime

> A lightweight enterprise prototype demonstrating **browser-native AI agent orchestration** — real Python tools executing on **real user files** inside WebAssembly via Pyodide, with no backend.

![Status](https://img.shields.io/badge/runtime-WebAssembly-00e5ff)
![Stack](https://img.shields.io/badge/stack-Vite%20%7C%20TS%20%7C%20Pyodide%20npm-a855f7)
![Smoke](https://img.shields.io/badge/end--to--end-tested-34d399)

---

## What is this?

A demo of a future-facing pattern: **the browser becomes the AI runtime.** Python tools execute client-side in WebAssembly via Pyodide, orchestrated by a TypeScript agent loop. Files the user drops are read in JavaScript, handed to Python, and analyzed for real — no server roundtrip, no upload.

The user drops files, types a natural-language task, and the agent:

1. picks tools from a registry (heuristic *or* Claude-driven)
2. lazily installs any required PyPI packages (pandas, etc.) via `micropip`
3. executes the tool chain as real Python in WASM
4. streams the lifecycle to a control-plane-style UI

A live Python REPL ships alongside, so any viewer can immediately verify that **real CPython is running in the page**.

---

## Why browser-native AI matters

| Traditional | Browser-Native (this) |
|---|---|
| Python server, containers, scaling | Zero servers — runs in any modern browser |
| Cold start: seconds per pod | Cold start: one-time WASM load (~2s) |
| Code lives on a remote host | Code is auditable in the page |
| Network round-trips per tool | Sub-millisecond local calls |
| Per-tenant infrastructure | Per-user runtime, free |
| Files uploaded → privacy review | Files never leave the device |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  UI Shell — Header • Workspace • Input • Console •    │
│             Result • REPL • Sidebar (live state JSON) │
└──────────────────┬───────────────────────────────────┘
                   │ events
┌──────────────────▼───────────────────────────────────┐
│  AgentController                                     │
│   ├─ Planner ──┬─ Heuristic parser (default)         │
│   │            └─ Claude API (opt-in, sonnet-4-6)    │
│   ├─ ToolRouter      (plan → ordered tool calls)     │
│   ├─ ExecutionEngine (calls into Pyodide)            │
│   └─ StateStore      (task, steps, history, logs)    │
└──────────────────┬───────────────────────────────────┘
                   │ runPython(...)
┌──────────────────▼───────────────────────────────────┐
│  Pyodide Runtime  (CPython 3.12 in WebAssembly)      │
│   ├─ micropip → installs pandas etc on demand        │
│   └─ tools/                                          │
│      file_inspector  file_counter  json_validator    │
│      text_analyzer   csv_analyzer  summarizer        │
└──────────────────────────────────────────────────────┘
```

Every tool is a Python module with a uniform contract:

```python
def run(state: dict) -> dict:
    ...
```

The TS-side `ToolRouter` only knows tool *names*, *descriptions*, *file triggers*, and *Python deps* — exactly how a real agent framework works.

---

## Tech stack (verified, not aspirational)

| Layer | Tech | Where |
|---|---|---|
| Runtime | **Pyodide 0.26.x** (CPython 3.12 → WASM) | `dependencies` in `package.json` |
| Self-hosting | WASM + `python_stdlib.zip` copied to `public/pyodide/` | `scripts/copy-pyodide.mjs`, runs on `predev`/`prebuild` |
| Loader | runtime dynamic import of `/pyodide/pyodide.mjs` | `src/runtime/pyodide-loader.ts` |
| Package mgmt | `micropip` for runtime PyPI installs | `csv_analyzer` pulls pandas on first use |
| Frontend | TypeScript 5 (strict) | |
| Build | Vite 8 | |
| Styling | Tailwind 3 + custom design tokens | glassmorphism, neon, animated grid |
| State | ~140-LOC pub/sub store | `src/state/store.ts` |
| Optional planner | Claude `sonnet-4-6` via `tool_use` | direct browser → Anthropic |

**Pyodide is a real npm dependency**, not a CDN `<script>`. After `npm install`, the WASM and Python stdlib live under `public/pyodide/` (gitignored, regenerated on each install).

---

## Quick start

```bash
npm install            # also runs scripts/copy-pyodide.mjs
npm run dev            # → http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

Headless end-to-end smoke test (boots Pyodide in Node, runs every tool against a real fixture, exercises the REPL):

```bash
node scripts/smoke-test.mjs
```

---

## Project layout

```
src/
├── main.ts                    # entry — boots Pyodide, mounts UI
├── agent/
│   ├── controller.ts          # the orchestration loop
│   ├── parser.ts              # heuristic intent → plan
│   ├── router.ts              # ordered tool execution
│   └── claude-planner.ts      # opt-in Claude tool_use planner
├── runtime/
│   ├── pyodide-loader.ts      # async load + warmup + ensurePackage()
│   ├── bridge.ts              # JS ↔ Python state marshaling
│   └── repl.ts                # arbitrary Python execution + capture
├── tools/
│   ├── registry.ts            # TS-side metadata
│   ├── file_inspector.py      # real ext/mime/size + content preview
│   ├── file_counter.py        # real type/size aggregates
│   ├── json_validator.py      # parses real .json files
│   ├── text_analyzer.py       # real word/keyword statistics
│   ├── csv_analyzer.py        # real pandas describe() / dtypes
│   └── summarizer.py          # synthesizes prior outputs into prose
├── state/
│   ├── store.ts               # tiny reactive store
│   └── workspace.ts           # File API ingestion
├── ui/
│   ├── header.ts  task-input.ts  console.ts  result-panel.ts
│   ├── tool-sidebar.ts  phase-flow.ts  workspace-panel.ts
│   ├── repl-panel.ts  claude-key.ts  export.ts
└── styles/                    # design tokens + globals
scripts/
├── copy-pyodide.mjs           # node_modules/pyodide → public/pyodide
└── smoke-test.mjs             # e2e Pyodide test (no browser needed)
```

---

## Demo scenario

1. Page loads → status pill flips `LOADING → READY` once WASM is live (~2s).
2. User drags files into the **Workspace** panel — say `sales.csv` + `notes.md` + `config.json`.
3. User types: **`Analyze the CSV and summarize`**.
4. Console streams the agent lifecycle:
   ```
   [Planner]    Received task: "Analyze the CSV and summarize"
   [Planner]    Plan resolved (full_report): file_inspector → file_counter → json_validator → csv_analyzer → text_analyzer → summarizer
   [ToolRouter] Routed 6 steps.
   [Executor]   → file_inspector.py — real metadata sniff
   [Pyodide]    Executed file_inspector in WASM (24 ms)
   [Pyodide]    micropip → installing pandas...
   [Pyodide]    pandas ready (4612 ms)
   [Executor]   → csv_analyzer.py — pandas analysis
   [Pyodide]    Executed csv_analyzer in WASM (98 ms)
   ...
   [Result]     ✓ Done (5234 ms total)
   ```
5. Result panel renders the multi-paragraph summary plus KPI cards.
6. Right rail shows the live state JSON (task, plan, tool history with timings).
7. **Python REPL** lets the user write arbitrary Python against the same workspace:
   ```python
   for f in workspace:
       if f['ext'] == 'csv':
           print(f['text'][:200])
   ```
8. **Export Report** downloads JSON or human-readable TXT.

---

## Optional: Claude planning

Paste an Anthropic API key into the planner control. The next run will:

- replace the keyword heuristic with a `claude-sonnet-4-6` call
- send the task + a metadata-only summary of the workspace + the tool catalog
- force structured output via Anthropic's `tool_use` mechanism (no prose-parsing)

The key is stored in your browser's `localStorage` and the request goes directly to `api.anthropic.com` — there is still no backend in this app.

---

## What's been verified

The repo includes `scripts/smoke-test.mjs` which boots the same Pyodide npm package headlessly and runs:

- all 6 tools end-to-end against a real CSV + JSON + Markdown fixture
- the REPL path with stdout capture
- pandas installation via `micropip`

Output is asserted, not printed-and-hoped. Run it locally:

```bash
node scripts/smoke-test.mjs
# [smoke] all tools + REPL OK ✓
```

---

## Future scalability

- **Folder picker via File System Access API** (Chromium): drop entire directories, recurse via `showDirectoryPicker()`.
- **Plugin marketplace** — load tool packages (`.whl` or remote `.py`) at runtime via `pyodide.loadPackage`.
- **Per-tab isolation** — each browser tab is a sandboxed agent; no shared state.
- **Edge deployment** — ship the entire app as static assets to Cloudflare Pages / Vercel / S3.
- **Hybrid mode** — heavy tools call out to a backend, lightweight ones stay local.
- **WebGPU acceleration** — Pyodide is exploring WebGPU bindings; numerical workloads will eventually rival native.

---

## License

MIT
