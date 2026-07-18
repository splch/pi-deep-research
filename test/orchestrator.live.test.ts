import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { Orchestrator } from "../src/orchestrator.js";
import { resolveSearchProvider } from "../src/search/index.js";
import { createSdkBackend } from "../src/worker/sdk-backend.js";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { RunState } from "../src/types.js";
import { ResearchUI } from "../src/ui.js";

const live = process.env.PI_DR_LIVE === "1";

// Minimal ctx: the orchestrator only reads hasUI + ui, and only touches ui when hasUI && !yes.
function stubCtx(cwd: string): ExtensionCommandContext {
  return {
    hasUI: false,
    cwd,
    ui: { notify() {}, setWidget() {}, setStatus() {} },
    sessionManager: { getEntries: () => [] },
  } as unknown as ExtensionCommandContext;
}

describe.runIf(live)("orchestrator (live, full pipeline)", () => {
  it(
    "plans, researches in parallel, checkpoints, and produces a digest under budget",
    async () => {
      const cwd = mkdtempSync(join(tmpdir(), "pi-dr-orch-"));
      const config = resolveConfig({
        flags: { depth: "quick", workers: "2", budget: "1.50", yes: true },
        defaultOutDir: join(cwd, "research"),
      });
      const { provider } = resolveSearchProvider(config.provider);
      const backend = createSdkBackend({ agentDir: getAgentDir(), cwd });
      const ctx = stubCtx(cwd);
      const ui = new ResearchUI(ctx.ui, false, "q");

      const states: RunState[] = [];
      const question = "What is Pi, the coding agent by Earendil, and how are extensions structured?";
      const orch = new Orchestrator({
        ctx,
        appendEntry: (customType, data) => {
          if (customType === "research:state") states.push(data as RunState);
        },
        sendMessage: () => {},
        config,
        provider,
        backend,
        ui,
        runId: "livetest",
        question,
      });

      const outcome = await orch.run();
      console.log("outcome:", outcome.stage, "findings:", outcome.findings, "cost:", outcome.costUSD.toFixed(3));
      const stages = states.map((s) => s.stage);
      console.log("checkpoint stages:", stages);

      expect(outcome.stage).toBe("complete");
      expect(outcome.findings).toBeGreaterThan(0);
      expect(outcome.costUSD).toBeLessThanOrEqual(1.5);
      expect(stages).toEqual(
        expect.arrayContaining(["created", "plan_confirmed", "research_done", "verify_done", "complete"]),
      );

      // A real cited markdown report was written.
      expect(outcome.reportPath && existsSync(outcome.reportPath)).toBeTruthy();
      const report = readFileSync(outcome.reportPath!, "utf8");
      console.log("report length:", report.length);
      expect(report).toMatch(/^#\s+/m); // has a heading
      expect(report.toLowerCase()).toContain("sources");
      expect(report).toMatch(/https?:\/\//); // has citations

      // ReportMeta reflects verification + citation checks.
      const finalState = states[states.length - 1];
      const meta = finalState?.meta;
      expect(meta).toBeDefined();
      console.log("meta:", JSON.stringify(meta));
      expect(meta!.sourceCount).toBeGreaterThan(0);
      expect(meta!.citationsChecked).toBeGreaterThanOrEqual(0);
      expect(meta!.outputPath).toBe(outcome.reportPath);

      // Every URL the report cites must be one we fetched (citation integrity held, or was flagged).
      if (meta!.citationsFailed > 0) {
        expect(report).toContain("Citation-integrity warning");
      }

      // Checkpoints carry artifact pointers for resume.
      const researchDone = states.find((s) => s.stage === "research_done");
      expect(researchDone?.findingsPath && existsSync(researchDone.findingsPath)).toBeTruthy();
      expect(researchDone?.sourcesPath && existsSync(researchDone.sourcesPath)).toBeTruthy();
    },
    600_000,
  );

  it(
    "resume short-circuits a run already past research_done",
    async () => {
      const cwd = mkdtempSync(join(tmpdir(), "pi-dr-resume-"));
      const config = resolveConfig({ flags: { depth: "quick", workers: "1", yes: true }, defaultOutDir: join(cwd, "research") });
      const { provider } = resolveSearchProvider(config.provider);
      // Research-shaped workers throw - proves resume did NOT re-research. Verify and
      // write legitimately still run on a research_done resume, so they get the real backend.
      const sdk = createSdkBackend({ agentDir: getAgentDir(), cwd });
      const backend: typeof sdk = {
        name: "guard",
        async runWorker(spec, signal, onProgress) {
          if (spec.toolNames.includes("submit_findings")) {
            throw new Error("research worker should not run when resuming past research_done");
          }
          return sdk.runWorker(spec, signal, onProgress);
        },
      };
      const ctx = stubCtx(cwd);
      const ui = new ResearchUI(ctx.ui, false, "q");

      // Seed artifacts by hand-building a research_done state. The seeded source must
      // actually support the seeded claim, or live verification will rightly drop it.
      const runId = "resumetest";
      const runDir = join(cwd, "research", "runs", runId);
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(runDir, { recursive: true });
      const findingsPath = join(runDir, "findings.json");
      const sourcesPath = join(runDir, "sources.json");
      const { SourceStore } = await import("../src/sources.js");
      const seededStore = new SourceStore(runDir);
      seededStore.register({
        url: "https://example.com/pi-facts",
        finalUrl: "https://example.com/pi-facts",
        title: "Pi facts",
        httpStatus: 200,
        contentType: "text/html",
        fullText:
          "Pi is a minimal coding agent made by Earendil Inc. " +
          "Extensions for Pi are TypeScript modules that register commands, tools, and keyboard shortcuts.",
        byAngle: "a1",
        truncated: false,
        excerptChars: 100,
      });
      seededStore.persist(sourcesPath);
      writeFileSync(
        findingsPath,
        JSON.stringify([
          {
            id: "a1-f1",
            angleId: "a1",
            claim: "Pi extensions are TypeScript modules.",
            citations: [{ url: "https://example.com/pi-facts" }],
            confidenceSelf: "high",
          },
        ]),
      );
      const resumeState: RunState = {
        version: 1,
        runId,
        question: "seeded question",
        stage: "research_done",
        plan: {
          runId,
          brief: { runId, question: "seeded question", refinedQuestion: "What are Pi extensions?", goals: [], inScope: [], outOfScope: [], depth: "quick", createdAt: "now" },
          angles: [{ id: "a1", title: "seeded angle", rationale: "r", seedQueries: ["s"], priority: 1 }],
          maxWorkers: 1,
          perWorkerTurnCap: 4,
          confirmedByUser: true,
          createdAt: "now",
        },
        findingsPath,
        sourcesPath,
        budget: { costUSD: 0.2, tokensIn: 0, tokensOut: 0, workerTurns: 1, wallMs: 0, capsHit: [] },
        updatedAt: "now",
      };

      const orch = new Orchestrator(
        { ctx, appendEntry: () => {}, sendMessage: () => {}, config, provider, backend, ui, runId, question: "seeded question" },
        resumeState,
      );
      const outcome = await orch.run();
      expect(outcome.stage).toBe("complete");
      expect(outcome.findings).toBe(1); // the seeded finding, no re-research
      expect(outcome.reportPath && existsSync(outcome.reportPath)).toBeTruthy();
    },
    240_000, // live verify + write run on resume; only research is guarded out
  );
});
