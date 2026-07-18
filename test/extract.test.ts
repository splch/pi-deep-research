import { describe, expect, it } from "vitest";
import { extractReadableText } from "../src/tools/extract.js";

const article = `<!doctype html>
<html><head><title>Test Article Title</title></head>
<body>
  <nav>Home | About | Contact and lots of nav noise</nav>
  <script>alert("evil script content");</script>
  <article>
    <h1>Understanding Widget Frobnication</h1>
    <p>${"Widget frobnication is the process of aligning widgets with their frobnicators. ".repeat(6)}</p>
    <p>${"A second paragraph with substantive detail about calibration thresholds and safety interlocks. ".repeat(6)}</p>
  </article>
</body></html>`;

describe("extractReadableText", () => {
  it("extracts main article text and drops scripts", () => {
    const { text, title } = extractReadableText(article, "https://example.com/widgets");
    expect(text).toContain("frobnication");
    expect(text).toContain("calibration thresholds");
    expect(text).not.toContain("evil script content");
    expect(title).toBeTruthy();
  });

  it("falls back gracefully on trivial documents", () => {
    const { text } = extractReadableText("<html><body><p>tiny</p></body></html>", "https://example.com/t");
    expect(text).toContain("tiny");
  });

  it("returns a placeholder for empty documents", () => {
    const { text } = extractReadableText("<html><body></body></html>", "https://example.com/empty");
    expect(text.length).toBeGreaterThan(0);
  });
});
