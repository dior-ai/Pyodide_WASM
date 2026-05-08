import { store } from "../state/store";

export function exportRunReport(): void {
  const s = store.get();
  if (s.tool_history.length === 0) return;

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

  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `agent-run-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
