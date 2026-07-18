import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding, RunState } from "./types.js";

/** Minimal slice of pi.appendEntry we depend on. */
export type AppendEntry = (customType: string, data: unknown) => void;

/** Minimal slice of a session entry as returned by ctx.sessionManager.getEntries(). */
export interface SessionEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

export const STATE_ENTRY_TYPE = "research:state";

/**
 * Persists run progress two ways: an appendEntry into the session (branch-safe,
 * survives restart, drives resume) holding the small RunState, and artifact files
 * on disk for the bulky findings/sources the RunState only points at.
 */
export class Checkpointer {
  readonly runDir: string;

  constructor(
    private readonly appendEntry: AppendEntry,
    outDir: string,
    readonly runId: string,
  ) {
    this.runDir = join(outDir, "runs", runId);
    mkdirSync(this.runDir, { recursive: true });
  }

  get sourcesArtifactDir(): string {
    return this.runDir;
  }

  writeFindings(findings: Finding[]): string {
    const path = join(this.runDir, "findings.json");
    writeFileSync(path, JSON.stringify(findings, null, 2), "utf8");
    return path;
  }

  writeState(state: RunState): void {
    const stamped: RunState = { ...state, updatedAt: new Date().toISOString() };
    // Mirror to a file for humans/debugging; the session entry is the source of truth for resume.
    writeFileSync(join(this.runDir, "state.json"), JSON.stringify(stamped, null, 2), "utf8");
    this.appendEntry(STATE_ENTRY_TYPE, stamped);
  }

  static readFindings(path: string): Finding[] {
    return JSON.parse(readFileSync(path, "utf8")) as Finding[];
  }
}

/** Latest research:state across the session branch ("latest wins" - appendEntry is append-only). */
export function latestRunState(entries: readonly SessionEntryLike[], runId?: string): RunState | undefined {
  let found: RunState | undefined;
  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE) continue;
    const data = entry.data as RunState | undefined;
    if (!data || data.version !== 1) continue;
    if (runId && data.runId !== runId) continue;
    found = data;
  }
  return found;
}
