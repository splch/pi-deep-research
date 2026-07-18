import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSearchProvider } from "../src/search/index.js";
import { SourceStore } from "../src/sources.js";
import { HostLimiter } from "../src/tools/politeness.js";
import { createSubprocessBackend } from "../src/worker/subprocess-backend.js";
import { buildResearchWorkerSpec } from "../src/worker/specs.js";
import type { ResearchAngle, ResearchBrief } from "../src/types.js";

const live = process.env.PI_DR_LIVE === "1";

const brief: ResearchBrief = {
  runId: "sub",
  question: "q",
  refinedQuestion: "What is Pi, the coding agent by Earendil, and how are extensions structured?",
  goals: ["Understand Pi extensions"],
  inScope: ["Pi extensions"],
  outOfScope: [],
  depth: "quick",
  createdAt: new Date().toISOString(),
};
const angle: ResearchAngle = {
  id: "a1",
  title: "Pi extension basics",
  rationale: "Establish what a Pi extension is",
  seedQueries: ["pi.dev extensions", "earendil pi coding agent"],
  priority: 1,
};

describe.runIf(live)("subprocess backend (live)", () => {
  it(
    "runs a research worker as a child pi process and merges its sources into the parent store",
    async () => {
      const artifactDir = mkdtempSync(join(tmpdir(), "pi-dr-sub-"));
      const parentStore = new SourceStore(artifactDir);
      const { provider } = resolveSearchProvider(undefined);
      const backend = createSubprocessBackend({
        parentStore,
        artifactDir,
        maxFetchChars: 6000,
      });

      const spec = buildResearchWorkerSpec(brief, angle, {
        store: new SourceStore(join(artifactDir, "unused")), // subprocess uses its own file-backed store
        limiter: new HostLimiter(),
        provider,
        model: { provider: "anthropic", model: "claude-haiku-4-5" },
        softTurnCap: 8,
        wallClockMs: 240_000,
        maxFetchChars: 6000,
      });

      const result = await backend.runWorker(spec, undefined, (p) =>
        console.log(`[sub ${p.label}] turn ${p.turns} $${p.costUSD.toFixed(4)}`),
      );
      console.log("status:", result.status, "findings:", result.result?.findings?.length, "error:", result.error);

      expect(result.status).toBe("ok");
      const findings = result.result?.findings ?? [];
      expect(findings.length).toBeGreaterThan(0);
      // Sources fetched inside the child were merged back into the parent store.
      expect(parentStore.size).toBeGreaterThan(0);
      // Citation integrity holds across the process boundary: most cited URLs resolve in the parent store.
      const cited = [...new Set(findings.flatMap((f) => f.citations.map((c) => c.url)))];
      const resolved = cited.filter((u) => parentStore.has(u)).length;
      expect(resolved).toBeGreaterThan(0);
    },
    300_000,
  );
});
