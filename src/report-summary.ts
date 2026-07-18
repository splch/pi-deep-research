/** Cap on the report excerpt handed back to the session agent on completion. */
export const MAX_SUMMARY_CHARS = 3000;

function truncateAtParagraph(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf("\n\n");
  return `${(lastBreak > maxChars / 2 ? cut.slice(0, lastBreak) : cut).trimEnd()}\n\n[…truncated; full report on disk]`;
}

/**
 * Pull the writer's executive-summary section out of a finished report so the
 * session agent can continue from it. Falls back to the report's opening when
 * no summary heading exists.
 */
export function extractExecutiveSummary(markdown: string, maxChars = MAX_SUMMARY_CHARS): string {
  const heading = /^##\s+.*summary.*$/im.exec(markdown);
  if (heading) {
    const rest = markdown.slice(heading.index + heading[0].length);
    const next = /^##\s/m.exec(rest);
    const section = (next ? rest.slice(0, next.index) : rest).trim();
    if (section) return truncateAtParagraph(section, maxChars);
  }
  // Fallback: opening of the report, minus the title line.
  const body = markdown.replace(/^#\s.*\n?/, "").trim();
  return truncateAtParagraph(body, maxChars);
}
