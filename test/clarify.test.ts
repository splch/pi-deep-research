import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { generatePlan } from "../src/stages/clarify.js";
import type { SubmitPlanPayload } from "../src/types.js";
import type { ResearchBackend, WorkerResult, WorkerRunSpec } from "../src/worker/interface.js";

const payload: SubmitPlanPayload = {
  refinedQuestion: "rq",
  goals: ["g"],
  inScope: [],
  outOfScope: [],
  angles: [
    { title: "a1", rationale: "r1", seedQueries: ["q1"], priority: 1 },
    { title: "a2", rationale: "r2", seedQueries: ["q2"], priority: 2 },
  ],
};

/** Backend that captures the planner spec and immediately resolves with a valid plan. */
function capturingBackend(captured: { spec?: WorkerRunSpec<unknown> }): ResearchBackend {
  return {
    name: "stub",
    async runWorker<T>(spec: WorkerRunSpec<T>): Promise<WorkerResult<T>> {
      captured.spec = spec as WorkerRunSpec<unknown>;
      return {
        label: spec.label,
        status: "ok",
        result: payload as T,
        usage: { costUSD: 0, tokensIn: 0, tokensOut: 0, turns: 1 },
      };
    },
  };
}

describe("generatePlan", () => {
  it("scales the planner wall clock from the configurable worker wall clock", async () => {
    const captured: { spec?: WorkerRunSpec<unknown> } = {};
    const config = resolveConfig({ flags: { "wall-secs": "600" }, defaultOutDir: "/tmp/research" });
    const { plan } = await generatePlan({ backend: capturingBackend(captured), config, runId: "r", question: "q" });
    expect(captured.spec?.wallClockMs).toBe(600_000);
    expect(plan.angles.map((a) => a.title)).toEqual(["a1", "a2"]);
  });

  it("weaves conversation context into the planner task", async () => {
    const captured: { spec?: WorkerRunSpec<unknown> } = {};
    const config = resolveConfig({ flags: {}, env: {}, defaultOutDir: "/tmp/research" });
    await generatePlan({
      backend: capturingBackend(captured),
      config,
      runId: "r",
      question: "how does it handle left recursion",
      conversationContext: "User: tell me about library X\n\nAssistant: library X is a parser toolkit",
    });
    expect(captured.spec?.task).toContain("how does it handle left recursion");
    expect(captured.spec?.task).toContain("library X is a parser toolkit");
  });
});
