# Pyodide Agent Runtime

> A lightweight enterprise prototype demonstrating **browser-native AI agent orchestration** — Python tools executing inside WebAssembly via Pyodide, with no backend.

![Status](https://img.shields.io/badge/runtime-WebAssembly-00e5ff)
![Stack](https://img.shields.io/badge/stack-Vite%20%7C%20TS%20%7C%20Pyodide-a855f7)
![License](https://img.shields.io/badge/license-MIT-slate)

---

## What is this?

A demo of a future-facing pattern: instead of shipping AI agents as backend services, **the browser becomes the runtime.** Python tools execute client-side via Pyodide (CPython compiled to WASM), orchestrated by a lightweight TypeScript agent loop.

The user types a natural-language task. The agent parses it, picks tools from a registry, executes them as real Python in WebAssembly, and streams the lifecycle to a control-plane-style UI.

---

## Why browser-native AI matters

| Traditional | Browser-Native (this) |
|---|---|
| Python server, containers, scaling | Zero servers — runs in any modern browser |
| Cold start: seconds per pod | Cold start: one-time WASM load (~2s) |
| Code lives on a remote host | Code is auditable in the page |
| Network round-trips per tool | Sub-millisecond local calls |
| Per-tenant infrastructure | Per-user runtime, free |

This unlocks: zero-deploy edge agents, offline-capable AI workflows, sandboxed multi-tenant isolation, and dramatically lower cost-per-task.

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│  UI Shell — Header • Input • Console • Result • Sidebar
└──────────────────┬─────────────────────────────────┘
                   │ events
┌──────────────────▼─────────────────────────────────┐
│  AgentController                                   │
│   ├─ TaskParser     (natural language → plan)      │
│   ├─ ToolRouter     (plan → tool selection)        │
│   ├─ ExecutionEngine (calls into Pyodide)          │
│   └─ StateStore     (task, steps, history)         │
└──────────────────┬─────────────────────────────────┘
                   │ runPython(...)
┌──────────────────▼─────────────────────────────────┐
│  Pyodide Runtime (WebAssembly)                     │
│   └─ tools/  file_inspector  file_counter  summarizer
└────────────────────────────────────────────────────┘
```

Every tool is a Python module with a uniform contract:

```python
def run(state: dict) -> dict:
    ...
```

The TypeScript-side `ToolRouter` only knows tool *names* and *descriptions* — exactly how a real agent framework works.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

Pyodide is loaded from a CDN, so no Python toolchain is required on your machine.

---

## Project layout

```
src/
├── main.ts                  # entry — boots Pyodide, mounts UI
├── agent/
│   ├── controller.ts        # the orchestration loop
│   ├── parser.ts            # intent → plan
│   └── router.ts            # tool selection
├── runtime/
│   ├── pyodide-loader.ts    # async load + warmup
│   └── bridge.ts            # JS ↔ Python marshaling
├── tools/
│   ├── registry.ts          # TS-side metadata
│   ├── file_inspector.py
│   ├── file_counter.py
│   └── summarizer.py
├── state/store.ts           # tiny reactive store
├── ui/                      # header, input, console, result, sidebar
└── styles/                  # design tokens + globals
```

---

## Demo scenario

1. Page loads → status pill flips `LOADING → READY` once WASM is live
2. User types: **`Analyze current files and summarize them`**
3. The console streams the agent lifecycle:
   ```
   [Planner]    Parsing task intent...
   [Planner]    Plan: inspect → count → summarize
   [Executor]   → file_inspector.py (Pyodide, 12 ms)
   [Executor]   → file_counter.py   (Pyodide,  4 ms)
   [Summarizer] → summarizer.py     (Pyodide, 81 ms)
   [Result]     ✓ Done (97 ms total)
   ```
4. Result panel renders the human-readable summary
5. Right rail shows the live state JSON
6. **Export Report** turns the run into a JSON or TXT artifact

---

## Future scalability

This prototype is intentionally minimal. The architecture extends naturally to:

- **LLM-driven planning** — swap the keyword parser for a Claude API call that emits a structured plan
- **Plugin marketplace** — load tool packages (`.whl` or remote `.py`) at runtime via `pyodide.loadPackage`
- **Per-tab isolation** — each browser tab is a sandboxed agent; no shared state, no noisy neighbors
- **Edge deployment** — ship the entire app as static assets to Cloudflare Pages / Vercel / S3
- **Hybrid mode** — heavy tools call out to a backend, lightweight ones stay local

---

## Tech stack

- **Pyodide 0.26** — CPython 3.12 compiled to WebAssembly
- **TypeScript 5** — strict mode, ESM-native
- **Vite 5** — sub-second HMR, zero-config build
- **TailwindCSS 3** — design tokens for glassmorphism + neon accents
- **No framework** — a ~30-LOC pub/sub store keeps the bundle lean

---

## License

MIT
