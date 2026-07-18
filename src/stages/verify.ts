import type { BudgetTracker } from "../budget.js";
import type { ResolvedConfig } from "../config.js";
import { DEPTH_PROFILES } from "../config.js";
import { createDeferred } from "../deferred.js";
import { claimId } from "../ids.js";
import { verifierSystemPrompt, verifierTaskMessage, VERIFIER_LENSES, type VerifierSource } from "../prompts/verifier.js";
import type { SourceStore } from "../sources.js";
import { createSubmitVerdictTool } from "../tools/submit.js";
import type { Claim, Finding, SubmitVerdictPayload, Verdict, VoteRecord } from "../types.js";
import type { ResearchBackend, WorkerRunSpec } from "../worker/interface.js";
import { mapWithConcurrency } from "../worker/pool.js";

const EXCERPT_CHARS = 4000;
const MAX_SOURCES_PER_CLAIM = 3;

/**
 * Turn findings into verification candidates, riskiest first. Single-sourced and
 * high-confidence ("bold") claims are the ones a factored check most needs to catch,
 * so they sort to the top; the depth profile caps how many we actually spend on.
 */
export function selectClaims(findings: Finding[], maxClaims: number): Claim[] {
  const scored = findings.map((f, i) => {
    const sourceUrls = [...new Set(f.citations.map((c) => c.url))];
    const boldness = f.confidenceSelf === "high" ? 2 : f.confidenceSelf === "low" ? 0 : 1;
    const singleSourced = sourceUrls.length <= 1 ? 2 : 0;
    return {
      claim: {
        id: claimId(i),
        text: f.claim,
        findingIds: [f.id],
        sourceUrls,
        loadBearing: sourceUrls.length <= 1 || boldness === 2,
        importance: singleSourced + boldness,
      } satisfies Claim,
      score: singleSourced + boldness,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxClaims).map((s) => s.claim);
}

function gatherSources(store: SourceStore, urls: string[]): VerifierSource[] {
  const sources: VerifierSource[] = [];
  for (const url of urls.slice(0, MAX_SOURCES_PER_CLAIM)) {
    const record = store.get(url);
    if (!record) continue; // cited but never fetched -> no excerpt (drives 'unsupported')
    let text: string;
    try {
      text = store.readFullText(record);
    } catch {
      continue;
    }
    sources.push({
      index: sources.length + 1,
      url: record.finalUrl,
      title: record.title,
      excerpt: text.slice(0, EXCERPT_CHARS),
    });
  }
  return sources;
}

const SUPPORTIVE = new Set(["supported", "partially_supported"]);
const NEGATIVE = new Set(["refuted", "unsupported"]);

/** Majority rule: supportive vs negative; ties or genuine spread -> uncertain. Kept as a survivable verdict. */
export function aggregateVotes(claimId: string, votes: VoteRecord[]): Verdict {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.verdict, (counts.get(v.verdict) ?? 0) + 1);
  const supportive = votes.filter((v) => SUPPORTIVE.has(v.verdict)).length;
  const negative = votes.filter((v) => NEGATIVE.has(v.verdict)).length;

  let verdict: Verdict["verdict"];
  if (supportive > negative) {
    verdict = (counts.get("supported") ?? 0) >= (counts.get("partially_supported") ?? 0) ? "supported" : "partially_supported";
  } else if (negative > supportive) {
    verdict = (counts.get("refuted") ?? 0) >= (counts.get("unsupported") ?? 0) ? "refuted" : "unsupported";
  } else {
    verdict = "uncertain";
  }

  const agreeing = votes.filter((v) => v.verdict === verdict).length;
  const consensus = votes.length > 0 ? agreeing / votes.length : 0;
  const avgConfidence = votes.length > 0 ? votes.reduce((s, v) => s + v.confidence, 0) / votes.length : 0;
  const rationaleSummary = votes.map((v) => `[voter ${v.voter}: ${v.verdict}] ${v.rationale}`).join(" ");
  return { claimId, verdict, confidence: avgConfidence, votes, consensus, rationaleSummary };
}

/** True if a claim survives into the report (refuted/unsupported by majority are dropped). */
export function claimSurvives(verdict: Verdict): boolean {
  return verdict.verdict === "supported" || verdict.verdict === "partially_supported" || verdict.verdict === "uncertain";
}

/**
 * A finding survives unless it was a checked claim whose verdict was dropped. Pure so both
 * the verify stage and a resumed run (which reloads claims/verdicts, not the surviving set)
 * compute the same thing.
 */
export function computeSurvivingFindingIds(
  findings: Finding[],
  claims: Claim[],
  verdicts: Verdict[],
): Set<string> {
  const claimById = new Map(claims.map((c) => [c.id, c]));
  const droppedFindingIds = new Set<string>();
  for (const verdict of verdicts) {
    if (claimSurvives(verdict)) continue;
    for (const findingId of claimById.get(verdict.claimId)?.findingIds ?? []) {
      droppedFindingIds.add(findingId);
    }
  }
  return new Set(findings.filter((f) => !droppedFindingIds.has(f.id)).map((f) => f.id));
}

export interface VerifyStageDeps {
  findings: Finding[];
  store: SourceStore;
  backend: ResearchBackend;
  budget: BudgetTracker;
  config: ResolvedConfig;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface VerifyStageResult {
  claims: Claim[];
  verdicts: Verdict[];
  survivingFindingIds: Set<string>;
}

async function verifyOneClaim(
  claim: Claim,
  deps: VerifyStageDeps,
): Promise<Verdict> {
  const sources = gatherSources(deps.store, claim.sourceUrls);
  const votes: VoteRecord[] = [];
  for (let voter = 0; voter < deps.config.votes; voter++) {
    if (deps.signal?.aborted || deps.budget.overBudget()) break;
    const lens = VERIFIER_LENSES[voter % VERIFIER_LENSES.length]!;
    const result = createDeferred<SubmitVerdictPayload>();
    const submit = createSubmitVerdictTool(result);
    const spec: WorkerRunSpec<SubmitVerdictPayload> = {
      label: `${claim.id}:v${voter}`,
      systemPrompt: verifierSystemPrompt(lens),
      task: verifierTaskMessage(claim.text, sources),
      customTools: [submit],
      toolNames: ["submit_verdict"],
      model: deps.config.models.verifier,
      turnCap: 2,
      wallClockMs: 60_000,
      result,
    };
    const run = await deps.backend.runWorker(spec, deps.signal);
    deps.budget.add(run.usage);
    if (run.result) {
      votes.push({
        voter,
        model: deps.config.models.verifier.model ?? "default",
        verdict: run.result.verdict,
        confidence: run.result.confidence,
        rationale: run.result.rationale,
        quote: run.result.quote,
      });
    }
  }
  // No votes collected (all failed/aborted): treat as uncertain so we neither trust nor discard blindly.
  if (votes.length === 0) {
    return { claimId: claim.id, verdict: "uncertain", confidence: 0, votes: [], consensus: 0, rationaleSummary: "no verifier votes" };
  }
  return aggregateVotes(claim.id, votes);
}

/** Stage 2: factored verification. Each claim is judged by `votes` fresh, web-less verifiers. */
export async function runVerification(deps: VerifyStageDeps): Promise<VerifyStageResult> {
  const maxClaims = DEPTH_PROFILES[deps.config.depth].maxClaims;
  const claims = selectClaims(deps.findings, maxClaims);
  let done = 0;
  const verdicts = await mapWithConcurrency(claims, Math.min(deps.config.maxWorkers, 4), async (claim) => {
    const verdict = await verifyOneClaim(claim, deps);
    deps.onProgress?.(++done, claims.length);
    return verdict;
  });

  const survivingFindingIds = computeSurvivingFindingIds(deps.findings, claims, verdicts);
  return { claims, verdicts, survivingFindingIds };
}
