import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { resolveCliModel } from "@earendil-works/pi-coding-agent";
import type { StageModels } from "./config.js";
import type { WorkerModelSpec } from "./worker/interface.js";

export interface ResolvedStageModels {
  planner: WorkerModelSpec;
  worker: WorkerModelSpec;
  verifier: WorkerModelSpec;
  writer: WorkerModelSpec;
}

function hasExplicit(spec: WorkerModelSpec): boolean {
  return Boolean(spec.model || spec.provider);
}

/**
 * Fill in unset stage models with sensible tiers:
 * - planner/writer keep the session default (strong reasoning + synthesis)
 * - worker/verifier drop to the cheapest available model from the SAME provider as
 *   the session model (high-volume, mechanical). Cost is read from the registry, so
 *   this adapts per provider instead of hardcoding "haiku"/"mini"/"flash" ids.
 * Any stage the user set explicitly (flag/env) is left untouched.
 */
export function resolveStageModels(
  configured: StageModels,
  modelRuntime: ModelRuntime,
  sessionModel: WorkerModelSpec,
): ResolvedStageModels {
  const sessionProvider = resolveSessionProvider(configured, modelRuntime, sessionModel);
  const cheap = sessionProvider ? cheapestModel(modelRuntime, sessionProvider) : undefined;

  const cheapSpec: WorkerModelSpec = cheap ? { provider: cheap.provider, model: cheap.id } : {};

  return {
    planner: hasExplicit(configured.planner) ? configured.planner : sessionModel,
    writer: hasExplicit(configured.writer) ? configured.writer : sessionModel,
    worker: hasExplicit(configured.worker) ? configured.worker : cheapSpec,
    verifier: hasExplicit(configured.verifier) ? configured.verifier : cheapSpec,
  };
}

function resolveSessionProvider(
  configured: StageModels,
  modelRuntime: ModelRuntime,
  sessionModel: WorkerModelSpec,
): string | undefined {
  const hint = hasExplicit(configured.planner) ? configured.planner : sessionModel;
  if (hint.provider) return hint.provider;
  const resolved = resolveCliModel({
    cliProvider: hint.provider,
    cliModel: hint.model,
    modelRuntime,
  });
  return resolved.model?.provider;
}

function cheapestModel(modelRuntime: ModelRuntime, provider: string) {
  const available = modelRuntime.getAvailableSnapshot().filter((m) => m.provider === provider);
  if (available.length === 0) return undefined;
  return available.reduce((cheapest, m) => (m.cost.output < cheapest.cost.output ? m : cheapest));
}
