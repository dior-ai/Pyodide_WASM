import fileInspectorSrc from "./file_inspector.py?raw";
import fileCounterSrc from "./file_counter.py?raw";
import summarizerSrc from "./summarizer.py?raw";

export type ToolKind = "inspector" | "aggregator" | "summarizer";

export interface ToolSpec {
  name: string;
  kind: ToolKind;
  description: string;
  /** Lowercase keywords used by the parser for intent matching. */
  keywords: string[];
  /** Raw Python source loaded into Pyodide at execution time. */
  source: string;
  /** Friendly label of the simulated agent that owns this tool. */
  owner: "Planner" | "Executor" | "Summarizer";
}

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    name: "file_inspector",
    kind: "inspector",
    description: "List files in the workspace with sizes, types, and metadata.",
    keywords: ["list", "inspect", "files", "show", "analyze", "view", "look"],
    source: fileInspectorSrc,
    owner: "Executor",
  },
  {
    name: "file_counter",
    kind: "aggregator",
    description: "Compute counts, totals, and type breakdowns from a file inventory.",
    keywords: ["count", "total", "how many", "size", "aggregate", "stats"],
    source: fileCounterSrc,
    owner: "Executor",
  },
  {
    name: "summarizer",
    kind: "summarizer",
    description: "Generate a human-readable summary from earlier tool outputs.",
    keywords: ["summarize", "summary", "describe", "report", "explain"],
    source: summarizerSrc,
    owner: "Summarizer",
  },
];

export function findTool(name: string): ToolSpec | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}
