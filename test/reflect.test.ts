import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { BudgetTracker } from "../src/budget.js";
import { resolveConfig, type ResolvedConfig } from "../src/config.js";
import { Orchestrator } from "../src/orchestrator.js";
import type { SearchProvider } from "../src/search/provider.js";
import { followUpsToAngles, runReflector } from "../src/stages/reflect.js";
import { ResearchUI } from "../src/ui.js";
import type { RunState, SubmitReflectionPayload } from "../src/types.js";
import type { ResearchBackend, WorkerResult, WorkerRunSpec } from "../src/worker/interface.js";

// Offline reflection tests: a scripted backend plays every stage role, so the reflection
// loop (follow-up dispatch, no-op, budget gate, resume across the boundary) runs without
// LLM or network.

const provider: SearchProvider = { name: "stub", async search() { return []; } };

function stubCtx(cwd: string): ExtensionCommandContext {
  return {
    hasUI: false,
    cwd,
    ui: { notify() {}, setWidget() {}, setStatus() {} },
    sessionManager: { getEntries: () => [] },
  } as unknown as ExtensionCommandContext;
}

const usage = () => ({ costUSD: 0.01, tokensIn: 10, tokensOut: 5, turns: 1 });

const REPORT = ["# Stub Report", "", "A cited claim [1].", "", "## Sources", "[1] Example - https://example.com/a", ""].join("\n");

const NO_FOLLOW_UP: SubmitReflectionPayload = { gaps: [], conflicts: [], followUpAngles: [] };

const THIN_COVERAGE: SubmitReflectionPayload = {
  gaps: ["no cost data gathered"],
  conflicts: ["Angles disagree on whether X is stable"],
  followUpAngles: [{ title: "Cost angle", rationale: "close the cost gap", seedQueries: ["q3"], priority: 1 }],
};

type StageScript = Partial<
  Record<"submit_plan" | "submit_reflection" | "submit_findings" | "submit_verdict" | "writer", (spec: WorkerRunSpec<unknown>) => unknown>
>;

function scriptedBackend(script: StageScript = {}, calls: string[] = []): ResearchBackend {
  const defaults: Required<StageScript> = {
    submit_plan: () => ({
      refinedQuestion: "What is X?",
      goals: ["understand X"],
      inScope: ["x"],
      outOfScope: [],
      angles: [
        { title: "Angle one", rationale: "r1", seedQueries: ["q1"], priority: 1 },
        { title: "Angle two", rationale: "r2", seedQueries: ["q2"], priority: 2 },
      ],
    }),
    submit_reflection: () => NO_FOLLOW_UP,
    submit_findings: (spec) => ({
      findings: [{ claim: `claim from ${spec.label}`, citations: [{ url: "https://example.com/a" }], confidenceSelf: "high" }],
    }),
    submit_verdict: () => ({ verdict: "supported", confidence: 0.9, rationale: "excerpts match" }),
    writer: () => REPORT,
  };
  return {
    name: "scripted",
    async runWorker<T>(spec: WorkerRunSpec<T>): Promise<WorkerResult<T>> {
      const kind = (["submit_plan", "submit_reflection", "submit_findings", "submit_verdict"] as const).find((k) =>
        spec.toolNames.includes(k),
      );
      calls.push(kind ? `${kind}:${spec.label}` : `writer:${spec.label}`);
      if (!kind) {
        // No terminating tool = the writer; its report is captured as salvaged free text.
        const text = (script.writer ?? defaults.writer)(spec as WorkerRunSpec<unknown>);
        return { label: spec.label, status: "salvaged", salvagedText: String(text), usage: usage() };
      }
      const payload = (script[kind] ?? defaults[kind])(spec as WorkerRunSpec<unknown>);
      return { label: spec.label, status: "ok", result: payload as T, usage: usage() };
    },
  };
}

function makeConfig(cwd: string, flags: Record<string, string | boolean> = {}): ResolvedConfig {
  return resolveConfig({
    flags: { depth: "quick", "max-iters": "1", votes: "1", yes: true, ...flags },
    env: {},
    defaultOutDir: join(cwd, "research"),
  });
}

function makeOrchestrator(
  cwd: string,
  backend: ResearchBackend,
  states: RunState[],
  runId: string,
  resume?: RunState,
  configFlags: Record<string, string | boolean> = {},
) {
  const ctx = stubCtx(cwd);
  return new Orchestrator(
    {
      ctx,
      appendEntry: (customType, data) => {
        if (customType === "research:state") states.push(data as RunState);
      },
      sendMessage: () => {},
      config: makeConfig(cwd, configFlags),
      provider,
      backend,
      ui: new ResearchUI(ctx.ui, false, "q"),
      runId,
      question: "What is X?",
    },
    resume,
  );
}

describe("followUpsToAngles", () => {
  it("assigns collision-free ids and sorts by priority", () => {
    const angles = followUpsToAngles(
      [
        { title: "B", rationale: "r", seedQueries: ["q"], priority: 2 },
        { title: "A", rationale: "r", seedQueries: ["q"], priority: 1 },
      ],
      2,
    );
    expect(angles.map((a) => a.title)).toEqual(["A", "B"]);
    expect(angles.map((a) => a.id)).toEqual(["a1r2", "a2r2"]);
  });
});

describe("runReflector", () => {
  const plan = {
    runId: "r",
    brief: {
      runId: "r",
      question: "q",
      refinedQuestion: "q",
      goals: ["g"],
      inScope: [],
      outOfScope: [],
      depth: "quick" as const,
      createdAt: "now",
    },
    angles: [],
    maxWorkers: 1,
    perWorkerTurnCap: 0,
    confirmedByUser: true,
    createdAt: "now",
  };

  it("returns the schema-validated payload and charges the budget", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-reflector-"));
    const budget = new BudgetTracker(1);
    const { reflection, error } = await runReflector({
      plan,
      outcomes: [],
      findings: [],
      backend: scriptedBackend({ submit_reflection: () => THIN_COVERAGE }),
      budget,
      config: makeConfig(cwd),
      iteration: 1,
    });
    expect(error).toBeUndefined();
    expect(reflection).toEqual(THIN_COVERAGE);
    expect(budget.costUSD).toBeGreaterThan(0);
  });

  it("reports a worker failure as an error instead of throwing", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-reflector-"));
    const failing: ResearchBackend = {
      name: "failing",
      async runWorker<T>(spec: WorkerRunSpec<T>): Promise<WorkerResult<T>> {
        return { label: spec.label, status: "error", error: "model down", usage: usage() };
      },
    };
    const { reflection, error } = await runReflector({
      plan,
      outcomes: [],
      findings: [],
      backend: failing,
      budget: new BudgetTracker(1),
      config: makeConfig(cwd),
      iteration: 1,
    });
    expect(reflection).toBeUndefined();
    expect(error).toContain("model down");
  });
});

describe("orchestrator reflection loop (offline, scripted backend)", () => {
  it("thin coverage -> follow-up angle dispatched and findings merged", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-reflect-thin-"));
    const states: RunState[] = [];
    const calls: string[] = [];
    const backend = scriptedBackend({ submit_reflection: () => THIN_COVERAGE }, calls);

    const outcome = await makeOrchestrator(cwd, backend, states, "rf1").run();

    expect(outcome.stage).toBe("complete");
    // 2 base angles + 1 follow-up angle each produced one finding.
    expect(outcome.findings).toBe(3);
    expect(calls).toContain("submit_findings:a1r1");
    expect(states.map((s) => s.stage)).toEqual([
      "created",
      "plan_confirmed",
      "research_done",
      "reflecting",
      "reflect_done",
      "verify_done",
      "complete",
    ]);
    // The conflict and iteration count are checkpointed for the writer / resume.
    expect(states.at(-1)?.reflection).toEqual({
      iterations: 1,
      gaps: ["no cost data gathered"],
      conflicts: ["Angles disagree on whether X is stable"],
    });
    // Follow-up fan-out outcomes are recorded alongside the base ones.
    expect(states.at(-1)?.outcomes?.map((o) => o.angleId)).toEqual(["a1", "a2", "a1r1"]);
  });

  it("full coverage -> no-op (no follow-up fan-out)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-reflect-full-"));
    const states: RunState[] = [];
    const calls: string[] = [];
    const backend = scriptedBackend({ submit_reflection: () => NO_FOLLOW_UP }, calls);

    const outcome = await makeOrchestrator(cwd, backend, states, "rf2").run();

    expect(outcome.stage).toBe("complete");
    expect(outcome.findings).toBe(2);
    expect(calls.filter((c) => c.startsWith("submit_findings"))).toHaveLength(2); // base angles only
    expect(states.map((s) => s.stage)).toEqual([
      "created",
      "plan_confirmed",
      "research_done",
      "reflect_done",
      "verify_done",
      "complete",
    ]);
  });

  it("is budget-gated: no reflector worker and no reflect_done when spent", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-reflect-budget-"));
    const states: RunState[] = [];
    const calls: string[] = [];
    // Planner (0.01) + two research workers (0.02) exhaust a 0.03 budget before reflection.
    const backend = scriptedBackend({}, calls);

    const outcome = await makeOrchestrator(cwd, backend, states, "rf3", undefined, { budget: "0.03" }).run();

    expect(outcome.stage).toBe("complete");
    expect(calls.some((c) => c.startsWith("submit_reflection"))).toBe(false);
    expect(states.map((s) => s.stage)).not.toContain("reflect_done");
  });

  it("resumes across the reflection boundary without re-reflecting, keeping conflicts for the writer", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-reflect-resume-"));
    const writerTasks: string[] = [];
    const failing = scriptedBackend({
      submit_reflection: () => ({ ...THIN_COVERAGE, followUpAngles: [] }),
      submit_verdict: () => {
        throw new Error("verifier down");
      },
      writer: (spec) => {
        writerTasks.push(spec.task);
        return REPORT;
      },
    });

    const states: RunState[] = [];
    const failed = await makeOrchestrator(cwd, failing, states, "rf4").run();
    expect(failed.stage).toBe("failed");
    const failedState = states.at(-1)!;
    expect(failedState.reached).toBe("reflect_done");
    expect(failedState.reflection?.conflicts).toEqual(["Angles disagree on whether X is stable"]);

    // Resume: any replay of plan/research/reflection would throw, proving the resume skips them.
    const guarded = scriptedBackend({
      submit_plan: () => {
        throw new Error("must not re-plan");
      },
      submit_reflection: () => {
        throw new Error("must not re-reflect");
      },
      submit_findings: () => {
        throw new Error("must not re-research");
      },
      writer: (spec) => {
        writerTasks.push(spec.task);
        return REPORT;
      },
    });
    const resumeStates: RunState[] = [];
    const outcome = await makeOrchestrator(cwd, guarded, resumeStates, "rf4", failedState).run();

    expect(outcome.stage).toBe("complete");
    expect(resumeStates.map((s) => s.stage)).toEqual(["verify_done", "complete"]);
    // The conflict checkpointed before the failure reaches the writer as an explicit section.
    expect(writerTasks.at(-1)).toContain("## Open conflicts");
    expect(writerTasks.at(-1)).toContain("Angles disagree on whether X is stable");
  });
});
