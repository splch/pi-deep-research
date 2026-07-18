import { describe, expect, it } from "vitest";
import { resolveSearchProvider } from "../src/search/index.js";
import { createTavilyProvider } from "../src/search/tavily.js";

describe("resolveSearchProvider", () => {
  it("auto-detects in priority order (tavily first)", () => {
    const both = resolveSearchProvider(undefined, { TAVILY_API_KEY: "t", EXA_API_KEY: "e" });
    expect(both.provider.name).toBe("tavily");
    expect(both.detectedFrom).toBe("auto");
    const exaOnly = resolveSearchProvider(undefined, { EXA_API_KEY: "e" });
    expect(exaOnly.provider.name).toBe("exa");
  });

  it("honors explicit selection and validates its key", () => {
    const brave = resolveSearchProvider("brave", { BRAVE_API_KEY: "b", TAVILY_API_KEY: "t" });
    expect(brave.provider.name).toBe("brave");
    expect(() => resolveSearchProvider("exa", { TAVILY_API_KEY: "t" })).toThrow(/EXA_API_KEY/);
    expect(() => resolveSearchProvider("bing", { TAVILY_API_KEY: "t" })).toThrow(/Unknown search provider/);
  });

  it("errors actionably when nothing is configured", () => {
    expect(() => resolveSearchProvider(undefined, {})).toThrow(/TAVILY_API_KEY/);
  });
});

describe("tavily adapter", () => {
  it("sends the right request shape and parses results", async () => {
    let captured: { url: string; body: Record<string, unknown> } | undefined;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      captured = { url: input.toString(), body: JSON.parse(String(init?.body)) };
      return new Response(
        JSON.stringify({
          results: [
            { title: "Result A", url: "https://a.example.com", content: "snippet a", score: 0.9 },
            { url: "https://b.example.com", content: "snippet b" },
            { title: "no url, dropped" },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const provider = createTavilyProvider({ apiKey: "tvly-key", fetchImpl });
    const hits = await provider.search({ query: "widget frobnication", maxResults: 5, recencyDays: 7 });

    expect(captured?.url).toBe("https://api.tavily.com/search");
    expect(captured?.body).toMatchObject({ query: "widget frobnication", max_results: 5, time_range: "week" });
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ title: "Result A", url: "https://a.example.com", snippet: "snippet a" });
    expect(hits[1]?.title).toBe("https://b.example.com");
  });
});
