import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import type { SearchHit, SearchProvider } from "../search/provider.js";
import { WebSearchParams } from "../types.js";

export interface WebSearchDetails {
  query: string;
  provider: string;
  hits: SearchHit[];
}

export function createWebSearchTool(provider: SearchProvider) {
  return defineTool({
    name: "web_search",
    label: "Web search",
    description:
      "Search the web and get back titles, URLs, and snippets. Use fetch_url to read a promising result before citing it.",
    parameters: WebSearchParams,
    async execute(_toolCallId, params, signal): Promise<AgentToolResult<WebSearchDetails>> {
      const hits = await provider.search(
        {
          query: params.query,
          maxResults: params.maxResults ?? 5,
          recencyDays: params.recencyDays,
          topic: params.topic,
        },
        signal,
      );
      const text =
        hits.length === 0
          ? `No results for: ${params.query}`
          : hits
              .map((hit, i) => `${i + 1}. ${hit.title}\n   ${hit.url}${hit.snippet ? `\n   ${hit.snippet}` : ""}`)
              .join("\n");
      return {
        content: [{ type: "text", text }],
        details: { query: params.query, provider: provider.name, hits },
      };
    },
  });
}
