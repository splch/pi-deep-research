import { describe, expect, it } from "vitest";
import { HostLimiter } from "../src/tools/politeness.js";

describe("HostLimiter", () => {
  it("spaces request starts on the same host by minIntervalMs", async () => {
    const limiter = new HostLimiter({ minIntervalMs: 120, maxConcurrent: 2 });
    const t0 = Date.now();
    (await limiter.acquire("example.com"))();
    (await limiter.acquire("example.com"))();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(100);
  });

  it("does not block different hosts", async () => {
    const limiter = new HostLimiter({ minIntervalMs: 200, maxConcurrent: 1 });
    const t0 = Date.now();
    (await limiter.acquire("a.com"))();
    (await limiter.acquire("b.com"))();
    expect(Date.now() - t0).toBeLessThan(150);
  });

  it("caps concurrency per host until release", async () => {
    const limiter = new HostLimiter({ minIntervalMs: 1, maxConcurrent: 1 });
    const release1 = await limiter.acquire("c.com");
    let acquired2 = false;
    const pending = limiter.acquire("c.com").then((release2) => {
      acquired2 = true;
      release2();
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(acquired2).toBe(false);
    release1();
    await pending;
    expect(acquired2).toBe(true);
  });

  it("respects an abort signal while waiting", async () => {
    const limiter = new HostLimiter({ minIntervalMs: 1, maxConcurrent: 1 });
    await limiter.acquire("d.com"); // never released
    const controller = new AbortController();
    const waiting = limiter.acquire("d.com", controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow();
  });
});
