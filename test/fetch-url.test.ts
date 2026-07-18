import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { SourceStore } from "../src/sources.js";
import { createFetchUrlTool } from "../src/tools/fetch-url.js";
import { HostLimiter } from "../src/tools/politeness.js";

// Tool ignores ctx entirely; a bare stub keeps the test independent of Pi runtime state.
const ctx = undefined as unknown as ExtensionContext;
const publicResolver = async () => ["93.184.216.34"];

function htmlResponse(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

const page = `<html><head><title>Doc</title></head><body><article><p>${"Useful fact about frobnication thresholds. ".repeat(20)}</p></article></body></html>`;

function makeTool(fetchImpl: typeof fetch, overrides: Partial<Parameters<typeof createFetchUrlTool>[0]> = {}) {
  const store = new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-fetch-")));
  const tool = createFetchUrlTool({
    store,
    limiter: new HostLimiter({ minIntervalMs: 1, maxConcurrent: 4 }),
    byAngle: "a1",
    fetchImpl,
    resolveAddresses: publicResolver,
    ...overrides,
  });
  return { tool, store };
}

describe("fetch_url tool", () => {
  it("fetches, extracts, truncates, and registers the source", async () => {
    const { tool, store } = makeTool((async () => htmlResponse(page)) as typeof fetch);
    const result = await tool.execute("t1", { url: "https://example.com/doc", maxChars: 500 }, undefined, undefined, ctx);
    expect(result.details.sourceId).toBe("s1");
    expect(result.details.truncated).toBe(true);
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain("frobnication");
    expect(text.length).toBeLessThan(800);
    expect(store.has("https://example.com/doc")).toBe(true);
    expect(store.readFullText(store.get("https://example.com/doc")!).length).toBeGreaterThan(500);
  });

  it("follows redirects but blocks redirects into private space", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = input.toString();
      if (url === "https://example.com/start") {
        return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } });
      }
      return htmlResponse(page);
    }) as typeof fetch;
    const { tool } = makeTool(fetchImpl);
    await expect(
      tool.execute("t1", { url: "https://example.com/start" }, undefined, undefined, ctx),
    ).rejects.toThrow(/Blocked/);
  });

  it("follows safe redirects to the final public URL", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = input.toString();
      if (url === "https://example.com/old") {
        return new Response(null, { status: 301, headers: { location: "https://example.com/new" } });
      }
      return htmlResponse(page);
    }) as typeof fetch;
    const { tool } = makeTool(fetchImpl);
    const result = await tool.execute("t1", { url: "https://example.com/old" }, undefined, undefined, ctx);
    expect(result.details.finalUrl).toBe("https://example.com/new");
  });

  it("rejects unsupported content types", async () => {
    const fetchImpl = (async () =>
      new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } })) as typeof fetch;
    const { tool } = makeTool(fetchImpl);
    await expect(tool.execute("t1", { url: "https://example.com/x.pdf" }, undefined, undefined, ctx)).rejects.toThrow(
      /content-type/,
    );
  });

  it("propagates HTTP errors as tool errors", async () => {
    const fetchImpl = (async () => new Response("gone", { status: 404 })) as typeof fetch;
    const { tool } = makeTool(fetchImpl);
    await expect(tool.execute("t1", { url: "https://example.com/missing" }, undefined, undefined, ctx)).rejects.toThrow(
      /HTTP 404/,
    );
  });
});
