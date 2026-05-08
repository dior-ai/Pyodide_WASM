import { TOOL_REGISTRY, type ToolSpec } from "../tools/registry";
import type { WorkspaceFile } from "../state/workspace";

export interface AgentPlan {
  task: string;
  intent: "analysis" | "count" | "summary" | "full_report" | "data" | "validation" | "text";
  steps: string[];
  selectedTools: ToolSpec[];
  /** Why each tool was picked — used for the routed-step explanation. */
  reasons: Record<string, string>;
}

/**
 * Heuristic intent parser that takes the *real* workspace contents into account
 * when picking tools. Always orders inspector → counter → analyzers → summarizer.
 *
 * Replaceable at runtime by the LLM-driven Claude planner.
 */
export function parseTask(rawTask: string, files: WorkspaceFile[]): AgentPlan {
  const task = rawTask.trim();
  const lower = task.toLowerCase();
  const presentExts = new Set(files.map((f) => (f.ext || "").toLowerCase()));

  const matched = new Set<ToolSpec>();
  const reasons: Record<string, string> = {};

  for (const tool of TOOL_REGISTRY) {
    const keywordHit = tool.keywords.find((k) => lower.includes(k));
    const triggerHit =
      tool.fileTriggers.includes("*") ||
      tool.fileTriggers.some((ext) => presentExts.has(ext));

    if (keywordHit && triggerHit) {
      matched.add(tool);
      reasons[tool.name] = `keyword "${keywordHit}" matched ${tool.fileTriggers.includes("*") ? "any workspace" : "files of type ." + tool.fileTriggers.join("/.")}`;
    }
  }

  // Summary always needs upstream context.
  if (matched.has(getTool("summarizer"))) {
    if (!matched.has(getTool("file_inspector"))) {
      matched.add(getTool("file_inspector"));
      reasons["file_inspector"] = "needed by summarizer for inventory context";
    }
    if (!matched.has(getTool("file_counter"))) {
      matched.add(getTool("file_counter"));
      reasons["file_counter"] = "needed by summarizer for aggregate stats";
    }
  }

  // Default plan: inspector + counter + (matching analyzers based on present file types) + summarizer.
  if (matched.size === 0) {
    matched.add(getTool("file_inspector"));
    reasons["file_inspector"] = "default — produce the inventory";
    matched.add(getTool("file_counter"));
    reasons["file_counter"] = "default — compute aggregate stats";

    if (presentExts.has("csv") || presentExts.has("tsv")) {
      matched.add(getTool("csv_analyzer"));
      reasons["csv_analyzer"] = "workspace contains CSV/TSV files";
    }
    if (presentExts.has("json")) {
      matched.add(getTool("json_validator"));
      reasons["json_validator"] = "workspace contains JSON files";
    }
    if (
      presentExts.has("md") || presentExts.has("txt") ||
      presentExts.has("rst") || presentExts.has("log") ||
      presentExts.has("html") || presentExts.has("htm")
    ) {
      matched.add(getTool("text_analyzer"));
      reasons["text_analyzer"] = "workspace contains text-like files";
    }

    matched.add(getTool("summarizer"));
    reasons["summarizer"] = "default — synthesize results into prose";
  }

  // Stable ordering: inspector → counter → validators/analyzers → summarizer.
  const order = [
    "file_inspector",
    "file_counter",
    "json_validator",
    "csv_analyzer",
    "text_analyzer",
    "summarizer",
  ];
  const selectedTools = order
    .map((n) => [...matched].find((t) => t.name === n))
    .filter((t): t is ToolSpec => Boolean(t));

  let intent: AgentPlan["intent"] = "analysis";
  if (lower.includes("count") || lower.includes("how many")) intent = "count";
  else if (lower.includes("validate") || lower.includes("json")) intent = "validation";
  else if (lower.includes("csv") || lower.includes("data")) intent = "data";
  else if (lower.includes("text") || lower.includes("markdown")) intent = "text";
  else if (selectedTools.length >= 4) intent = "full_report";
  else if (matched.has(getTool("summarizer"))) intent = "summary";

  const steps = selectedTools.map(
    (t) => `${t.owner} → ${t.name} — ${t.description}`,
  );

  return { task, intent, steps, selectedTools, reasons };
}

function getTool(name: string): ToolSpec {
  const t = TOOL_REGISTRY.find((x) => x.name === name);
  if (!t) throw new Error(`Tool not found in registry: ${name}`);
  return t;
}
