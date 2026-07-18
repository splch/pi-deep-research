import { describe, expect, it } from "vitest";
import { BudgetTracker } from "../src/budget.js";

const usage = (costUSD: number) => ({ costUSD, tokensIn: 100, tokensOut: 50, turns: 1 });

describe("BudgetTracker", () => {
  it("accumulates cost and trips over the ceiling", () => {
    const b = new BudgetTracker(1.0, 0);
    expect(b.overBudget()).toBe(false);
    b.add(usage(0.4));
    b.add(usage(0.4));
    expect(b.overBudget()).toBe(false);
    expect(b.remainingUSD()).toBeCloseTo(0.2);
    b.add(usage(0.3));
    expect(b.overBudget()).toBe(true);
    expect(b.remainingUSD()).toBe(0);
  });

  it("tracks turns, tokens, and dedups caps", () => {
    const b = new BudgetTracker(5, 0);
    b.add(usage(0.1));
    b.add(usage(0.1));
    b.noteCap("worker:a1");
    b.noteCap("worker:a1");
    b.noteCap("budget");
    const snap = b.snapshot(1000);
    expect(snap.workerTurns).toBe(2);
    expect(snap.tokensOut).toBe(100);
    expect(snap.capsHit).toEqual(["worker:a1", "budget"]);
    expect(snap.wallMs).toBe(1000);
  });

  it("resumes from a prior snapshot", () => {
    const b = new BudgetTracker(2, 0, { costUSD: 1.5, tokensIn: 0, tokensOut: 0, workerTurns: 3, wallMs: 0, capsHit: [] });
    expect(b.costUSD).toBe(1.5);
    b.add(usage(0.6));
    expect(b.overBudget()).toBe(true);
  });

  it("carries prior wall time across resume", () => {
    const prior = { costUSD: 0, tokensIn: 0, tokensOut: 0, workerTurns: 0, wallMs: 5000, capsHit: [] };
    const b = new BudgetTracker(2, 1000, prior);
    expect(b.snapshot(3000).wallMs).toBe(7000); // 5000 from earlier segments + 2000 this segment
  });
});
