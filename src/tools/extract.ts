import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractedDoc {
  title?: string;
  text: string;
}

export function collapseWhitespace(text: string): string {
  return text
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function extractReadableText(html: string, url: string): ExtractedDoc {
  const { document } = parseHTML(html);
  try {
    // linkedom's document implements the DOM subset Readability needs but carries its own types.
    const article = new Readability(document as unknown as Document, { charThreshold: 100 }).parse();
    if (article?.textContent && article.textContent.trim().length > 0) {
      return {
        title: article.title ?? undefined,
        text: collapseWhitespace(article.textContent),
      };
    }
  } catch {
    // fall through to the crude extractor
  }
  const { document: fresh } = parseHTML(html);
  for (const selector of ["script", "style", "noscript", "template", "svg"]) {
    for (const node of Array.from(fresh.querySelectorAll(selector))) node.remove();
  }
  const title = fresh.querySelector("title")?.textContent?.trim() || undefined;
  const body = fresh.querySelector("body")?.textContent ?? fresh.documentElement?.textContent ?? "";
  const text = collapseWhitespace(body);
  if (text.length === 0) {
    return { title, text: `(no extractable text at ${url})` };
  }
  return { title, text };
}
