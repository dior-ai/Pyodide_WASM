import type { PyodideInterface } from "./pyodide-loader";
import { store } from "../state/store";

export interface ReplResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  value: string | null;
  durationMs: number;
}

/**
 * Executes arbitrary Python code in the same Pyodide instance the agent uses.
 * The current workspace is exposed as a global `workspace` (a list of dicts).
 * stdout/stderr are captured for the duration of the run.
 */
export async function runRepl(
  pyodide: PyodideInterface,
  code: string,
): Promise<ReplResult> {
  const t0 = performance.now();

  const workspace = store.get().workspace.files;
  pyodide.globals.set("__workspace_json__", JSON.stringify({ files: workspace }));

  const wrapper = `
import sys, io, json as _json
__buf_out = io.StringIO()
__buf_err = io.StringIO()
__old_out, __old_err = sys.stdout, sys.stderr
sys.stdout, sys.stderr = __buf_out, __buf_err
__last_value__ = None
try:
    workspace = _json.loads(__workspace_json__)["files"]
    __compiled = compile(${JSON.stringify(code)}, "<repl>", "exec")
    __ns = {"workspace": workspace, "__name__": "__repl__"}
    exec(__compiled, __ns)
    if "_" in __ns:
        try:
            __last_value__ = repr(__ns["_"])
        except Exception:
            __last_value__ = None
finally:
    sys.stdout, sys.stderr = __old_out, __old_err
__repl_stdout__ = __buf_out.getvalue()
__repl_stderr__ = __buf_err.getvalue()
`;

  try {
    await pyodide.runPythonAsync(wrapper);
    const stdout = (pyodide.globals.get("__repl_stdout__") as string) ?? "";
    const stderr = (pyodide.globals.get("__repl_stderr__") as string) ?? "";
    const value = (pyodide.globals.get("__last_value__") as string | null) ?? null;
    return {
      ok: true,
      stdout,
      stderr,
      value,
      durationMs: Math.round(performance.now() - t0),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      stdout: "",
      stderr: message,
      value: null,
      durationMs: Math.round(performance.now() - t0),
    };
  }
}
