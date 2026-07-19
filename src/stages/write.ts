import { createDeferred } from "../deferred.js";
import type { BudgetTracker } from "../budget.js";
import type { ResolvedConfig } from "../config.js";
import { writerSystemPrompt, writerTaskMessage } from "../prompts/writer.js";
import type { SourceStore } from "../sources.js";
import type { Finding, ResearchBrief, SourceRecord, Verdict } from "../types.js";
import type { ResearchBackend, WorkerRunSpec } from "../worker/interface.js";

export interface WriteStageResult {
  markdown: string;
  sources: SourceRecord[];
}

/** Sources actually cited by the surviving findings, in stable order - the writer's [n] list. */
export function citedSources(findings: Finding[], store: SourceStore): SourceRecord[] {
  const seen = new Set<string>();
  const sources: SourceRecord[] = [];
  for (const finding of findings) {
    for (const citation of finding.citations) {
      const record = store.get(citation.url);
      if (record && !seen.has(record.id)) {
        seen.add(record.id);
        sources.push(record);
      }
    }
  }
  return sources;
}

/**
 * Resolve each finding's citation URLs to [n] numbers into `sources`, going
 * through the store so URL variants (tracking params, fragments, redirects)
 * land on the same number instead of silently losing their reference.
 */
export function buildFindingRefs(findings: Finding[], sources: SourceRecord[], store: SourceStore): Map<string, number[]> {
  const numberBySourceId = new Map(sources.map((s, i) => [s.id, i + 1] as const));
  const refs = new Map<string, number[]>();
  for (const finding of findings) {
    const numbers = finding.citations
      .map((citation) => {
        const record = store.get(citation.url);
        return record ? numberBySourceId.get(record.id) : undefined;
      })
      .filter((n): n is number => n !== undefined);
    refs.set(finding.id, [...new Set(numbers)]);
  }
  return refs;
}

export interface WriteStageDeps {
  brief: ResearchBrief;
  findings: Finding[];
  verdicts: Verdict[];
  /** Unresolved contradictions from the reflection pass(es), surfaced as an explicit writer input. */
  openConflicts?: string[];
  claimsToFindingIds: Map<string, string[]>;
  store: SourceStore;
  backend: ResearchBackend;
  budget: BudgetTracker;
  config: ResolvedConfig;
  signal?: AbortSignal;
}

/**
 * Stage 3: a single writer session (no tools) synthesizes the report. We capture
 * its final assistant message (free text) rather than a terminating tool payload,
 * because a full markdown report is more natural as prose than as a JSON argument.
 */
export async function runWriter(deps: WriteStageDeps): Promise<WriteStageResult> {
  const sources = citedSources(deps.findings, deps.store);
  const refsByFinding = buildFindingRefs(deps.findings, sources, deps.store);

  const verdictByFinding = new Map<string, Verdict>();
  for (const verdict of deps.verdicts) {
    for (const findingId of deps.claimsToFindingIds.get(verdict.claimId) ?? []) {
      verdictByFinding.set(findingId, verdict);
    }
  }

  const result = createDeferred<never>(); // never resolves: the writer has no terminating tool
  const spec: WorkerRunSpec<never> = {
    label: "writer",
    systemPrompt: writerSystemPrompt(),
    task: writerTaskMessage({
      brief: deps.brief,
      findings: deps.findings,
      verdictByFinding,
      sources,
      refsByFinding,
      openConflicts: deps.openConflicts,
    }),
    customTools: [],
    toolNames: [],
    model: deps.config.models.writer,
    turnCap: 0, // 0 = unlimited; single-shot generation
    // Long single-shot generation; allow roughly two worker-length budgets (0 stays unlimited).
    wallClockMs: deps.config.perWorkerWallMs * 2,
    result,
  };

  const run = await deps.backend.runWorker(spec, deps.signal);
  deps.budget.add(run.usage);
  const markdown = (run.salvagedText ?? "").trim();
  if (!markdown) {
    throw new Error(`Writer produced no report (status: ${run.status}${run.error ? `: ${run.error}` : ""}).`);
  }
  return { markdown, sources };
}
