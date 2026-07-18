import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { Orchestrator } from "../src/orchestrator.js";
import type { SearchProvider } from "../src/search/provider.js";
import type { RunState } from "../src/types.js";
import { ResearchUI } from "../src/ui.js";
import type { ResearchBackend, WorkerResult, WorkerRunSpec } from "../src/worker/interface.js";

// Offline orchestrator tests: a scripted backend plays every stage role, so the whole
// stage machine (checkpointing, resume, citation integrity) runs without LLM or network.

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

type StageScript = Partial<Record<"submit_plan" | "submit_findings" | "submit_verdict" | "writer", (spec: WorkerRunSpec<unknown>) => unknown>>;

function scriptedBackend(script: StageScript = {}): ResearchBackend {
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
    submit_findings: (spec) => ({
      findings: [{ claim: `claim from ${spec.label}`, citations: [{ url: "https://example.com/a" }], confidenceSelf: "high" }],
    }),
    submit_verdict: () => ({ verdict: "supported", confidence: 0.9, rationale: "excerpts match" }),
    writer: () => REPORT,
  };
  return {
    name: "scripted",
    async runWorker<T>(spec: WorkerRunSpec<T>): Promise<WorkerResult<T>> {
      const kind = (["submit_plan", "submit_findings", "submit_verdict"] as const).find((k) => spec.toolNames.includes(k));
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

interface SentMessage {
  message: { customType: string; content: string; display: boolean };
  options?: { triggerTurn?: boolean };
}

function makeOrchestrator(cwd: string, backend: ResearchBackend, states: RunState[], runId: string, resume?: RunState, sent: SentMessage[] = []) {
  const config = resolveConfig({ flags: { depth: "quick", votes: "1", yes: true }, env: {}, defaultOutDir: join(cwd, "research") });
  const ctx = stubCtx(cwd);
  return new Orchestrator(
    {
      ctx,
      appendEntry: (customType, data) => {
        if (customType === "research:state") states.push(data as RunState);
      },
      sendMessage: (message, options) => {
        sent.push({ message, options });
      },
      config,
      provider,
      backend,
      ui: new ResearchUI(ctx.ui, false, "q"),
      runId,
      question: "What is X?",
    },
    resume,
  );
}

describe("orchestrator (offline, scripted backend)", () => {
  it("runs the full pipeline and flags unverifiable citations", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-orch-unit-"));
    const states: RunState[] = [];
    const sent: SentMessage[] = [];
    const outcome = await makeOrchestrator(cwd, scriptedBackend(), states, "t1", undefined, sent).run();

    expect(outcome.stage).toBe("complete");
    // The finished report's summary is handed to the session agent with a follow-up turn.
    const handoff = sent.find((s) => s.message.customType === "research-report");
    expect(handoff?.options?.triggerTurn).toBe(true);
    expect(handoff?.message.content).toContain("A cited claim [1].");
    expect(handoff?.message.content).toContain("Continue from these findings");
    expect(outcome.findings).toBe(2); // one finding per angle survived
    expect(states.map((s) => s.stage)).toEqual(["created", "plan_confirmed", "research_done", "verify_done", "complete"]);
    expect(states.at(-1)?.reached).toBe("complete");
    expect(states.at(-1)?.meta?.outputPath).toBe(outcome.reportPath);

    const report = readFileSync(outcome.reportPath!, "utf8");
    expect(report).toContain("# Stub Report");
    // The stub writer cites a URL nothing fetched -> integrity pass must flag it, not trust it.
    expect(report).toContain("Citation-integrity warning");
    expect(states.at(-1)?.meta?.citationsFailed).toBe(1);
  });

  it("resumes a failed run from the last completed stage without re-researching", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-orch-resume-"));
    const states: RunState[] = [];
    const failing = scriptedBackend({
      submit_verdict: () => {
        throw new Error("verifier down");
      },
    });

    const failed = await makeOrchestrator(cwd, failing, states, "t2").run();
    expect(failed.stage).toBe("failed");
    const failedState = states.at(-1)!;
    expect(failedState.stage).toBe("failed");
    // The terminal checkpoint must still carry the progress marker and artifact pointers.
    expect(failedState.reached).toBe("research_done");
    expect(failedState.findingsPath && existsSync(failedState.findingsPath)).toBeTruthy();
    expect(failedState.sourcesPath && existsSync(failedState.sourcesPath)).toBeTruthy();

    // Resume with a healthy verifier but a research stage that would blow up if re-run.
    const guarded = scriptedBackend({
      submit_findings: () => {
        throw new Error("must not re-research on resume");
      },
    });
    const resumeStates: RunState[] = [];
    const outcome = await makeOrchestrator(cwd, guarded, resumeStates, "t2", failedState).run();

    expect(outcome.stage).toBe("complete");
    expect(outcome.findings).toBe(2); // the findings restored from the checkpoint artifacts
    expect(resumeStates.map((s) => s.stage)).toEqual(["verify_done", "complete"]);
  });

  it("does not stamp research_done on a zero-finding run, so --resume re-researches", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-orch-empty-"));
    const states: RunState[] = [];
    const empty = scriptedBackend({ submit_findings: () => ({ findings: [] }) });

    const outcome = await makeOrchestrator(cwd, empty, states, "t4").run();
    expect(outcome.stage).toBe("failed");
    const failedState = states.at(-1)!;
    // A dead-end research pass must not count as progress, or resume would replay the failure.
    expect(failedState.reached).toBe("plan_confirmed");

    const resumed = await makeOrchestrator(cwd, scriptedBackend(), [], "t4", failedState).run();
    expect(resumed.stage).toBe("complete");
    expect(resumed.findings).toBe(2);
  });

  it("short-circuits when resuming an already-complete run", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-dr-orch-done-"));
    const states: RunState[] = [];
    await makeOrchestrator(cwd, scriptedBackend(), states, "t3").run();
    const completeState = states.at(-1)!;

    const guard: ResearchBackend = {
      name: "guard",
      async runWorker(): Promise<never> {
        throw new Error("nothing should run on a complete resume");
      },
    };
    const outcome = await makeOrchestrator(cwd, guard, [], "t3", completeState).run();
    expect(outcome.stage).toBe("complete");
    expect(outcome.reportPath).toBe(completeState.reportPath);
  });
});
