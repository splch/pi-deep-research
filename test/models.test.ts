import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { StageModels } from "../src/config.js";
import { resolveStageModels } from "../src/models.js";

// Minimal registry stub: only getAvailable() is used when the provider is known up front.
function stubRegistry(models: Array<{ id: string; provider: string; outputCost: number }>): ModelRegistry {
  return {
    getAvailable: () => models.map((m) => ({ id: m.id, provider: m.provider, cost: { output: m.outputCost } })),
  } as unknown as ModelRegistry;
}

const emptyStages: StageModels = { planner: {}, worker: {}, verifier: {}, writer: {} };

describe("resolveStageModels", () => {
  it("keeps planner/writer on the session model and drops worker/verifier to the cheapest same-provider model", () => {
    const registry = stubRegistry([
      { id: "big", provider: "anthropic", outputCost: 15 },
      { id: "small", provider: "anthropic", outputCost: 1 },
      { id: "other", provider: "openai", outputCost: 0.1 },
    ]);
    const resolved = resolveStageModels(emptyStages, registry, { provider: "anthropic", model: "big" });
    expect(resolved.planner).toEqual({ provider: "anthropic", model: "big" });
    expect(resolved.writer).toEqual({ provider: "anthropic", model: "big" });
    expect(resolved.worker).toEqual({ provider: "anthropic", model: "small" });
    expect(resolved.verifier).toEqual({ provider: "anthropic", model: "small" });
  });

  it("does not override explicitly-set stage models", () => {
    const registry = stubRegistry([
      { id: "big", provider: "anthropic", outputCost: 15 },
      { id: "small", provider: "anthropic", outputCost: 1 },
    ]);
    const stages: StageModels = {
      planner: {},
      worker: { provider: "openai", model: "gpt-x" },
      verifier: {},
      writer: {},
    };
    const resolved = resolveStageModels(stages, registry, { provider: "anthropic", model: "big" });
    expect(resolved.worker).toEqual({ provider: "openai", model: "gpt-x" });
    expect(resolved.verifier).toEqual({ provider: "anthropic", model: "small" });
  });

  it("falls back to session model when no same-provider sibling is available", () => {
    const registry = stubRegistry([{ id: "only", provider: "openai", outputCost: 2 }]);
    const resolved = resolveStageModels(emptyStages, registry, { provider: "anthropic", model: "solo" });
    expect(resolved.worker).toEqual({}); // no cheap sibling -> empty spec -> registry default at run time
  });
});
