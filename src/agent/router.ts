import type { ToolSpec } from "../tools/registry";

export interface RoutedStep {
  index: number;
  tool: ToolSpec;
  reason: string;
}

export function route(
  tools: ToolSpec[],
  reasons: Record<string, string> = {},
): RoutedStep[] {
  return tools.map((tool, i) => ({
    index: i,
    tool,
    reason:
      reasons[tool.name] ??
      (tool.kind === "summarizer"
        ? "synthesizes prior tool outputs into prose"
        : tool.kind === "aggregator"
          ? "computes counts and totals over the inventory"
          : tool.kind === "validator"
            ? "validates structured files"
            : tool.kind === "analyzer"
              ? "performs domain-specific analysis"
              : "produces the inventory the rest of the chain depends on"),
  }));
}
