// Optional LLM-driven planner. Uses Anthropic's Claude API to convert a
// natural-language task + the real workspace contents into a structured
// JSON plan. Falls back to the heuristic parser on any failure.
//
// SECURITY NOTE: this is a browser-side fetch with the user's own API key,
// stored in localStorage. That's appropriate for a self-served demo where
// the user owns the key — it would NOT be appropriate to ship a hardcoded
// key. The "no backend" pitch holds because the request goes browser →
// Anthropic directly.

import { TOOL_REGISTRY, type ToolSpec } from "../tools/registry";
import type { WorkspaceFile } from "../state/workspace";
import type { AgentPlan } from "./parser";

const MODEL = "claude-sonnet-4-6";
const STORAGE_KEY = "pyodide-agent.anthropic-key";

export function getStoredKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode etc. — ignore */
  }
}

interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: { tools_in_order?: string[]; rationale?: string };
}

interface ClaudeMessageResponse {
  content: Array<ClaudeToolUseBlock | { type: string }>;
}

export async function planWithClaude(
  task: string,
  files: WorkspaceFile[],
  apiKey: string,
): Promise<AgentPlan> {
  const fileSummary = files.map((f) => ({
    name: f.name,
    ext: f.ext,
    mime: f.mime,
    size_bytes: f.size_bytes,
    is_text: f.text !== null,
  }));

  const toolCatalog = TOOL_REGISTRY.map((t) => ({
    name: t.name,
    description: t.description,
    file_triggers: t.fileTriggers,
  }));

  // We use Claude's tool_use mechanism to force structured JSON output.
  const planningTool = {
    name: "submit_plan",
    description:
      "Submit an ordered plan of agent tools to run. Always order " +
      "inspector → counter → analyzers → summarizer.",
    input_schema: {
      type: "object",
      properties: {
        tools_in_order: {
          type: "array",
          items: {
            type: "string",
            enum: TOOL_REGISTRY.map((t) => t.name),
          },
          description: "Ordered list of tool names to execute.",
        },
        rationale: {
          type: "string",
          description:
            "One sentence explaining why this plan fits the task and workspace.",
        },
      },
      required: ["tools_in_order", "rationale"],
    },
  };

  const systemPrompt =
    "You are the planning component of a browser-native AI agent runtime. " +
    "Given a user task and the contents of an in-browser workspace, you must " +
    "select an ordered list of analysis tools to execute. " +
    "Pick only tools whose file_triggers match files actually present. " +
    "Always include the summarizer last. Always include file_inspector first.";

  const userPrompt = `Task: ${task}

Workspace (${files.length} file(s)):
${JSON.stringify(fileSummary, null, 2)}

Available tools:
${JSON.stringify(toolCatalog, null, 2)}

Call submit_plan with your ordered tool list.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: [planningTool],
      tool_choice: { type: "tool", name: "submit_plan" },
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as ClaudeMessageResponse;
  const toolUse = data.content.find(
    (b): b is ClaudeToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse?.input?.tools_in_order) {
    throw new Error("Claude did not call submit_plan");
  }

  const requested = toolUse.input.tools_in_order;
  const selectedTools: ToolSpec[] = requested
    .map((name) => TOOL_REGISTRY.find((t) => t.name === name))
    .filter((t): t is ToolSpec => Boolean(t));

  if (selectedTools.length === 0) {
    throw new Error("Claude returned an empty plan");
  }

  const reasons: Record<string, string> = {};
  const why = toolUse.input.rationale ?? "Claude-selected";
  for (const t of selectedTools) reasons[t.name] = why;

  return {
    task,
    intent: "full_report",
    steps: selectedTools.map(
      (t) => `${t.owner} → ${t.name} — ${t.description}`,
    ),
    selectedTools,
    reasons,
  };
}
