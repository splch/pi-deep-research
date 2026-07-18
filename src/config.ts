import type { WorkerModelSpec } from "./worker/interface.js";

export type Depth = "quick" | "standard" | "deep";
export type BackendKind = "sdk" | "subprocess";

export interface StageModels {
  planner: WorkerModelSpec;
  worker: WorkerModelSpec;
  verifier: WorkerModelSpec;
  writer: WorkerModelSpec;
}

export interface ResolvedConfig {
  provider?: string;
  depth: Depth;
  maxWorkers: number;
  votes: number;
  budgetUSD: number;
  verify: boolean;
  outDir: string;
  backend: BackendKind;
  yes: boolean;
  perWorkerTurnCap: number;
  perWorkerWallMs: number;
  maxFetchChars: number;
  models: StageModels;
}

export interface DepthProfile {
  minAngles: number;
  maxAngles: number;
  maxWorkers: number;
  perWorkerTurnCap: number;
  maxClaims: number;
}

export const DEPTH_PROFILES: Record<Depth, DepthProfile> = {
  quick: { minAngles: 2, maxAngles: 3, maxWorkers: 3, perWorkerTurnCap: 6, maxClaims: 6 },
  standard: { minAngles: 4, maxAngles: 6, maxWorkers: 4, perWorkerTurnCap: 8, maxClaims: 12 },
  deep: { minAngles: 6, maxAngles: 8, maxWorkers: 4, perWorkerTurnCap: 12, maxClaims: 24 },
};

/** Reads a value with precedence: explicit flag > env > default. */
type Flags = Record<string, string | boolean | undefined>;
type Env = Record<string, string | undefined>;

function pickString(flag: string | boolean | undefined, env: string | undefined): string | undefined {
  if (typeof flag === "string" && flag.length > 0) return flag;
  if (env && env.length > 0) return env;
  return undefined;
}

function pickNumber(flag: string | boolean | undefined, env: string | undefined, fallback: number): number {
  const raw = pickString(flag, env);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function modelSpec(raw: string | undefined): WorkerModelSpec {
  if (!raw) return {};
  // "provider/pattern:thinking" | "pattern:thinking" | "pattern"
  let provider: string | undefined;
  let rest = raw;
  const slash = raw.indexOf("/");
  if (slash > 0) {
    provider = raw.slice(0, slash);
    rest = raw.slice(slash + 1);
  }
  let thinkingLevel: WorkerModelSpec["thinkingLevel"];
  const colon = rest.lastIndexOf(":");
  if (colon > 0) {
    const level = rest.slice(colon + 1);
    if (["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(level)) {
      thinkingLevel = level as WorkerModelSpec["thinkingLevel"];
      rest = rest.slice(0, colon);
    }
  }
  return { provider, model: rest || undefined, thinkingLevel };
}

export interface ResolveConfigInput {
  flags: Flags;
  env?: Env;
  defaultOutDir: string;
}

export function resolveConfig(input: ResolveConfigInput): ResolvedConfig {
  const { flags, env = process.env, defaultOutDir } = input;

  // Unknown enum values throw instead of silently defaulting: a typo'd --depth or
  // --backend would otherwise change semantics without the user noticing.
  const depth = (pickString(flags.depth, env.PI_RESEARCH_DEPTH) ?? "standard") as Depth;
  const profile: DepthProfile | undefined = DEPTH_PROFILES[depth];
  if (!profile) {
    throw new Error(`Unknown depth "${depth}". Supported: ${Object.keys(DEPTH_PROFILES).join(", ")}.`);
  }

  const backend = (pickString(flags.backend, env.PI_RESEARCH_BACKEND) ?? "sdk") as BackendKind;
  if (backend !== "sdk" && backend !== "subprocess") {
    throw new Error(`Unknown backend "${backend}". Supported: sdk, subprocess.`);
  }

  const plannerRaw = pickString(flags.planner, env.PI_RESEARCH_PLANNER_MODEL);
  const workerRaw = pickString(flags.worker, env.PI_RESEARCH_WORKER_MODEL);
  const verifierRaw = pickString(flags.verifier, env.PI_RESEARCH_VERIFIER_MODEL);
  const writerRaw = pickString(flags.writer, env.PI_RESEARCH_WRITER_MODEL);

  return {
    provider: pickString(flags.provider, env.PI_RESEARCH_PROVIDER),
    depth,
    maxWorkers: Math.min(pickNumber(flags.workers, env.PI_RESEARCH_WORKERS, profile.maxWorkers), 8),
    votes: Math.min(pickNumber(flags.votes, env.PI_RESEARCH_VOTES, 2), 5),
    budgetUSD: pickNumber(flags.budget, env.PI_RESEARCH_BUDGET_USD, 2.0),
    verify: flags["no-verify"] !== true,
    outDir: pickString(flags.out, env.PI_RESEARCH_OUT_DIR) ?? defaultOutDir,
    backend,
    yes: flags.yes === true,
    perWorkerTurnCap: pickNumber(flags["turn-cap"], env.PI_RESEARCH_TURN_CAP, profile.perWorkerTurnCap),
    perWorkerWallMs: pickNumber(flags["wall-secs"], env.PI_RESEARCH_WALL_SECS, 180) * 1000,
    maxFetchChars: pickNumber(flags["max-fetch"], env.PI_RESEARCH_MAX_FETCH, 8000),
    models: {
      // Planner/writer default to the session model (undefined -> resolver picks default); worker/verifier too,
      // but callers may pass a cheaper sibling. Empty spec = "use the registry default".
      planner: modelSpec(plannerRaw),
      worker: modelSpec(workerRaw),
      verifier: modelSpec(verifierRaw ?? workerRaw),
      writer: modelSpec(writerRaw ?? plannerRaw),
    },
  };
}
