import { describe, expect, it } from "vitest";
import { parsePlanEdits, serializePlan } from "../src/stages/gate.js";
import type { ResearchPlan } from "../src/types.js";

const plan: ResearchPlan = {
  runId: "r",
  brief: {
    runId: "r",
    question: "q",
    refinedQuestion: "What is the state of X?",
    goals: ["g1"],
    inScope: [],
    outOfScope: [],
    depth: "standard",
    createdAt: "now",
  },
  angles: [
    { id: "a1", title: "History of X", rationale: "context", perspective: "historian", seedQueries: ["x history"], priority: 1 },
    { id: "a2", title: "Criticism of X", rationale: "balance", seedQueries: ["x criticism", "x flaws"], priority: 2 },
  ],
  maxWorkers: 4,
  perWorkerTurnCap: 6,
  confirmedByUser: false,
  createdAt: "now",
};

describe("plan serialize/parse round-trip", () => {
  it("serializes to an editable block and parses back losslessly", () => {
    const text = serializePlan(plan);
    expect(text).toContain("What is the state of X?");
    expect(text).toContain("History of X :: historian :: x history");
    const parsed = parsePlanEdits(text, plan);
    expect(parsed.brief.refinedQuestion).toBe(plan.brief.refinedQuestion);
    expect(parsed.angles).toHaveLength(2);
    expect(parsed.angles[1]?.title).toBe("Criticism of X");
    expect(parsed.angles[1]?.seedQueries).toEqual(["x criticism", "x flaws"]);
    expect(parsed.confirmedByUser).toBe(true);
  });

  it("applies user edits: renamed question, dropped angle, reused rationale by position", () => {
    const edited = [
      "# Refined question",
      "A sharper question",
      "# Angles",
      "- New first angle :: skeptic :: query one",
    ].join("\n");
    const parsed = parsePlanEdits(edited, plan);
    expect(parsed.brief.refinedQuestion).toBe("A sharper question");
    expect(parsed.angles).toHaveLength(1);
    expect(parsed.angles[0]?.title).toBe("New first angle");
    expect(parsed.angles[0]?.perspective).toBe("skeptic");
    expect(parsed.angles[0]?.rationale).toBe("context"); // reused from original position 0
  });

  it("falls back to the original when the edit is empty", () => {
    const parsed = parsePlanEdits("# Refined question\n# Angles\n", plan);
    expect(parsed.brief.refinedQuestion).toBe(plan.brief.refinedQuestion);
    expect(parsed.angles).toHaveLength(2);
  });

  it("tolerates numbered and bulleted angle lines", () => {
    const edited = "# Angles\n1. Alpha\n2) Beta\n* Gamma\n- Delta";
    const parsed = parsePlanEdits(edited, plan);
    expect(parsed.angles.map((a) => a.title)).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });
});
