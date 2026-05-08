import { type PyodideInterface, ensurePackage } from "../runtime/pyodide-loader";
import { executePythonTool } from "../runtime/bridge";
import { store } from "../state/store";
import { parseTask } from "./parser";
import { route } from "./router";

const PHASE_DELAY_MS = 220;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunOptions {
  task: string;
  pyodide: PyodideInterface;
}

export async function runAgent({ task, pyodide }: RunOptions): Promise<void> {
  const t0 = performance.now();

  store.reset();
  store.set({ task, phase: "parsing", final_output: "" });

  if (store.get().workspace.files.length === 0) {
    log(
      "Planner",
      "warn",
      "Workspace is empty — drop or pick at least one file before running the agent.",
    );
    store.set({ phase: "error" });
    return;
  }

  log("Planner", "info", `Received task: "${task}"`);
  log("Planner", "info", "Parsing natural language intent...");
  await sleep(PHASE_DELAY_MS);

  const plan = parseTask(task, store.get().workspace.files);
  store.set({
    steps: plan.steps,
    selectedTools: plan.selectedTools.map((t) => t.name),
    phase: "routing",
  });
  log(
    "Planner",
    "ok",
    `Plan resolved (${plan.intent}): ${plan.selectedTools
      .map((t) => t.name)
      .join(" → ")}`,
  );
  await sleep(PHASE_DELAY_MS);

  const routed = route(plan.selectedTools, plan.reasons);
  log(
    "ToolRouter",
    "ok",
    `Routed ${routed.length} step${routed.length === 1 ? "" : "s"}.`,
  );
  await sleep(PHASE_DELAY_MS);

  store.set({ phase: "executing" });

  for (const step of routed) {
    store.set({ activeTool: step.tool.name });
    log(step.tool.owner, "info", `→ ${step.tool.name}.py — ${step.reason}`);

    // Lazy-install any PyPI dependencies declared by the tool.
    if (step.tool.pythonPackages?.length) {
      for (const pkg of step.tool.pythonPackages) {
        log("Pyodide", "info", `micropip → installing ${pkg}...`);
        const tInstall = performance.now();
        try {
          await ensurePackage(pyodide, pkg);
          log(
            "Pyodide",
            "ok",
            `${pkg} ready (${Math.round(performance.now() - tInstall)} ms)`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log("Pyodide", "error", `Failed to install ${pkg}: ${msg}`);
          store.set({ phase: "error", activeTool: null });
          return;
        }
      }
    }

    try {
      const stateSnapshot = {
        task,
        workspace: store.get().workspace,
        tool_history: store.get().tool_history,
      };

      const { output, durationMs } = await executePythonTool(
        pyodide,
        step.tool.name,
        step.tool.source,
        stateSnapshot,
      );

      store.pushHistory({
        tool: step.tool.name,
        owner: step.tool.owner,
        startedAt: Date.now(),
        durationMs,
        output,
      });

      log(
        "Pyodide",
        "ok",
        `Executed ${step.tool.name} in WASM (${durationMs} ms)`,
      );

      if (step.tool.kind === "summarizer" && typeof output["summary"] === "string") {
        store.set({
          phase: "summarizing",
          final_output: output["summary"] as string,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("Pyodide", "error", `Tool ${step.tool.name} failed: ${message}`);
      store.set({ phase: "error", activeTool: null });
      return;
    }

    await sleep(PHASE_DELAY_MS / 2);
  }

  store.set({ activeTool: null });

  if (!store.get().final_output) {
    const last = store.get().tool_history.at(-1);
    store.set({
      final_output:
        (last?.output["summary"] as string) ||
        `Completed ${routed.length} tool execution${routed.length === 1 ? "" : "s"}.`,
    });
  }

  const totalDurationMs = Math.round(performance.now() - t0);
  store.set({ phase: "done", totalDurationMs });
  log("Result", "ok", `✓ Done (${totalDurationMs} ms total)`);
}

function log(
  source: string,
  level: "info" | "ok" | "warn" | "error",
  message: string,
): void {
  store.pushLog({ source, level, message });
}
