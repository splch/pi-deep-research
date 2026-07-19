import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { BudgetTracker } from "./budget.js";
import { Checkpointer } from "./checkpoint.js";
import { STAGE_ORDER, stageReached } from "./types.js";
import type { ResolvedConfig } from "./config.js";
import { generatePlan } from "./stages/clarify.js";
import { confirmPlan, type GateDecision } from "./stages/gate.js";
import { annotateReport, checkCitations } from "./stages/citations.js";
import { followUpsToAngles, runFollowUpResearch, runReflector } from "./stages/reflect.js";
import { runResearch, type AngleOutcome } from "./stages/research.js";
import { recentConversationContext } from "./session-context.js";
import { extractExecutiveSummary } from "./report-summary.js";
import { computeSurvivingFindingIds, runVerification } from "./stages/verify.js";
import { runWriter } from "./stages/write.js";
import { slugify } from "./ids.js";
import type { ReportMeta } from "./types.js";
import type { SearchProvider } from "./search/provider.js";
import { SourceStore } from "./sources.js";
import { HostLimiter } from "./tools/politeness.js";
import type { ResearchUI } from "./ui.js";
import type { Claim, Finding, ReflectionState, ResearchPlan, RunState, Stage, Verdict } from "./types.js";
import type { ResearchBackend } from "./worker/interface.js";

export interface AppendEntryFn {
  (customType: string, data: unknown): void;
}
export interface SendMessageFn {
  (message: { customType: string; content: string; display: boolean }, options?: { triggerTurn?: boolean }): void;
}

export interface OrchestratorDeps {
  ctx: ExtensionCommandContext;
  appendEntry: AppendEntryFn;
  sendMessage: SendMessageFn;
  config: ResolvedConfig;
  provider: SearchProvider;
  /** In-process backend for planner/verify/write (their terminating tools need in-process capture). */
  backend: ResearchBackend;
  /**
   * Optional backend for the research stage only (e.g. subprocess isolation). Built with the
   * live SourceStore + artifact dir so it can merge fetched sources back. Falls back to `backend`.
   */
  makeResearchBackend?: (store: SourceStore, artifactDir: string) => ResearchBackend;
  ui: ResearchUI;
  runId: string;
  question: string;
}

export interface RunOutcome {
  stage: Stage;
  reportPath?: string;
  findings: number;
  costUSD: number;
  message: string;
}

/**
 * Deterministic stage machine. Owns budget, checkpointing, and the abort signal;
 * each stage is a plain method so a resumed run can jump to the stage after the
 * furthest one already checkpointed.
 */
export class Orchestrator {
  private readonly abortController = new AbortController();
  private readonly store: SourceStore;
  private readonly limiter: HostLimiter;
  private readonly checkpointer: Checkpointer;
  private readonly budget: BudgetTracker;
  private plan?: ResearchPlan;
  private findings: Finding[] = [];
  private outcomes: AngleOutcome[] = [];
  private reflection?: ReflectionState;
  private claims: Claim[] = [];
  private verdicts: Verdict[] = [];
  private findingsPath?: string;
  private sourcesPath?: string;
  private reportPath?: string;
  private meta?: ReportMeta;
  /** Furthest pipeline stage completed; survives terminal checkpoints so resume picks up in the right place. */
  private reached: Stage = "created";

  constructor(
    private readonly deps: OrchestratorDeps,
    resumeState?: RunState,
  ) {
    this.checkpointer = new Checkpointer(deps.appendEntry, deps.config.outDir, deps.runId);
    this.limiter = new HostLimiter();
    this.budget = new BudgetTracker(deps.config.budgetUSD, Date.now(), resumeState?.budget);
    deps.ui.attachBudget(this.budget);

    if (resumeState?.sourcesPath) {
      try {
        this.store = SourceStore.load(resumeState.sourcesPath, this.checkpointer.sourcesArtifactDir);
      } catch {
        this.store = new SourceStore(this.checkpointer.sourcesArtifactDir);
      }
    } else {
      this.store = new SourceStore(this.checkpointer.sourcesArtifactDir);
    }
    if (resumeState?.plan) this.plan = resumeState.plan;
    if (resumeState?.findingsPath) {
      try {
        this.findings = Checkpointer.readFindings(resumeState.findingsPath);
      } catch {
        this.findings = [];
      }
    }
    if (resumeState?.claims) this.claims = resumeState.claims;
    if (resumeState?.verdicts) this.verdicts = resumeState.verdicts;
    if (resumeState?.outcomes) this.outcomes = resumeState.outcomes;
    if (resumeState?.reflection) this.reflection = resumeState.reflection;
    if (resumeState) {
      this.findingsPath = resumeState.findingsPath;
      this.sourcesPath = resumeState.sourcesPath;
      this.reportPath = resumeState.reportPath;
      this.meta = resumeState.meta;
      // Older checkpoints predate `reached`; fall back to `stage` when it names a pipeline stage.
      this.reached = resumeState.reached ?? (STAGE_ORDER.includes(resumeState.stage) ? resumeState.stage : "created");
    }
  }

  /** External cancel (bound to a shortcut / interrupt). */
  abort(): void {
    this.abortController.abort();
  }

  private get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Every checkpoint carries the full known progress (artifact pointers, claims,
   * verdicts, `reached`), so a later terminal checkpoint (failed/aborted) cannot
   * shadow an earlier stage's artifacts under the "latest wins" resume rule.
   */
  private checkpoint(stage: Stage): void {
    if (STAGE_ORDER.includes(stage) && !stageReached(this.reached, stage)) this.reached = stage;
    const state: RunState = {
      version: 1,
      runId: this.deps.runId,
      question: this.deps.question,
      stage,
      reached: this.reached,
      brief: this.plan?.brief,
      plan: this.plan,
      findingsPath: this.findingsPath,
      sourcesPath: this.sourcesPath,
      claims: this.claims.length > 0 ? this.claims : undefined,
      verdicts: this.verdicts.length > 0 ? this.verdicts : undefined,
      outcomes: this.outcomes.length > 0 ? this.outcomes : undefined,
      reflection: this.reflection,
      reportPath: this.reportPath,
      meta: this.meta,
      budget: this.budget.snapshot(),
      updatedAt: new Date().toISOString(),
    };
    this.checkpointer.writeState(state);
    this.deps.ui.setStage(stage);
  }

  async run(): Promise<RunOutcome> {
    try {
      if (stageReached(this.reached, "complete")) {
        this.deps.ui.notify("This run already completed.", "info");
        return {
          stage: "complete",
          reportPath: this.reportPath,
          findings: this.findings.length,
          costUSD: this.budget.costUSD,
          message: `Already complete: ${this.reportPath ?? "(no report path)"}`,
        };
      }

      if (this.plan) this.deps.ui.setAngles(this.plan.angles);

      // Stage 0: plan + confirm (skip if a confirmed plan was restored).
      if (!(stageReached(this.reached, "plan_confirmed") && this.plan)) {
        this.checkpoint("created");
        const plan = await this.planAndConfirm();
        if (!plan) return this.aborted("Cancelled at the plan gate.");
        this.plan = plan;
        this.deps.ui.setAngles(plan.angles);
        this.checkpoint("plan_confirmed");
      }

      // Stage 1: research (skip if findings were restored).
      if (!stageReached(this.reached, "research_done")) {
        this.findings = await this.research();
        if (this.signal.aborted) return this.aborted("Aborted during research.");
      }

      if (this.findings.length === 0) {
        this.checkpoint("failed");
        this.deps.ui.notify("No findings gathered - nothing to verify or report. Try adjusting the angles and --resume.", "warning");
        return { stage: "failed", findings: 0, costUSD: this.budget.costUSD, message: "No findings gathered." };
      }

      // Stage 1.5: reflection (skip if disabled via --max-iters 0 or already done).
      if (this.deps.config.maxIters > 0 && !stageReached(this.reached, "reflect_done")) {
        await this.reflect();
        if (this.signal.aborted) return this.aborted("Aborted during reflection.");
      }

      // Stage 2: factored verification (skip if disabled or already done).
      if (this.deps.config.verify && !stageReached(this.reached, "verify_done")) {
        await this.verify();
        if (this.signal.aborted) return this.aborted("Aborted during verification.");
      }

      return this.finalize();
    } catch (error) {
      // A cancel mid-stage surfaces as an error from the interrupted worker; report it as an abort, not a failure.
      if (this.signal.aborted) return this.aborted("Aborted.");
      const message = error instanceof Error ? error.message : String(error);
      this.checkpoint("failed");
      this.deps.ui.notify(`Research failed: ${message}`, "error");
      return { stage: "failed", findings: this.findings.length, costUSD: this.budget.costUSD, message };
    }
  }

  private async planAndConfirm(): Promise<ResearchPlan | undefined> {
    let question = this.deps.question;
    // Ground the planner in the live conversation so the question can reference it.
    const conversationContext = recentConversationContext(this.deps.ctx.sessionManager);
    for (let attempt = 0; attempt < 4; attempt++) {
      this.deps.ui.setStage("brief");
      const { plan, usage } = await generatePlan({
        backend: this.deps.backend,
        config: this.deps.config,
        runId: this.deps.runId,
        question,
        conversationContext,
        signal: this.signal,
      });
      this.budget.add(usage);

      if (this.deps.config.yes || !this.deps.ctx.hasUI) {
        return { ...plan, confirmedByUser: true };
      }
      const decision: GateDecision = await confirmPlan(this.deps.ctx.ui, plan);
      if (decision.action === "cancel") return undefined;
      if (decision.action === "run") return decision.plan;
      question = `${this.deps.question}\n\nAdditional guidance: ${decision.note}`;
    }
    return undefined;
  }

  private async research(): Promise<Finding[]> {
    if (!this.plan) return [];
    this.deps.ui.setStage("researching");
    const researchBackend = this.deps.makeResearchBackend
      ? this.deps.makeResearchBackend(this.store, this.checkpointer.runDir)
      : this.deps.backend;
    const { findings, outcomes } = await runResearch({
      plan: this.plan,
      backend: researchBackend,
      provider: this.deps.provider,
      store: this.store,
      limiter: this.limiter,
      budget: this.budget,
      config: this.deps.config,
      signal: this.signal,
      onProgress: (p) => this.deps.ui.workerProgress(p.label, p.turns, p.costUSD),
      onOutcome: (o: AngleOutcome) => this.deps.ui.angleDone(o),
    });

    this.outcomes = outcomes;
    this.findingsPath = this.checkpointer.writeFindings(findings);
    this.sourcesPath = join(this.checkpointer.runDir, "sources.json");
    this.store.persist(this.sourcesPath);
    // An aborted fan-out or an empty result is not "research done"; leave `reached`
    // behind so --resume re-runs the stage instead of replaying the dead end.
    if (!this.signal.aborted && findings.length > 0) this.checkpoint("research_done");
    return findings;
  }

  /**
   * Reflection loop: a cheap web-less reflector judges coverage against the plan goals;
   * gaps become one bounded follow-up fan-out per iteration (hard-capped by --max-iters,
   * budget-gated), and unresolved conflicts accumulate for the writer. Each iteration
   * checkpoints so --resume continues the loop instead of restarting it.
   */
  private async reflect(): Promise<void> {
    if (!this.plan) return;
    const maxIters = this.deps.config.maxIters;
    while ((this.reflection?.iterations ?? 0) < maxIters) {
      if (this.signal.aborted || this.budget.overBudget()) break;
      this.deps.ui.setStage("reflecting");
      const iteration = (this.reflection?.iterations ?? 0) + 1;
      const { reflection, error } = await runReflector({
        plan: this.plan,
        outcomes: this.outcomes,
        findings: this.findings,
        backend: this.deps.backend,
        budget: this.budget,
        config: this.deps.config,
        iteration,
        signal: this.signal,
      });
      if (error) {
        // A failed reflector must not sink an otherwise good run; continue without it.
        this.deps.ui.notify(`Reflection pass ${iteration} failed (${error}); continuing without it.`, "warning");
        break;
      }
      if (!reflection) break; // aborted mid-pass
      this.reflection = {
        iterations: iteration,
        gaps: reflection.gaps,
        conflicts: [...(this.reflection?.conflicts ?? []), ...reflection.conflicts],
      };

      const followUps = followUpsToAngles(reflection.followUpAngles, iteration);
      if (followUps.length === 0) break; // coverage complete: no more iterations needed
      if (this.signal.aborted || this.budget.overBudget()) break;

      this.deps.ui.setAngles(followUps);
      const researchBackend = this.deps.makeResearchBackend
        ? this.deps.makeResearchBackend(this.store, this.checkpointer.runDir)
        : this.deps.backend;
      const extra = await runFollowUpResearch(
        {
          plan: this.plan,
          backend: researchBackend,
          provider: this.deps.provider,
          store: this.store,
          limiter: this.limiter,
          budget: this.budget,
          config: this.deps.config,
          signal: this.signal,
          onProgress: (p) => this.deps.ui.workerProgress(p.label, p.turns, p.costUSD),
          onOutcome: (o) => this.deps.ui.angleDone(o),
        },
        followUps,
      );
      this.findings = [...this.findings, ...extra.findings];
      this.outcomes = [...this.outcomes, ...extra.outcomes];
      this.findingsPath = this.checkpointer.writeFindings(this.findings);
      this.sourcesPath = this.sourcesPath ?? join(this.checkpointer.runDir, "sources.json");
      this.store.persist(this.sourcesPath);
      this.checkpoint("reflecting");
    }
    // Stamp reflect_done only when at least one pass actually ran: a fully budget-skipped
    // or failed reflection is not progress, so --resume may retry it (e.g. with --budget raised).
    if (!this.signal.aborted && (this.reflection?.iterations ?? 0) > 0) this.checkpoint("reflect_done");
  }

  private async verify(): Promise<void> {
    this.deps.ui.setStage("verifying");
    const result = await runVerification({
      findings: this.findings,
      store: this.store,
      backend: this.deps.backend,
      budget: this.budget,
      config: this.deps.config,
      signal: this.signal,
      onProgress: (done, total) => this.deps.ui.setVerifyProgress(done, total),
    });
    this.claims = result.claims;
    this.verdicts = result.verdicts;
    // Verdicts from an aborted pass are partial (vote loops bail out); don't stamp the stage done.
    if (!this.signal.aborted) this.checkpoint("verify_done");
  }

  /** Stages 3-4: single-writer report, citation-integrity check, and finalize. */
  private async finalize(): Promise<RunOutcome> {
    if (!this.plan) throw new Error("Cannot finalize without a plan.");
    const survivingIds = computeSurvivingFindingIds(this.findings, this.claims, this.verdicts);
    const surviving = this.findings.filter((f) => survivingIds.has(f.id));
    const claimsToFindingIds = new Map(this.claims.map((c) => [c.id, c.findingIds]));

    this.deps.ui.setStage("writing");
    const { markdown, sources } = await runWriter({
      brief: this.plan.brief,
      findings: surviving,
      verdicts: this.verdicts,
      openConflicts: this.reflection?.conflicts,
      claimsToFindingIds,
      store: this.store,
      backend: this.deps.backend,
      budget: this.budget,
      config: this.deps.config,
      signal: this.signal,
    });

    this.deps.ui.setStage("citation_check");
    const citation = checkCitations(markdown, this.store);
    const finalMarkdown = annotateReport(markdown, citation);

    const reportPath = join(this.deps.config.outDir, `${this.deps.runId}-${slugify(this.deps.question)}.md`);
    writeFileSync(reportPath, finalMarkdown, "utf8");

    const refuted = this.verdicts.filter((v) => v.verdict === "refuted" || v.verdict === "unsupported").length;
    const verified = this.verdicts.filter((v) => v.verdict === "supported" || v.verdict === "partially_supported").length;
    const meta: ReportMeta = {
      runId: this.deps.runId,
      title: this.plan.brief.refinedQuestion,
      question: this.deps.question,
      generatedAt: new Date().toISOString(),
      model: this.deps.config.models.writer.model ?? "session-default",
      wordCount: finalMarkdown.split(/\s+/).filter(Boolean).length,
      sourceCount: sources.length,
      claimCount: this.claims.length,
      verifiedCount: verified,
      refutedCount: refuted,
      citationsChecked: citation.checked,
      citationsFailed: citation.failed,
      costUSD: Number(this.budget.costUSD.toFixed(4)),
      elapsedMs: this.budget.snapshot().wallMs,
      outputPath: reportPath,
    };
    writeFileSync(join(this.checkpointer.runDir, "report-meta.json"), JSON.stringify(meta, null, 2), "utf8");
    this.reportPath = reportPath;
    this.meta = meta;
    this.checkpoint("complete");

    const flagNote = citation.failed > 0 ? ` ⚠ ${citation.failed} unverifiable citation(s) flagged.` : "";
    const stats =
      `${sources.length} sources, ${verified} verified / ${refuted} dropped claims, ` +
      `$${this.budget.costUSD.toFixed(2)}, ${Math.round(meta.elapsedMs / 1000)}s.${flagNote}`;
    // Hand the executive summary back to the session agent and trigger a turn, so the
    // conversation continues from the findings without the user having to prompt it.
    const message =
      `Deep research complete: "${this.plan.brief.refinedQuestion}"\n\n` +
      `Executive summary:\n${extractExecutiveSummary(finalMarkdown)}\n\n` +
      `${stats}\nFull report: ${reportPath}\n\n` +
      `Continue from these findings: relate them to the user's question and the conversation so far, and flag any evidence gaps.`;
    this.deps.sendMessage({ customType: "research-report", content: message, display: true }, { triggerTurn: true });
    this.deps.ui.notify("Research complete.", "info");
    return { stage: "complete", reportPath, findings: surviving.length, costUSD: this.budget.costUSD, message };
  }

  private aborted(message: string): RunOutcome {
    this.checkpoint("aborted");
    this.deps.ui.notify(message, "warning");
    return { stage: "aborted", findings: this.findings.length, costUSD: this.budget.costUSD, message };
  }
}
