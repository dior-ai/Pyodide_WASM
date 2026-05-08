import { TOOL_REGISTRY, type ToolSpec } from "../tools/registry";

export interface AgentPlan {
  task: string;
  intent: "analysis" | "count" | "summary" | "full_report";
  steps: string[];
  selectedTools: ToolSpec[];
}

/**
 * Lightweight intent parser. Picks tools by keyword overlap, then orders them
 * inspector → counter → summarizer to match a realistic dependency graph.
 *
 * In a production system this would be replaced by a structured-output LLM call.
 */
export function parseTask(rawTask: string): AgentPlan {
  const task = rawTask.trim();
  const lower = task.toLowerCase();

  const matched = new Set<ToolSpec>();
  for (const tool of TOOL_REGISTRY) {
    if (tool.keywords.some((k) => lower.includes(k))) matched.add(tool);
  }

  // If the user asked for a summary, we always need inspector + counter as inputs.
  if (matched.has(getTool("summarizer"))) {
    matched.add(getTool("file_inspector"));
    matched.add(getTool("file_counter"));
  }

  // Default: nothing matched → assume "full report" so the demo always shows depth.
  if (matched.size === 0) {
    matched.add(getTool("file_inspector"));
    matched.add(getTool("file_counter"));
    matched.add(getTool("summarizer"));
  }

  const order = ["file_inspector", "file_counter", "summarizer"];
  const selectedTools = order
    .map((n) => [...matched].find((t) => t.name === n))
    .filter((t): t is ToolSpec => Boolean(t));

  let intent: AgentPlan["intent"] = "analysis";
  if (selectedTools.length === 1 && selectedTools[0].name === "file_counter") {
    intent = "count";
  } else if (
    selectedTools.length === 1 &&
    selectedTools[0].name === "summarizer"
  ) {
    intent = "summary";
  } else if (selectedTools.length >= 3) {
    intent = "full_report";
  }

  const steps = selectedTools.map(
    (t) => `${t.owner} → ${t.name} — ${t.description}`,
  );

  return { task, intent, steps, selectedTools };
}

function getTool(name: string): ToolSpec {
  const t = TOOL_REGISTRY.find((x) => x.name === name);
  if (!t) throw new Error(`Tool not found in registry: ${name}`);
  return t;
}
