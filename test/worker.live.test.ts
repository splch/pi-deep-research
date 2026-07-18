import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { resolveSearchProvider } from "../src/search/index.js";
import { SourceStore } from "../src/sources.js";
import { HostLimiter } from "../src/tools/politeness.js";
import { createSdkBackend } from "../src/worker/sdk-backend.js";
import { buildResearchWorkerSpec } from "../src/worker/specs.js";
import type { ResearchAngle, ResearchBrief } from "../src/types.js";

// Live end-to-end: real LLM + real search. Opt in with PI_DR_LIVE=1 (costs tokens + search credits).
const live = process.env.PI_DR_LIVE === "1";

const brief: ResearchBrief = {
  runId: "test",
  question: "test",
  refinedQuestion: "What is Pi, the coding agent by Earendil, and how are its extensions structured?",
  goals: ["Understand Pi's extension model"],
  inScope: ["Pi extensions"],
  outOfScope: [],
  depth: "quick",
  createdAt: new Date().toISOString(),
};

const angle: ResearchAngle = {
  id: "a1",
  title: "Pi extension API basics",
  rationale: "Establish what a Pi extension is and how it is loaded",
  seedQueries: ["pi.dev extensions", "earendil-works pi coding agent extension"],
  priority: 1,
};

describe.runIf(live)("SDK worker (live)", () => {
  it(
    "researches one angle and returns cited, structured findings",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "pi-dr-worker-"));
      const store = new SourceStore(dir);
      const { provider } = resolveSearchProvider(undefined);
      const backend = createSdkBackend({ agentDir: getAgentDir(), cwd: dir });

      const spec = buildResearchWorkerSpec(brief, angle, {
        store,
        limiter: new HostLimiter(),
        provider,
        model: {},
        softTurnCap: 8,
        wallClockMs: 180_000,
        maxFetchChars: 6000,
      });

      const result = await backend.runWorker(spec, undefined, (p) =>
        console.log(`[worker ${p.label}] turn ${p.turns} $${p.costUSD.toFixed(4)}`),
      );

      console.log("status:", result.status, "turns:", result.usage.turns, "cost:", result.usage.costUSD);
      expect(result.status).toBe("ok");
      expect(result.result).toBeDefined();
      const findings = result.result?.findings ?? [];
      expect(findings.length).toBeGreaterThan(0);

      const fetched = store.all().map((r) => ({ requested: r.url, final: r.finalUrl }));
      console.log("fetched sources:", JSON.stringify(fetched, null, 2));
      const cited = [...new Set(findings.flatMap((f) => f.citations.map((c) => c.url)))];
      const unresolved = cited.filter((url) => !store.has(url));
      console.log("cited URLs:", cited);
      console.log("cited-but-not-fetched (would be flagged by citation-integrity):", unresolved);

      for (const f of findings) {
        expect(f.claim.length).toBeGreaterThan(0);
        expect(f.citations.length).toBeGreaterThan(0);
      }
      expect(store.size).toBeGreaterThan(0);
      // Not every citation is guaranteed fetched (models sometimes cite search-result URLs);
      // that is exactly what the M5 citation-integrity stage handles. Here we assert the
      // worker did real grounding: most cited URLs resolve to sources it actually fetched.
      const resolved = cited.length - unresolved.length;
      expect(resolved).toBeGreaterThan(0);
      expect(resolved / cited.length).toBeGreaterThanOrEqual(0.5);
    },
    240_000,
  );
});
