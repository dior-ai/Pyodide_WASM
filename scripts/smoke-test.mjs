// Headless smoke test: boot Pyodide via the npm package (same one shipped to
// the browser), run each tool against a real workspace fixture, and assert the
// outputs make sense. This proves the Python tools work end-to-end without a
// browser. The browser path uses /pyodide/pyodide.mjs but it's the same code.

import { loadPyodide } from "pyodide";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const TOOLS = [
  "file_inspector",
  "file_counter",
  "json_validator",
  "text_analyzer",
  "csv_analyzer",
  "summarizer",
];

async function main() {
  console.log("[smoke] booting Pyodide...");
  const t0 = performance.now();
  const py = await loadPyodide({
    indexURL: resolve(root, "node_modules/pyodide") + "/",
    stdout: () => {},
    stderr: () => {},
  });
  console.log(`[smoke] pyodide ready in ${Math.round(performance.now() - t0)} ms`);

  py.runPython("import sys, json, time, io");

  console.log("[smoke] installing pandas via micropip (this can take ~10s)...");
  await py.loadPackage("micropip");
  await py.runPythonAsync(`
import micropip
await micropip.install("pandas")
`);
  console.log("[smoke] pandas ready");

  // Real workspace fixture: a CSV, a JSON, a markdown.
  const workspace = {
    files: [
      {
        id: "1",
        name: "sales.csv",
        ext: "csv",
        mime: "text/csv",
        size_bytes: 0,
        last_modified: 0,
        text: "region,units,revenue\nNA,120,4800\nEU,95,3325\nAPAC,210,9450\nNA,80,3200\nEU,140,5180\n",
        text_truncated: false,
      },
      {
        id: "2",
        name: "config.json",
        ext: "json",
        mime: "application/json",
        size_bytes: 0,
        last_modified: 0,
        text: '{"version":2,"features":{"agents":true,"telemetry":false},"limits":[1,2,3]}',
        text_truncated: false,
      },
      {
        id: "3",
        name: "notes.md",
        ext: "md",
        mime: "text/markdown",
        size_bytes: 0,
        last_modified: 0,
        text: "# Project Notes\n\nThe agent runtime executes Python directly in the browser via WebAssembly. Tools are modular. The runtime is lightweight and the architecture is enterprise-friendly.\n",
        text_truncated: false,
      },
    ],
  };

  // Make file sizes match the text length so file_counter has real numbers.
  for (const f of workspace.files) f.size_bytes = Buffer.byteLength(f.text, "utf8");

  const history = [];

  for (const tool of TOOLS) {
    const src = await readFile(resolve(root, "src/tools", `${tool}.py`), "utf8");
    const state = { task: "smoke", workspace, tool_history: history };

    py.globals.set("__agent_state_json__", JSON.stringify(state));
    py.globals.set("__tool_name__", tool);

    const driver = `
import json as _json
__state__ = _json.loads(__agent_state_json__)
${src}
__result__ = run(__state__)
__result_json__ = _json.dumps(__result__, default=str)
`;
    const t = performance.now();
    await py.runPythonAsync(driver);
    const json = py.globals.get("__result_json__");
    const ms = Math.round(performance.now() - t);
    const out = JSON.parse(json);
    history.push({ tool, owner: "Executor", durationMs: ms, output: out, startedAt: Date.now() });

    console.log(`[smoke] ✓ ${tool}.py (${ms} ms) → ${describe(out)}`);
  }

  const summary = history.find((h) => h.tool === "summarizer")?.output;
  if (!summary?.summary) throw new Error("summarizer produced no summary");
  console.log("\n[smoke] FINAL SUMMARY:");
  console.log("  " + summary.summary);

  console.log("\n[smoke] all tools OK ✓");
}

function describe(out) {
  if (!out || typeof out !== "object") return String(out);
  const keys = Object.keys(out).filter((k) => k !== "tool" && k !== "ok").slice(0, 4);
  return keys.map((k) => {
    const v = out[k];
    if (Array.isArray(v)) return `${k}=[${v.length}]`;
    if (typeof v === "object" && v !== null) return `${k}={${Object.keys(v).length}}`;
    return `${k}=${v}`;
  }).join(", ");
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
