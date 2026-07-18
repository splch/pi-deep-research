import { createDeferred } from "../deferred.js";
import { DEPTH_PROFILES, type Depth, type ResolvedConfig } from "../config.js";
import { angleId } from "../ids.js";
import { plannerSystemPrompt, plannerTaskMessage } from "../prompts/planner.js";
import { createSubmitPlanTool } from "../tools/submit.js";
import type { ResearchAngle, ResearchBrief, ResearchPlan, SubmitPlanPayload } from "../types.js";
import type { ResearchBackend, WorkerRunSpec, WorkerUsage } from "../worker/interface.js";

export interface ClarifyDeps {
  backend: ResearchBackend;
  config: ResolvedConfig;
  runId: string;
  question: string;
  signal?: AbortSignal;
}

export function payloadToPlan(
  runId: string,
  question: string,
  depth: Depth,
  payload: SubmitPlanPayload,
  maxWorkers: number,
  perWorkerTurnCap: number,
): ResearchPlan {
  const now = new Date().toISOString();
  const brief: ResearchBrief = {
    runId,
    question,
    refinedQuestion: payload.refinedQuestion,
    goals: payload.goals,
    inScope: payload.inScope,
    outOfScope: payload.outOfScope,
    audience: payload.audience,
    depth,
    createdAt: now,
  };
  const angles: ResearchAngle[] = payload.angles
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((a, i) => ({
      id: angleId(i),
      title: a.title,
      rationale: a.rationale,
      perspective: a.perspective,
      seedQueries: a.seedQueries,
      priority: a.priority,
    }));
  return { runId, brief, angles, maxWorkers, perWorkerTurnCap, confirmedByUser: false, createdAt: now };
}

export interface PlanResult {
  plan: ResearchPlan;
  usage: WorkerUsage;
}

/** Stage 0: run the planner LLM to produce an (unconfirmed) research plan. */
export async function generatePlan(deps: ClarifyDeps): Promise<PlanResult> {
  const { backend, config, runId, question, signal } = deps;
  const profile = DEPTH_PROFILES[config.depth];
  const result = createDeferred<SubmitPlanPayload>();
  const submit = createSubmitPlanTool(result);

  const spec: WorkerRunSpec<SubmitPlanPayload> = {
    label: "planner",
    systemPrompt: plannerSystemPrompt(),
    task: plannerTaskMessage(question, profile),
    customTools: [submit],
    toolNames: ["submit_plan"],
    model: config.models.planner,
    // No hard caps by default (0 = unlimited): a single slow reasoning-model turn
    // must be allowed to finish. --wall-secs/--turn-cap re-enable limits globally.
    turnCap: 0,
    wallClockMs: config.perWorkerWallMs,
    result,
  };

  const run = await backend.runWorker(spec, signal);
  if (!run.result) {
    throw new Error(`Planner did not produce a plan (status: ${run.status}${run.error ? `: ${run.error}` : ""}).`);
  }
  return {
    plan: payloadToPlan(runId, question, config.depth, run.result, config.maxWorkers, config.perWorkerTurnCap),
    usage: run.usage,
  };
}
