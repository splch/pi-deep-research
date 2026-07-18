import { createDeferred } from "../deferred.js";
import { workerSystemPrompt, workerTaskMessage } from "../prompts/worker.js";
import type { SearchProvider } from "../search/provider.js";
import type { SourceStore } from "../sources.js";
import { createFetchUrlTool } from "../tools/fetch-url.js";
import type { HostLimiter } from "../tools/politeness.js";
import { createSubmitFindingsTool } from "../tools/submit.js";
import { createWebSearchTool } from "../tools/web-search.js";
import type { ResearchAngle, ResearchBrief, SubmitFindingsPayload } from "../types.js";
import type { WorkerModelSpec, WorkerRunSpec } from "./interface.js";

export interface ResearchWorkerDeps {
  store: SourceStore;
  limiter: HostLimiter;
  provider: SearchProvider;
  model: WorkerModelSpec;
  /** Turn budget communicated to the model ("aim for N"). */
  softTurnCap: number;
  wallClockMs: number;
  maxFetchChars: number;
}

/**
 * Extra turns past the soft budget before a hard abort. Workers often decide to
 * submit right at their stated budget; without this buffer the cap fires on the
 * turn they announce "let me submit" and their findings are lost.
 */
export const HARD_TURN_BUFFER = 3;

/** Assemble one research worker: web tools + a terminating submit_findings tool, wired to a fresh deferred. */
export function buildResearchWorkerSpec(
  brief: ResearchBrief,
  angle: ResearchAngle,
  deps: ResearchWorkerDeps,
): WorkerRunSpec<SubmitFindingsPayload> {
  const result = createDeferred<SubmitFindingsPayload>();
  const webSearch = createWebSearchTool(deps.provider);
  const fetchUrl = createFetchUrlTool({
    store: deps.store,
    limiter: deps.limiter,
    byAngle: angle.id,
    maxCharsDefault: deps.maxFetchChars,
  });
  const submit = createSubmitFindingsTool(result);

  return {
    label: angle.id,
    systemPrompt: workerSystemPrompt(),
    task: workerTaskMessage(brief, angle, deps.softTurnCap),
    customTools: [webSearch, fetchUrl, submit],
    toolNames: ["web_search", "fetch_url", "submit_findings"],
    model: deps.model,
    turnCap: deps.softTurnCap + HARD_TURN_BUFFER,
    wallClockMs: deps.wallClockMs,
    result,
  };
}
