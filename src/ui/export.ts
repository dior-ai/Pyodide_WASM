import { store } from "../state/store";

export type ExportFormat = "json" | "txt";

export function exportRunReport(format: ExportFormat = "json"): void {
  const s = store.get();
  if (s.tool_history.length === 0) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "json") {
    const report = {
      generated_at: new Date().toISOString(),
      runtime: "pyodide-wasm-agent",
      task: s.task,
      phase: s.phase,
      total_duration_ms: s.totalDurationMs,
      plan: { selectedTools: s.selectedTools, steps: s.steps },
      tool_history: s.tool_history,
      logs: s.logs,
      final_output: s.final_output,
    };
    download(JSON.stringify(report, null, 2), `agent-run-${stamp}.json`, "application/json");
    return;
  }

  // TXT report — human-readable transcript.
  const lines: string[] = [];
  lines.push("PYODIDE AGENT RUNTIME — EXECUTION REPORT");
  lines.push("=".repeat(48));
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Task:      ${s.task}`);
  lines.push(`Duration:  ${s.totalDurationMs} ms`);
  lines.push(`Tools:     ${s.selectedTools.join(" → ")}`);
  lines.push("");
  lines.push("PLAN");
  lines.push("-".repeat(48));
  for (const step of s.steps) lines.push(`  • ${step}`);
  lines.push("");
  lines.push("TOOL HISTORY");
  lines.push("-".repeat(48));
  for (const h of s.tool_history) {
    lines.push(`  ${h.tool}  (${h.owner}, ${h.durationMs} ms)`);
  }
  lines.push("");
  lines.push("FINAL OUTPUT");
  lines.push("-".repeat(48));
  lines.push(s.final_output);
  lines.push("");
  lines.push("LOG");
  lines.push("-".repeat(48));
  for (const l of s.logs) {
    const t = new Date(l.ts).toTimeString().slice(0, 8);
    lines.push(`  ${t}  [${l.source}] ${l.message}`);
  }

  download(lines.join("\n"), `agent-run-${stamp}.txt`, "text/plain");
}

function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
