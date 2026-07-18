import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { BudgetTracker } from "../src/budget.js";
import { resolveConfig } from "../src/config.js";
import { SourceStore } from "../src/sources.js";
import { runVerification } from "../src/stages/verify.js";
import { createSdkBackend } from "../src/worker/sdk-backend.js";
import type { Finding } from "../src/types.js";

const live = process.env.PI_DR_LIVE === "1";

describe.runIf(live)("factored verification (live)", () => {
  it(
    "drops a claim the sources contradict and keeps one they support",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "pi-dr-verify-"));
      const store = new SourceStore(dir);
      const sourceText =
        "Pi is a minimal coding agent made by Earendil Inc. It is written in TypeScript. " +
        "Extensions for Pi are TypeScript modules that register commands, tools, and keyboard shortcuts. " +
        "Pi is distributed on npm as @earendil-works/pi-coding-agent.";
      store.register({
        url: "https://example.com/pi-facts",
        finalUrl: "https://example.com/pi-facts",
        title: "Pi facts",
        httpStatus: 200,
        contentType: "text/html",
        fullText: sourceText,
        byAngle: "a1",
        truncated: false,
        excerptChars: sourceText.length,
      });

      const findings: Finding[] = [
        {
          id: "a1-f1",
          angleId: "a1",
          claim: "Pi extensions are TypeScript modules.",
          citations: [{ url: "https://example.com/pi-facts" }],
          confidenceSelf: "high",
        },
        {
          id: "a1-f2",
          angleId: "a1",
          claim: "Pi is written in Rust and does not support extensions at all.",
          citations: [{ url: "https://example.com/pi-facts" }],
          confidenceSelf: "high",
        },
      ];

      const config = resolveConfig({ flags: { depth: "quick", votes: "2" }, defaultOutDir: dir });
      const backend = createSdkBackend({ agentDir: getAgentDir(), cwd: dir });
      const budget = new BudgetTracker(1.0);

      const result = await runVerification({ findings, store, backend, budget, config });
      for (const v of result.verdicts) {
        const claim = result.claims.find((c) => c.id === v.claimId);
        console.log(`verdict ${claim?.text?.slice(0, 40)}... -> ${v.verdict} (${v.consensus})`);
      }

      const trueVerdict = result.verdicts.find((v) => result.claims.find((c) => c.id === v.claimId)?.findingIds.includes("a1-f1"));
      const falseVerdict = result.verdicts.find((v) => result.claims.find((c) => c.id === v.claimId)?.findingIds.includes("a1-f2"));

      expect(["supported", "partially_supported"]).toContain(trueVerdict?.verdict);
      expect(["refuted", "unsupported"]).toContain(falseVerdict?.verdict);
      expect(result.survivingFindingIds.has("a1-f1")).toBe(true);
      expect(result.survivingFindingIds.has("a1-f2")).toBe(false);
    },
    180_000,
  );
});
