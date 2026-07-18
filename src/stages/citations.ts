import type { SourceStore } from "../sources.js";

// Matches bare and markdown-embedded http(s) URLs; trailing punctuation/paren is trimmed below.
const URL_RE = /https?:\/\/[^\s<>()\[\]"']+/g;

export function extractCitedUrls(markdown: string): string[] {
  const found = new Set<string>();
  for (const match of markdown.matchAll(URL_RE)) {
    let url = match[0];
    // Strip trailing sentence punctuation the regex may have swept up.
    url = url.replace(/[.,;:]+$/, "");
    found.add(url);
  }
  return [...found];
}

export interface CitationCheck {
  checked: number;
  failed: number;
  failedUrls: string[];
}

/**
 * Every URL cited in the report must correspond to a source we actually fetched.
 * A cited-but-never-fetched URL is a fabricated/laundered citation - flagged, not trusted.
 */
export function checkCitations(markdown: string, store: SourceStore): CitationCheck {
  const urls = extractCitedUrls(markdown);
  const failedUrls = urls.filter((url) => !store.has(url));
  return { checked: urls.length, failed: failedUrls.length, failedUrls };
}

/** Append a non-destructive integrity note. We flag rather than strip, so prose stays intact. */
export function annotateReport(markdown: string, check: CitationCheck): string {
  if (check.failed === 0) return markdown;
  const note = [
    "",
    "---",
    "",
    "> **Citation-integrity warning:** the following cited URLs were not among the sources this run actually fetched,",
    "> so they could not be verified and may be fabricated or mis-attributed:",
    "",
    ...check.failedUrls.map((url) => `> - ${url}`),
  ].join("\n");
  return `${markdown}\n${note}\n`;
}
