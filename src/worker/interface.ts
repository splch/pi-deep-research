import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Deferred } from "../deferred.js";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface WorkerModelSpec {
  /** Provider id, e.g. "anthropic". */
  provider?: string;
  /** Model pattern/id, e.g. "claude-haiku-4-5". */
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

/**
 * One isolated agent run. It executes `task` with ONLY `customTools` available,
 * and finishes when the agent calls the terminating tool that resolves `result`
 * (or when a cap/abort fires). `T` is the validated payload of that tool.
 */
export interface WorkerRunSpec<T> {
  /** Stable label for logs/UI, e.g. angle id or claim id. */
  label: string;
  systemPrompt: string;
  task: string;
  /** Per-run tool instances (execute closures capture this run's state). */
  customTools: ToolDefinition[];
  /** Allowlisted tool names for this worker (subset of customTools names). */
  toolNames: string[];
  model: WorkerModelSpec;
  turnCap: number;
  wallClockMs: number;
  /** Resolved by the terminating tool among customTools; the backend awaits it. */
  result: Deferred<T>;
}

export interface WorkerUsage {
  costUSD: number;
  tokensIn: number;
  tokensOut: number;
  turns: number;
}

export type WorkerStatus = "ok" | "salvaged" | "capped" | "aborted" | "error";

export interface WorkerResult<T> {
  label: string;
  status: WorkerStatus;
  /** Present when the agent called its terminating tool. */
  result?: T;
  /** Free-text last assistant message, when the agent never called the terminating tool. */
  salvagedText?: string;
  usage: WorkerUsage;
  error?: string;
}

export interface WorkerProgress {
  label: string;
  turns: number;
  costUSD: number;
  lastActivity?: string;
}

export interface ResearchBackend {
  readonly name: string;
  runWorker<T>(
    spec: WorkerRunSpec<T>,
    signal: AbortSignal | undefined,
    onProgress?: (progress: WorkerProgress) => void,
  ): Promise<WorkerResult<T>>;
}
