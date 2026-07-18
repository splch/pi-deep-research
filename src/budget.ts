import type { BudgetState } from "./types.js";
import type { WorkerUsage } from "./worker/interface.js";

/**
 * Tracks spend across every worker/stage against a hard USD ceiling. Pi has no
 * built-in turn or token caps, so this is the only thing standing between a run
 * and unbounded spend: the orchestrator checks `overBudget()` before launching
 * each new worker and stops fanning out once it trips.
 */
export class BudgetTracker {
  private state: BudgetState;
  private readonly startedAt: number;
  /** Wall time already spent by earlier segments of a resumed run. */
  private readonly priorWallMs: number;

  constructor(
    private readonly budgetUSD: number,
    now: number = Date.now(),
    initial?: BudgetState,
  ) {
    this.startedAt = now;
    this.priorWallMs = initial?.wallMs ?? 0;
    this.state = initial ?? {
      costUSD: 0,
      tokensIn: 0,
      tokensOut: 0,
      workerTurns: 0,
      wallMs: 0,
      capsHit: [],
    };
  }

  add(usage: WorkerUsage): void {
    this.state.costUSD += usage.costUSD;
    this.state.tokensIn += usage.tokensIn;
    this.state.tokensOut += usage.tokensOut;
    this.state.workerTurns += usage.turns;
  }

  noteCap(label: string): void {
    if (!this.state.capsHit.includes(label)) this.state.capsHit.push(label);
  }

  overBudget(): boolean {
    return this.state.costUSD >= this.budgetUSD;
  }

  remainingUSD(): number {
    return Math.max(0, this.budgetUSD - this.state.costUSD);
  }

  fractionUsed(): number {
    return this.budgetUSD > 0 ? this.state.costUSD / this.budgetUSD : 1;
  }

  snapshot(now: number = Date.now()): BudgetState {
    return { ...this.state, wallMs: this.priorWallMs + (now - this.startedAt), capsHit: [...this.state.capsHit] };
  }

  get costUSD(): number {
    return this.state.costUSD;
  }
}
