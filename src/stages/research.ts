import type { ResolvedConfig } from "../config.js";
import type { BudgetTracker } from "../budget.js";
import type { SearchProvider } from "../search/provider.js";
import type { SourceStore } from "../sources.js";
import type { HostLimiter } from "../tools/politeness.js";
import type { AngleOutcome, Finding, ResearchPlan, WorkerFinding } from "../types.js";

export type { AngleOutcome } from "../types.js";
import type { ResearchBackend, WorkerProgress } from "../worker/interface.js";
import { mapWithConcurrency } from "../worker/pool.js";
import { buildResearchWorkerSpec } from "../worker/specs.js";

export interface ResearchStageResult {
  findings: Finding[];
  outcomes: AngleOutcome[];
}

export interface ResearchStageDeps {
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

function toFindings(angleId: string, raw: WorkerFinding[]): Finding[] {
  return raw.map((f, i) => ({ ...f, id: `${angleId}-f${i + 1}`, angleId }));
}

/** Stage 1: fan out one worker per angle, honoring the budget ceiling and concurrency cap. */
export async function runResearch(deps: ResearchStageDeps): Promise<ResearchStageResult> {
  const { plan, backend, provider, store, limiter, budget, config, signal, onProgress, onOutcome } = deps;
  const concurrency = Math.min(config.maxWorkers, 4);

  const record = (outcome: AngleOutcome): AngleOutcome => {
    onOutcome?.(outcome);
    return outcome;
  };

  const perAngle = await mapWithConcurrency(
    plan.angles,
    concurrency,
    async (angle): Promise<{ outcome: AngleOutcome; findings: Finding[] }> => {
      if (signal?.aborted) {
        return { outcome: record({ angleId: angle.id, status: "aborted", findingCount: 0 }), findings: [] };
      }
      if (budget.overBudget()) {
        budget.noteCap("budget");
        return { outcome: record({ angleId: angle.id, status: "skipped", findingCount: 0 }), findings: [] };
      }

      const spec = buildResearchWorkerSpec(plan.brief, angle, {
        store,
        limiter,
        provider,
        model: config.models.worker,
        softTurnCap: plan.perWorkerTurnCap,
        wallClockMs: config.perWorkerWallMs,
        maxFetchChars: config.maxFetchChars,
      });

      const run = await backend.runWorker(spec, signal, onProgress);
      budget.add(run.usage);
      if (run.status === "capped") budget.noteCap(`worker:${angle.id}`);
      if (process.env.PI_DR_DEBUG) {
        console.error(
          `[research ${angle.id}] status=${run.status} findings=${run.result?.findings?.length ?? 0} turns=${run.usage.turns} cost=${run.usage.costUSD.toFixed(3)}${run.error ? ` error=${run.error}` : ""}${run.salvagedText ? ` salvage="${run.salvagedText.slice(0, 120)}"` : ""}`,
        );
      }

      const findings = toFindings(angle.id, run.result?.findings ?? []);
      return {
        outcome: record({
          angleId: angle.id,
          status: run.status,
          findingCount: findings.length,
          notes: run.result?.notes,
          error: run.error,
        }),
        findings,
      };
    },
  );

  // Flatten in angle (priority) order regardless of completion order, so finding ids
  // and downstream claim/report ordering are deterministic run to run.
  return { findings: perAngle.flatMap((r) => r.findings), outcomes: perAngle.map((r) => r.outcome) };
}
