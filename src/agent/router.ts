import type { ToolSpec } from "../tools/registry";

export interface RoutedStep {
  index: number;
  tool: ToolSpec;
  reason: string;
}

/**
 * Turns an ordered list of selected tools into a routed execution plan.
 * In a real framework this would resolve tool dependencies and parallelizable steps.
 */
export function route(tools: ToolSpec[]): RoutedStep[] {
  return tools.map((tool, i) => ({
    index: i,
    tool,
    reason:
      tool.kind === "summarizer"
        ? "synthesizes prior tool outputs into prose"
        : tool.kind === "aggregator"
          ? "computes counts and totals over the inventory"
          : "produces the inventory the rest of the chain depends on",
  }));
}
