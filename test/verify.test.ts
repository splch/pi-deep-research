import { describe, expect, it } from "vitest";
import { aggregateVotes, claimSurvives, selectClaims } from "../src/stages/verify.js";
import type { Finding, VoteRecord } from "../src/types.js";

function vote(voter: number, verdict: VoteRecord["verdict"], confidence = 0.8): VoteRecord {
  return { voter, model: "m", verdict, confidence, rationale: "r" };
}

const finding = (id: string, claim: string, urls: string[], conf?: "low" | "medium" | "high"): Finding => ({
  id,
  angleId: "a1",
  claim,
  citations: urls.map((url) => ({ url })),
  confidenceSelf: conf,
});

describe("selectClaims", () => {
  it("ranks single-sourced and bold claims first and caps the count", () => {
    const findings = [
      finding("f1", "well-sourced modest", ["u1", "u2", "u3"], "medium"),
      finding("f2", "single-sourced bold", ["u1"], "high"),
      finding("f3", "single-sourced modest", ["u1"], "medium"),
    ];
    const claims = selectClaims(findings, 2);
    expect(claims).toHaveLength(2);
    expect(claims[0]?.text).toBe("single-sourced bold");
    expect(claims[0]?.loadBearing).toBe(true);
  });

  it("dedupes citation URLs into sourceUrls", () => {
    const claims = selectClaims([finding("f1", "c", ["u1", "u1", "u2"])], 5);
    expect(claims[0]?.sourceUrls).toEqual(["u1", "u2"]);
  });
});

describe("aggregateVotes", () => {
  it("keeps a claim both voters support", () => {
    const v = aggregateVotes("c1", [vote(0, "supported"), vote(1, "supported")]);
    expect(v.verdict).toBe("supported");
    expect(v.consensus).toBe(1);
    expect(claimSurvives(v)).toBe(true);
  });

  it("drops a claim both voters refute", () => {
    const v = aggregateVotes("c1", [vote(0, "refuted"), vote(1, "unsupported")]);
    expect(["refuted", "unsupported"]).toContain(v.verdict);
    expect(claimSurvives(v)).toBe(false);
  });

  it("marks a split as uncertain (survivable but flagged)", () => {
    const v = aggregateVotes("c1", [vote(0, "supported"), vote(1, "refuted")]);
    expect(v.verdict).toBe("uncertain");
    expect(claimSurvives(v)).toBe(true);
  });

  it("prefers the stronger supportive label on a majority", () => {
    const v = aggregateVotes("c1", [vote(0, "supported"), vote(1, "supported"), vote(2, "partially_supported")]);
    expect(v.verdict).toBe("supported");
    expect(v.consensus).toBeCloseTo(2 / 3);
  });

  it("computes average confidence across votes", () => {
    const v = aggregateVotes("c1", [vote(0, "supported", 0.6), vote(1, "supported", 1.0)]);
    expect(v.confidence).toBeCloseTo(0.8);
  });
});
