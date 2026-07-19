import type { BudgetTracker } from "../budget.js";
import type { ResolvedConfig } from "../config.js";
import { createDeferred } from "../deferred.js";
import { reflectorSystemPrompt, reflectorTaskMessage } from "../prompts/reflector.js";
import type { SearchProvider } from "../search/provider.js";
import type { SourceStore } from "../sources.js";
import type { HostLimiter } from "../tools/politeness.js";
import { createSubmitReflectionTool } from "../tools/submit.js";
import type {
  AngleOutcome,
  Finding,
  ResearchAngle,
  ResearchPlan,
  SubmitReflectionPayload,
} from "../types.js";
import type { ResearchBackend, WorkerProgress, WorkerRunSpec } from "../worker/interface.js";
import { runResearch, type ResearchStageResult } from "./research.js";

export interface ReflectorDeps {
  plan: ResearchPlan;
  outcomes: AngleOutcome[];
  findings: Finding[];
  backend: ResearchBackend;
  budget: BudgetTracker;
  config: ResolvedConfig;
  /** 1-based pass number, surfaced in the prompt. */
  iteration: number;
  signal?: AbortSignal;
}

export interface ReflectorResult {
  /** Present when the reflector submitted; absent on abort or worker failure. */
  reflection?: SubmitReflectionPayload;
  /** Set when the reflector worker failed (status/error) - reflection is an enhancement, never a hard failure. */
  error?: string;
}

/** One cheap, web-less reflector worker: coverage check, conflict detection, gap list. */
export async function runReflector(deps: ReflectorDeps): Promise<ReflectorResult> {
  const result = createDeferred<SubmitReflectionPayload>();
  const submit = createSubmitReflectionTool(result);
  const spec: WorkerRunSpec<SubmitReflectionPayload> = {
    label: `reflector:${deps.iteration}`,
    systemPrompt: reflectorSystemPrompt(),
    task: reflectorTaskMessage({
      plan: deps.plan,
      outcomes: deps.outcomes,
      findings: deps.findings,
      iteration: deps.iteration,
      maxIters: deps.config.maxIters,
    }),
    customTools: [submit],
    toolNames: ["submit_reflection"],
    // Cheap tier: same model as the verifiers.
    model: deps.config.models.verifier,
    turnCap: 0, // 0 = unlimited; single-shot structured call
    wallClockMs: deps.config.perWorkerWallMs,
    result,
  };

  const run = await deps.backend.runWorker(spec, deps.signal);
  deps.budget.add(run.usage);
  if (process.env.PI_DR_DEBUG) {
    console.error(
      `[reflect ${deps.iteration}] status=${run.status} gaps=${run.result?.gaps.length ?? "-"} conflicts=${run.result?.conflicts.length ?? "-"} followUps=${run.result?.followUpAngles.length ?? "-"} cost=${run.usage.costUSD.toFixed(3)}${run.error ? ` error=${run.error}` : ""}`,
    );
  }
  if (!run.result) {
    if (deps.signal?.aborted) return {};
    return { error: `status: ${run.status}${run.error ? `: ${run.error}` : ""}` };
  }
  return { reflection: run.result };
}

/**
 * Turn proposed follow-up angles into plan angles with collision-free ids
 * (`a1r1` = first follow-up of reflection pass 1), sorted by priority.
 */
export function followUpsToAngles(
  payloads: SubmitReflectionPayload["followUpAngles"],
  iteration: number,
): ResearchAngle[] {
  return payloads
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((a, i) => ({
      id: `a${i + 1}r${iteration}`,
      title: a.title,
      rationale: a.rationale,
      perspective: a.perspective,
      seedQueries: a.seedQueries,
      priority: a.priority,
    }));
}

export interface FollowUpResearchDeps {
  plan: ResearchPlan;
  backend: ResearchBackend;
  provider: SearchProvider;
  store: SourceStore;
  limiter: HostLimiter;
  budget: BudgetTracker;
  config: ResolvedConfig;
  signal?: AbortSignal;
  onProgress?: (progress: WorkerProgress) => void;
  onOutcome?: (outcome: AngleOutcome) => void;
}

/** Bounded extra fan-out over the reflector's follow-up angles, reusing the research stage. */
export async function runFollowUpResearch(
  deps: FollowUpResearchDeps,
  angles: ResearchAngle[],
): Promise<ResearchStageResult> {
  return runResearch({
    plan: { ...deps.plan, angles },
    backend: deps.backend,
    provider: deps.provider,
    store: deps.store,
    limiter: deps.limiter,
    budget: deps.budget,
    config: deps.config,
    signal: deps.signal,
    onProgress: deps.onProgress,
    onOutcome: deps.onOutcome,
  });
}
