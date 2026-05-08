import type { WorkspaceFile } from "./workspace";

export type AgentPhase =
  | "idle"
  | "loading_runtime"
  | "ready"
  | "parsing"
  | "routing"
  | "executing"
  | "summarizing"
  | "done"
  | "error";

export interface ToolHistoryEntry {
  tool: string;
  owner: string;
  startedAt: number;
  durationMs: number;
  output: Record<string, unknown>;
}

export interface LogLine {
  ts: number;
  source: string;
  level: "info" | "ok" | "warn" | "error";
  message: string;
}

export interface AgentState {
  task: string;
  phase: AgentPhase;
  steps: string[];
  selectedTools: string[];
  activeTool: string | null;
  tool_history: ToolHistoryEntry[];
  final_output: string;
  logs: LogLine[];
  workspace: { files: WorkspaceFile[] };
  runtime: {
    pyodideReady: boolean;
    loadMs: number | null;
    statusText: string;
  };
  totalDurationMs: number;
}

type Listener = (s: AgentState) => void;

const initialState: AgentState = {
  task: "",
  phase: "idle",
  steps: [],
  selectedTools: [],
  activeTool: null,
  tool_history: [],
  final_output: "",
  logs: [],
  workspace: { files: [] },
  runtime: { pyodideReady: false, loadMs: null, statusText: "Booting..." },
  totalDurationMs: 0,
};

class Store {
  private state: AgentState = structuredClone(initialState);
  private listeners = new Set<Listener>();

  get(): AgentState {
    return this.state;
  }

  set(patch: Partial<AgentState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  update(fn: (s: AgentState) => AgentState): void {
    this.state = fn(this.state);
    this.notify();
  }

  pushLog(line: Omit<LogLine, "ts">): void {
    this.update((s) => ({
      ...s,
      logs: [...s.logs, { ...line, ts: Date.now() }],
    }));
  }

  pushHistory(entry: ToolHistoryEntry): void {
    this.update((s) => ({
      ...s,
      tool_history: [...s.tool_history, entry],
    }));
  }

  reset(): void {
    const runtime = this.state.runtime;
    const workspace = this.state.workspace;
    this.state = {
      ...structuredClone(initialState),
      runtime,
      workspace,
      phase: "ready",
    };
    this.notify();
  }

  addWorkspaceFiles(files: WorkspaceFile[]): void {
    if (files.length === 0) return;
    this.update((s) => {
      const seen = new Set(s.workspace.files.map((f) => `${f.name}:${f.size_bytes}`));
      const merged = [...s.workspace.files];
      for (const f of files) {
        const key = `${f.name}:${f.size_bytes}`;
        if (!seen.has(key)) {
          merged.push(f);
          seen.add(key);
        }
      }
      return { ...s, workspace: { files: merged } };
    });
  }

  removeWorkspaceFile(id: string): void {
    this.update((s) => ({
      ...s,
      workspace: { files: s.workspace.files.filter((f) => f.id !== id) },
    }));
  }

  clearWorkspace(): void {
    this.update((s) => ({ ...s, workspace: { files: [] } }));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }
}

export const store = new Store();
