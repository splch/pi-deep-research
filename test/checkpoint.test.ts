import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Checkpointer, latestRunState, STATE_ENTRY_TYPE, type SessionEntryLike } from "../src/checkpoint.js";
import type { Finding, RunState } from "../src/types.js";

function baseState(runId: string, stage: RunState["stage"]): RunState {
  return {
    version: 1,
    runId,
    question: "q",
    stage,
    budget: { costUSD: 0, tokensIn: 0, tokensOut: 0, workerTurns: 0, wallMs: 0, capsHit: [] },
    updatedAt: "now",
  };
}

describe("Checkpointer", () => {
  it("appends state entries and writes findings artifacts", () => {
    const outDir = mkdtempSync(join(tmpdir(), "pi-dr-ckpt-"));
    const entries: Array<{ type: string; data: unknown }> = [];
    const ckpt = new Checkpointer((customType, data) => entries.push({ type: customType, data }), outDir, "run1");

    const findings: Finding[] = [
      { id: "a1-f1", angleId: "a1", claim: "c", citations: [{ url: "https://e.com" }] },
    ];
    const path = ckpt.writeFindings(findings);
    ckpt.writeState({ ...baseState("run1", "research_done"), findingsPath: path });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe(STATE_ENTRY_TYPE);
    expect(Checkpointer.readFindings(path)).toEqual(findings);
  });
});

describe("latestRunState", () => {
  it("returns the latest matching state entry (latest wins)", () => {
    const entries: SessionEntryLike[] = [
      { type: "custom", customType: STATE_ENTRY_TYPE, data: baseState("run1", "plan_confirmed") },
      { type: "message", customType: undefined, data: undefined },
      { type: "custom", customType: STATE_ENTRY_TYPE, data: baseState("run1", "research_done") },
      { type: "custom", customType: "other", data: { version: 1 } },
    ];
    expect(latestRunState(entries)?.stage).toBe("research_done");
  });

  it("filters by runId when provided", () => {
    const entries: SessionEntryLike[] = [
      { type: "custom", customType: STATE_ENTRY_TYPE, data: baseState("run1", "research_done") },
      { type: "custom", customType: STATE_ENTRY_TYPE, data: baseState("run2", "brief") },
    ];
    expect(latestRunState(entries, "run1")?.stage).toBe("research_done");
    expect(latestRunState(entries, "run2")?.stage).toBe("brief");
    expect(latestRunState(entries, "missing")).toBeUndefined();
  });

  it("ignores malformed entries", () => {
    const entries: SessionEntryLike[] = [
      { type: "custom", customType: STATE_ENTRY_TYPE, data: { version: 2 } },
      { type: "custom", customType: STATE_ENTRY_TYPE, data: undefined },
    ];
    expect(latestRunState(entries)).toBeUndefined();
  });
});
