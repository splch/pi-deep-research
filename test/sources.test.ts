import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeUrl, SourceStore } from "../src/sources.js";

const dir = () => mkdtempSync(join(tmpdir(), "pi-dr-sources-"));

describe("normalizeUrl", () => {
  it("strips fragments, tracking params, and sorts query", () => {
    expect(normalizeUrl("https://Example.com/a?utm_source=x&b=2&a=1#frag")).toBe("https://example.com/a?a=1&b=2");
  });
  it("drops trailing slash on non-root paths without query", () => {
    expect(normalizeUrl("https://example.com/docs/")).toBe("https://example.com/docs");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
});

describe("SourceStore", () => {
  const base = {
    httpStatus: 200,
    contentType: "text/html",
    byAngle: "a1",
    truncated: false,
    excerptChars: 100,
  };

  it("dedupes by normalized URL and by content hash", () => {
    const store = new SourceStore(dir());
    const r1 = store.register({ ...base, url: "https://example.com/x?utm_source=t", finalUrl: "https://example.com/x", fullText: "hello world content" });
    const r2 = store.register({ ...base, url: "https://example.com/x", finalUrl: "https://example.com/x", fullText: "different text entirely" });
    expect(r2.id).toBe(r1.id);
    const r3 = store.register({ ...base, url: "https://mirror.example.org/x", finalUrl: "https://mirror.example.org/x", fullText: "hello world content" });
    expect(r3.id).toBe(r1.id);
    expect(store.size).toBe(1);
  });

  it("tracks membership for requested and final URLs", () => {
    const store = new SourceStore(dir());
    store.register({ ...base, url: "https://t.co/abc", finalUrl: "https://example.com/long-article", fullText: "body text" });
    expect(store.has("https://t.co/abc")).toBe(true);
    expect(store.has("https://example.com/long-article")).toBe(true);
    expect(store.has("https://example.com/other")).toBe(false);
  });

  it("persists and reloads", () => {
    const d = dir();
    const store = new SourceStore(d);
    store.register({ ...base, url: "https://example.com/1", finalUrl: "https://example.com/1", fullText: "one" });
    store.register({ ...base, url: "https://example.com/2", finalUrl: "https://example.com/2", fullText: "two" });
    const file = join(d, "sources.json");
    store.persist(file);
    const loaded = SourceStore.load(file, d);
    expect(loaded.size).toBe(2);
    expect(loaded.has("https://example.com/1")).toBe(true);
    const next = loaded.register({ ...base, url: "https://example.com/3", finalUrl: "https://example.com/3", fullText: "three" });
    expect(next.id).toBe("s3");
    expect(loaded.readFullText(loaded.get("https://example.com/1")!)).toBe("one");
  });
});
