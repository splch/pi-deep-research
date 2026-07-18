import { describe, expect, it } from "vitest";
import { extractExecutiveSummary, MAX_SUMMARY_CHARS } from "../src/report-summary.js";

const REPORT = [
  "# Title",
  "",
  "## Executive summary",
  "",
  "First finding paragraph.",
  "",
  "Second finding paragraph.",
  "",
  "## Body section",
  "",
  "Body detail that is not part of the summary.",
].join("\n");

describe("extractExecutiveSummary", () => {
  it("extracts the summary section up to the next heading", () => {
    const summary = extractExecutiveSummary(REPORT);
    expect(summary).toBe("First finding paragraph.\n\nSecond finding paragraph.");
  });

  it("falls back to the report opening (minus title) when no summary heading exists", () => {
    const summary = extractExecutiveSummary("# Stub Report\n\nA cited claim [1].\n\n## Sources\n[1] x - https://e.com");
    expect(summary).toContain("A cited claim [1].");
    expect(summary).not.toContain("# Stub Report");
  });

  it("truncates overlong summaries at a paragraph boundary", () => {
    const long = `## Executive summary\n\n${"x".repeat(MAX_SUMMARY_CHARS)}\n\n${"y".repeat(MAX_SUMMARY_CHARS)}`;
    const summary = extractExecutiveSummary(long);
    expect(summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS + 60); // marker tail
    expect(summary).toContain("[…truncated; full report on disk]");
  });
});
