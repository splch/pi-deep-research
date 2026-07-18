import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BudgetTracker } from "../src/budget.js";
import { resolveConfig } from "../src/config.js";
import type { SearchProvider } from "../src/search/provider.js";
import { SourceStore } from "../src/sources.js";
import { runResearch, type AngleOutcome } from "../src/stages/research.js";
import { HostLimiter } from "../src/tools/politeness.js";
import type { ResearchPlan, SubmitFindingsPayload } from "../src/types.js";
import type { ResearchBackend, WorkerResult, WorkerRunSpec } from "../src/worker/interface.js";

const provider: SearchProvider = { name: "stub", async search() { return []; } };

const plan: ResearchPlan = {
  runId: "r",
  brief: { runId: "r", question: "q", refinedQuestion: "rq", goals: [], inScope: [], outOfScope: [], depth: "quick", createdAt: "now" },
  angles: [
    { id: "a1", title: "First angle", rationale: "r1", seedQueries: ["s1"], priority: 1 },
    { id: "a2", title: "Second angle", rationale: "r2", seedQueries: ["s2"], priority: 2 },
  ],
  maxWorkers: 2,
  perWorkerTurnCap: 4,
  confirmedByUser: true,
  createdAt: "now",
};

const usage = () => ({ costUSD: 0.01, tokensIn: 10, tokensOut: 5, turns: 1 });

/** Backend that resolves each angle after an optional delay, so completion order can differ from input order. */
function backendWithDelays(delayMs: Record<string, number>): ResearchBackend {
  return {
    name: "stub",
    async runWorker<T>(spec: WorkerRunSpec<T>): Promise<WorkerResult<T>> {
      await new Promise((resolve) => setTimeout(resolve, delayMs[spec.label] ?? 0));
      const payload: SubmitFindingsPayload = {
        findings: [
          { claim: `${spec.label} claim one`, citations: [{ url: "https://e.com/1" }] },
          { claim: `${spec.label} claim two`, citations: [{ url: "https://e.com/2" }] },
        ],
      };
      return { label: spec.label, status: "ok", result: payload as T, usage: usage() };
    },
  };
}

function deps(backend: ResearchBackend, budget: BudgetTracker, onOutcome?: (o: AngleOutcome) => void) {
  return {
    plan,
    backend,
    provider,
    store: new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-research-"))),
    limiter: new HostLimiter({ minIntervalMs: 1 }),
    budget,
    config: resolveConfig({ flags: {}, env: {}, defaultOutDir: "unused" }),
    onOutcome,
  };
}

describe("runResearch", () => {
  it("returns findings in angle order with per-angle ids regardless of completion order", async () => {
    // a1 finishes AFTER a2; output must still lead with a1.
    const { findings, outcomes } = await runResearch(deps(backendWithDelays({ a1: 60, a2: 0 }), new BudgetTracker(5)));
    expect(findings.map((f) => f.id)).toEqual(["a1-f1", "a1-f2", "a2-f1", "a2-f2"]);
    expect(findings.map((f) => f.angleId)).toEqual(["a1", "a1", "a2", "a2"]);
    expect(outcomes.map((o) => o.angleId)).toEqual(["a1", "a2"]);
    expect(outcomes.every((o) => o.status === "ok" && o.findingCount === 2)).toBe(true);
  });

  it("skips every angle once the budget ceiling is already hit", async () => {
    const spent = { costUSD: 2, tokensIn: 0, tokensOut: 0, workerTurns: 0, wallMs: 0, capsHit: [] };
    const budget = new BudgetTracker(1, 0, spent);
    const seen: AngleOutcome[] = [];
    const { findings, outcomes } = await runResearch(deps(backendWithDelays({}), budget, (o) => seen.push(o)));
    expect(findings).toEqual([]);
    expect(outcomes.map((o) => o.status)).toEqual(["skipped", "skipped"]);
    expect(seen).toHaveLength(2);
    expect(budget.snapshot().capsHit).toContain("budget");
  });
});
