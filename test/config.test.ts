import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";

const base = { flags: {}, env: {}, defaultOutDir: "/tmp/out" };

describe("resolveConfig", () => {
  it("applies depth-profile defaults", () => {
    const c = resolveConfig(base);
    expect(c.depth).toBe("standard");
    expect(c.maxWorkers).toBe(4);
    expect(c.perWorkerTurnCap).toBe(0); // 0 = unlimited by default
    expect(c.perWorkerWallMs).toBe(0); // 0 = unlimited by default
    expect(c.budgetUSD).toBe(2);
    expect(c.votes).toBe(2);
    expect(c.verify).toBe(true);
    expect(c.backend).toBe("sdk");
    expect(c.outDir).toBe("/tmp/out");
  });

  it("prefers flags over env, env over defaults", () => {
    const c = resolveConfig({
      flags: { depth: "quick", budget: "5" },
      env: { PI_RESEARCH_DEPTH: "deep", PI_RESEARCH_WORKERS: "2" },
      defaultOutDir: "d",
    });
    expect(c.depth).toBe("quick"); // flag beats env
    expect(c.budgetUSD).toBe(5);
    expect(c.maxWorkers).toBe(2); // env fills what flags left unset
  });

  it("rejects unknown enum values instead of silently defaulting", () => {
    expect(() => resolveConfig({ ...base, flags: { depth: "medium" } })).toThrow(/Unknown depth/);
    expect(() => resolveConfig({ ...base, flags: { backend: "docker" } })).toThrow(/Unknown backend/);
  });

  it("caps workers and votes, and falls back on non-positive numbers", () => {
    const c = resolveConfig({ ...base, flags: { workers: "99", votes: "9", budget: "-1" } });
    expect(c.maxWorkers).toBe(8);
    expect(c.votes).toBe(5);
    expect(c.budgetUSD).toBe(2);
  });

  it("parses stage model specs (provider/model:thinking) with verifier/writer inheritance", () => {
    const c = resolveConfig({ ...base, flags: { planner: "anthropic/claude-opus:high", worker: "haiku" } });
    expect(c.models.planner).toEqual({ provider: "anthropic", model: "claude-opus", thinkingLevel: "high" });
    expect(c.models.worker.model).toBe("haiku");
    expect(c.models.verifier.model).toBe("haiku"); // inherits worker when unset
    expect(c.models.writer.model).toBe("claude-opus"); // inherits planner when unset
  });
});
