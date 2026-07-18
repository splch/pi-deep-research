import {
  fetchWithBackoff,
  type ProviderInit,
  type SearchHit,
  type SearchProvider,
  type SearchQuery,
} from "./provider.js";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
}

function timeRange(recencyDays: number | undefined): string | undefined {
  if (recencyDays === undefined) return undefined;
  if (recencyDays <= 1) return "day";
  if (recencyDays <= 7) return "week";
  if (recencyDays <= 31) return "month";
  return "year";
}

export function createTavilyProvider(init: ProviderInit): SearchProvider {
  const fetchImpl = init.fetchImpl ?? fetch;
  return {
    name: "tavily",
    async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchHit[]> {
      const response = await fetchWithBackoff(
        fetchImpl,
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${init.apiKey}`,
          },
          body: JSON.stringify({
            query: query.query,
            max_results: query.maxResults,
            topic: query.topic ?? "general",
            time_range: timeRange(query.recencyDays),
            search_depth: "basic",
          }),
        },
        { signal },
      );
      const data = (await response.json()) as { results?: TavilyResult[] };
      return (data.results ?? [])
        .filter((r): r is TavilyResult & { url: string } => typeof r.url === "string")
        .map((r) => ({
          title: r.title ?? r.url,
          url: r.url,
          snippet: (r.content ?? "").slice(0, 400),
          publishedDate: r.published_date,
          score: r.score,
        }));
    },
  };
}
