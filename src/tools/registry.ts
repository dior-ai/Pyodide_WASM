import fileInspectorSrc from "./file_inspector.py?raw";
import fileCounterSrc from "./file_counter.py?raw";
import jsonValidatorSrc from "./json_validator.py?raw";
import textAnalyzerSrc from "./text_analyzer.py?raw";
import csvAnalyzerSrc from "./csv_analyzer.py?raw";
import summarizerSrc from "./summarizer.py?raw";

export type ToolKind = "inspector" | "aggregator" | "validator" | "analyzer" | "summarizer";

export interface ToolSpec {
  name: string;
  kind: ToolKind;
  description: string;
  /** Lowercase keywords used by the heuristic parser for intent matching. */
  keywords: string[];
  /** File extensions that activate this tool when present in the workspace. */
  fileTriggers: string[];
  /** Raw Python source loaded into Pyodide at execution time. */
  source: string;
  /** Friendly label of the simulated agent that owns this tool. */
  owner: "Planner" | "Executor" | "Summarizer";
  /** PyPI packages to install via micropip before this tool runs. */
  pythonPackages?: string[];
}

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    name: "file_inspector",
    kind: "inspector",
    description: "Real metadata + content sniff for every file in the workspace.",
    keywords: ["list", "inspect", "files", "show", "analyze", "view", "look"],
    fileTriggers: ["*"],
    source: fileInspectorSrc,
    owner: "Executor",
  },
  {
    name: "file_counter",
    kind: "aggregator",
    description: "Counts, totals, and type breakdowns over the file inventory.",
    keywords: ["count", "total", "how many", "size", "aggregate", "stats"],
    fileTriggers: ["*"],
    source: fileCounterSrc,
    owner: "Executor",
  },
  {
    name: "json_validator",
    kind: "validator",
    description: "Parses every JSON file and reports validity + structure.",
    keywords: ["json", "validate", "parse", "schema", "structure"],
    fileTriggers: ["json"],
    source: jsonValidatorSrc,
    owner: "Executor",
  },
  {
    name: "csv_analyzer",
    kind: "analyzer",
    description: "Real pandas-powered analysis of CSV/TSV files (rows, dtypes, stats).",
    keywords: ["csv", "tsv", "tabular", "rows", "columns", "pandas", "stats", "data"],
    fileTriggers: ["csv", "tsv"],
    source: csvAnalyzerSrc,
    owner: "Executor",
    pythonPackages: ["pandas"],
  },
  {
    name: "text_analyzer",
    kind: "analyzer",
    description: "Word/sentence counts, keyword frequency, reading time on text files.",
    keywords: ["text", "markdown", "words", "keywords", "readability", "log"],
    fileTriggers: ["txt", "md", "rst", "log", "html", "htm"],
    source: textAnalyzerSrc,
    owner: "Executor",
  },
  {
    name: "summarizer",
    kind: "summarizer",
    description: "Synthesizes earlier tool outputs into a single human-readable report.",
    keywords: ["summarize", "summary", "describe", "report", "explain"],
    fileTriggers: ["*"],
    source: summarizerSrc,
    owner: "Summarizer",
  },
];

export function findTool(name: string): ToolSpec | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}
