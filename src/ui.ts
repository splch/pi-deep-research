import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { BudgetTracker } from "./budget.js";
import type { AngleOutcome } from "./stages/research.js";
import type { ResearchAngle, Stage } from "./types.js";

const WIDGET_KEY = "deep-research";
const STATUS_KEY = "deep-research";

const STAGE_LABEL: Record<Stage, string> = {
  created: "starting",
  brief: "planning",
  plan_confirmed: "plan confirmed",
  researching: "researching",
  research_done: "research done",
  verifying: "verifying",
  verify_done: "verified",
  writing: "writing report",
  citation_check: "checking citations",
  complete: "complete",
  failed: "failed",
  aborted: "aborted",
};

interface AngleView {
  title: string;
  status: AngleOutcome["status"] | "pending" | "running";
  turns: number;
  costUSD: number;
  findingCount: number;
}

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  running: "◐",
  ok: "●",
  salvaged: "◍",
  capped: "◍",
  skipped: "–",
  aborted: "×",
  error: "×",
};

/**
 * Live progress board. All calls are no-ops when the run is headless (print/json/rpc
 * without a TUI), so the same orchestrator drives interactive and unattended runs.
 */
export class ResearchUI {
  private stage: Stage = "created";
  private readonly angles = new Map<string, AngleView>();
  private budget?: BudgetTracker;
  private started = Date.now();
  private verifyProgress?: { done: number; total: number };

  constructor(
    private readonly ui: ExtensionUIContext,
    private readonly enabled: boolean,
    private readonly question: string,
  ) {}

  attachBudget(budget: BudgetTracker): void {
    this.budget = budget;
  }

  setStage(stage: Stage): void {
    this.stage = stage;
    this.render();
  }

  setAngles(angles: ResearchAngle[]): void {
    this.angles.clear();
    for (const angle of angles) {
      this.angles.set(angle.id, { title: angle.title, status: "pending", turns: 0, costUSD: 0, findingCount: 0 });
    }
    this.render();
  }

  workerProgress(angleId: string, turns: number, costUSD: number): void {
    const view = this.angles.get(angleId);
    if (!view) return;
    view.status = "running";
    view.turns = turns;
    view.costUSD = costUSD;
    this.render();
  }

  angleDone(outcome: AngleOutcome): void {
    const view = this.angles.get(outcome.angleId);
    if (!view) return;
    view.status = outcome.status;
    view.findingCount = outcome.findingCount;
    this.render();
  }

  setVerifyProgress(done: number, total: number): void {
    this.verifyProgress = { done, total };
    this.render();
  }

  notify(message: string, type: "info" | "warning" | "error" = "info"): void {
    if (this.enabled) this.ui.notify(message, type);
  }

  private elapsed(): string {
    // Budget wall time carries across --resume; fall back to session-local time before attach.
    const ms = this.budget ? this.budget.snapshot().wallMs : Date.now() - this.started;
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
  }

  render(): void {
    if (!this.enabled) return;
    const cost = this.budget ? `$${this.budget.costUSD.toFixed(2)}` : "$0.00";
    const done = [...this.angles.values()].filter((a) => a.status !== "pending" && a.status !== "running").length;
    const total = this.angles.size;

    const lines: string[] = [`Deep research: ${truncate(this.question, 70)}`, `Stage: ${STAGE_LABEL[this.stage]} · ${cost} · ${this.elapsed()}`];
    if (total > 0) {
      lines.push("");
      for (const view of this.angles.values()) {
        const icon = STATUS_ICON[view.status] ?? "○";
        const meta = [
          view.findingCount > 0 ? `${view.findingCount}f` : "",
          view.turns > 0 ? `${view.turns}t` : "",
          view.costUSD > 0 ? `$${view.costUSD.toFixed(2)}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        lines.push(`  ${icon} ${truncate(view.title, 52)}${meta ? `  ${meta}` : ""}`);
      }
      lines.push("", `Angles ${done}/${total}`);
    }
    if (this.verifyProgress && (this.stage === "verifying" || this.stage === "verify_done")) {
      lines.push(`Verifying claims ${this.verifyProgress.done}/${this.verifyProgress.total}`);
    }

    this.ui.setWidget(WIDGET_KEY, lines);
    this.ui.setStatus(STATUS_KEY, `research: ${STAGE_LABEL[this.stage]} ${done}/${total} · ${cost} · ${this.elapsed()}`);
  }

  clear(): void {
    if (!this.enabled) return;
    this.ui.setWidget(WIDGET_KEY, undefined);
    this.ui.setStatus(STATUS_KEY, undefined);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
