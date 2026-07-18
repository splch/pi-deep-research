import {
  fetchWithBackoff,
  type ProviderInit,
  type SearchHit,
  type SearchProvider,
  type SearchQuery,
} from "./provider.js";

interface ExaResult {
  title?: string | null;
  url?: string;
  publishedDate?: string;
  score?: number;
  text?: string;
}

export function createExaProvider(init: ProviderInit): SearchProvider {
  const fetchImpl = init.fetchImpl ?? fetch;
  return {
    name: "exa",
    async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchHit[]> {
      const startPublishedDate =
        query.recencyDays === undefined
          ? undefined
          : new Date(Date.now() - query.recencyDays * 86_400_000).toISOString();
      const response = await fetchWithBackoff(
        fetchImpl,
        "https://api.exa.ai/search",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": init.apiKey,
          },
          body: JSON.stringify({
            query: query.query,
            numResults: query.maxResults,
            type: "auto",
            startPublishedDate,
            contents: { text: { maxCharacters: 400 } },
          }),
        },
        { signal },
      );
      const data = (await response.json()) as { results?: ExaResult[] };
      return (data.results ?? [])
        .filter((r): r is ExaResult & { url: string } => typeof r.url === "string")
        .map((r) => ({
          title: r.title ?? r.url,
          url: r.url,
          snippet: (r.text ?? "").slice(0, 400),
          publishedDate: r.publishedDate,
          score: r.score,
        }));
    },
  };
}
