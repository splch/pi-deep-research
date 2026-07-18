import { describe, expect, it } from "vitest";
import { mapSettled, mapWithConcurrency } from "../src/worker/pool.js";

describe("mapWithConcurrency", () => {
  it("preserves input order and never exceeds the concurrency cap", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return n * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("handles empty input", async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });
});

describe("mapSettled", () => {
  it("captures per-item failures without rejecting the whole run", async () => {
    const result = await mapSettled([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(result[0]).toEqual({ ok: true, value: 1 });
    expect(result[1]?.ok).toBe(false);
    expect(result[2]).toEqual({ ok: true, value: 3 });
  });
});
