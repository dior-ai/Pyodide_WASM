import type { PyodideInterface } from "./pyodide-loader";

export interface ToolExecutionResult {
  output: Record<string, unknown>;
  durationMs: number;
}

/**
 * Loads a tool's Python source into Pyodide and invokes its `run(state)` entry point.
 * Returns the result and a measured execution duration in milliseconds.
 */
export async function executePythonTool(
  pyodide: PyodideInterface,
  toolName: string,
  toolSource: string,
  state: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const t0 = performance.now();

  // Marshal the JS state into the Python global namespace.
  pyodide.globals.set("__agent_state_json__", JSON.stringify(state));
  pyodide.globals.set("__tool_name__", toolName);

  const driver = `
import json as _json
__state__ = _json.loads(__agent_state_json__)
${toolSource}
__result__ = run(__state__)
__result_json__ = _json.dumps(__result__, default=str)
`;

  await pyodide.runPythonAsync(driver);
  const resultJson = pyodide.globals.get("__result_json__") as string;
  const durationMs = Math.round(performance.now() - t0);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(resultJson);
  } catch {
    parsed = { raw: resultJson };
  }

  return { output: parsed, durationMs };
}
