import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { resolveSearchProvider } from "../src/search/index.js";
import { SourceStore } from "../src/sources.js";
import { createFetchUrlTool } from "../src/tools/fetch-url.js";
import { HostLimiter } from "../src/tools/politeness.js";

// Live tests: hit the real network. Opt in with PI_DR_LIVE=1 (plus a configured search key),
// so plain `npm test` stays offline even when keys happen to be exported.
const hasKey = Boolean(process.env.TAVILY_API_KEY || process.env.EXA_API_KEY || process.env.BRAVE_API_KEY);
const live = process.env.PI_DR_LIVE === "1" && hasKey;

// Tool ignores ctx; bare stub keeps the test independent of Pi runtime state.
const ctx = undefined as unknown as ExtensionContext;

describe.runIf(live)("live network smoke", () => {
  it("real provider search returns plausible hits", async () => {
    const { provider } = resolveSearchProvider(undefined);
    const hits = await provider.search({ query: "pi coding agent earendil extensions", maxResults: 3 });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(() => new URL(hit.url)).not.toThrow();
  });

  it("real fetch_url extracts example.com through the SSRF guard", async () => {
    const store = new SourceStore(mkdtempSync(join(tmpdir(), "pi-dr-live-")));
    const tool = createFetchUrlTool({ store, limiter: new HostLimiter(), byAngle: "live" });
    const result = await tool.execute("t1", { url: "https://example.com/" }, undefined, undefined, ctx);
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain("Example Domain");
    expect(store.size).toBe(1);
  });
});
