import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSearchProvider } from "../src/search/index.js";
import { SourceStore } from "../src/sources.js";
import { HostLimiter } from "../src/tools/politeness.js";
import { buildResearchWorkerSpec } from "../src/worker/specs.js";
import type { ResearchAngle, ResearchBrief } from "../src/types.js";

const brief: ResearchBrief = {
  runId: "r",
  question: "q",
  refinedQuestion: "refined",
  goals: [],
  inScope: [],
  outOfScope: ["speculation"],
  depth: "quick",
  createdAt: "now",
};
const angle: ResearchAngle = {
  id: "a1",
  title: "Angle one",
  rationale: "because",
  perspective: "skeptic",
  seedQueries: ["seed query"],
  priority: 1,
};

function specFixture() {
  const { provider } = resolveSearchProvider(undefined, { TAVILY_API_KEY: "x" });
  return buildResearchWorkerSpec(brief, angle, {
    store: new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-spec-"))),
    limiter: new HostLimiter(),
    provider,
    model: { provider: "anthropic", model: "claude-haiku-4-5" },
    softTurnCap: 6,
    wallClockMs: 60_000,
    maxFetchChars: 8000,
  });
}

describe("research worker spec (isolation contract)", () => {
  it("grants ONLY the three web tools - no built-ins", () => {
    const spec = specFixture();
    expect(spec.toolNames.sort()).toEqual(["fetch_url", "submit_findings", "web_search"]);
    for (const forbidden of ["read", "bash", "edit", "write", "grep", "find", "ls"]) {
      expect(spec.toolNames).not.toContain(forbidden);
    }
  });

  it("custom tool names match the allowlist exactly (no extra tools slip in)", () => {
    const spec = specFixture();
    expect(spec.customTools.map((t) => t.name).sort()).toEqual(spec.toolNames.slice().sort());
  });

  it("weaves brief + angle into the task and carries a fresh result sink", () => {
    const spec = specFixture();
    expect(spec.task).toContain("refined");
    expect(spec.task).toContain("Angle one");
    expect(spec.task).toContain("skeptic");
    expect(spec.task).toContain("speculation");
    expect(spec.systemPrompt).toContain("UNTRUSTED DATA");
    expect(spec.result.settled).toBe(false);
  });

  it("sets a hard turn cap above the soft budget so a worker can land its submission", () => {
    const spec = specFixture();
    expect(spec.turnCap).toBe(6 + 3); // softTurnCap + HARD_TURN_BUFFER
  });

  it("treats a zero soft budget as unlimited (no hard cap, no budget guidance in the task)", () => {
    const { provider } = resolveSearchProvider(undefined, { TAVILY_API_KEY: "x" });
    const spec = buildResearchWorkerSpec(brief, angle, {
      store: new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-spec-"))),
      limiter: new HostLimiter(),
      provider,
      model: {},
      softTurnCap: 0,
      wallClockMs: 0,
      maxFetchChars: 8000,
    });
    expect(spec.turnCap).toBe(0);
    expect(spec.task).not.toContain("Budget guidance");
  });
});
