import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writerTaskMessage } from "../src/prompts/writer.js";
import { SourceStore } from "../src/sources.js";
import { annotateReport, checkCitations, extractCitedUrls } from "../src/stages/citations.js";
import { buildFindingRefs, citedSources } from "../src/stages/write.js";
import type { Finding } from "../src/types.js";

describe("extractCitedUrls", () => {
  it("pulls unique urls and trims trailing punctuation", () => {
    const md = "See [1](https://a.com/x) and https://b.com/y, plus https://a.com/x again.";
    expect(extractCitedUrls(md).sort()).toEqual(["https://a.com/x", "https://b.com/y"]);
  });
});

function storeWith(urls: string[]): SourceStore {
  const store = new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-cite-")));
  urls.forEach((url, i) =>
    store.register({
      url,
      finalUrl: url,
      httpStatus: 200,
      contentType: "text/html",
      fullText: `content ${i}`,
      byAngle: "a1",
      truncated: false,
      excerptChars: 9,
    }),
  );
  return store;
}

describe("checkCitations", () => {
  it("flags cited URLs that were never fetched", () => {
    const store = storeWith(["https://real.com/a"]);
    const md = "Backed by [1](https://real.com/a) but also [2](https://fabricated.com/z).";
    const check = checkCitations(md, store);
    expect(check.checked).toBe(2);
    expect(check.failed).toBe(1);
    expect(check.failedUrls).toEqual(["https://fabricated.com/z"]);
  });

  it("passes clean when every citation was fetched", () => {
    const store = storeWith(["https://real.com/a", "https://real.com/b"]);
    const check = checkCitations("[1](https://real.com/a) [2](https://real.com/b)", store);
    expect(check.failed).toBe(0);
    expect(annotateReport("report", check)).toBe("report");
  });

  it("appends a non-destructive warning for failures", () => {
    const store = storeWith([]);
    const check = checkCitations("[1](https://ghost.com/x)", store);
    const annotated = annotateReport("# Report\nbody", check);
    expect(annotated).toContain("# Report");
    expect(annotated).toContain("Citation-integrity warning");
    expect(annotated).toContain("https://ghost.com/x");
  });
});

describe("citedSources", () => {
  it("returns fetched sources in stable citation order, deduped", () => {
    const store = storeWith(["https://a.com", "https://b.com"]);
    const findings: Finding[] = [
      { id: "f1", angleId: "x", claim: "c1", citations: [{ url: "https://b.com" }] },
      { id: "f2", angleId: "x", claim: "c2", citations: [{ url: "https://a.com" }, { url: "https://b.com" }] },
      { id: "f3", angleId: "x", claim: "c3", citations: [{ url: "https://never-fetched.com" }] },
    ];
    const sources = citedSources(findings, store);
    expect(sources.map((s) => s.finalUrl)).toEqual(["https://b.com", "https://a.com"]);
  });
});

describe("buildFindingRefs", () => {
  it("maps citation URL variants to the same [n] through store normalization", () => {
    const store = new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-refs-")));
    store.register({
      url: "https://a.com/x?utm_source=tw",
      finalUrl: "https://a.com/x",
      httpStatus: 200,
      contentType: "text/html",
      fullText: "body",
      byAngle: "a1",
      truncated: false,
      excerptChars: 4,
    });
    const findings: Finding[] = [
      // Cites a fragment variant of the fetched URL - exact string match would miss it.
      { id: "f1", angleId: "a1", claim: "claim one", citations: [{ url: "https://a.com/x#section" }] },
      { id: "f2", angleId: "a1", claim: "claim two", citations: [{ url: "https://never.com/y" }] },
    ];
    const sources = citedSources(findings, store);
    expect(sources).toHaveLength(1);
    const refs = buildFindingRefs(findings, sources, store);
    expect(refs.get("f1")).toEqual([1]);
    expect(refs.get("f2")).toEqual([]);

    const msg = writerTaskMessage({
      brief: { runId: "r", question: "q", refinedQuestion: "rq", goals: [], inScope: [], outOfScope: [], depth: "quick", createdAt: "now" },
      findings,
      verdictByFinding: new Map(),
      sources,
      refsByFinding: refs,
    });
    expect(msg).toContain("- claim one [1]");
    expect(msg).not.toContain("claim two [");
  });
});
