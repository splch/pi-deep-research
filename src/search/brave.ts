import {
  fetchWithBackoff,
  type ProviderInit,
  type SearchHit,
  type SearchProvider,
  type SearchQuery,
} from "./provider.js";

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
}

function freshness(recencyDays: number | undefined): string | undefined {
  if (recencyDays === undefined) return undefined;
  if (recencyDays <= 1) return "pd";
  if (recencyDays <= 7) return "pw";
  if (recencyDays <= 31) return "pm";
  return "py";
}

export function createBraveProvider(init: ProviderInit): SearchProvider {
  const fetchImpl = init.fetchImpl ?? fetch;
  return {
    name: "brave",
    async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchHit[]> {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query.query);
      url.searchParams.set("count", String(query.maxResults));
      const fresh = freshness(query.recencyDays);
      if (fresh) url.searchParams.set("freshness", fresh);
      const response = await fetchWithBackoff(
        fetchImpl,
        url,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "x-subscription-token": init.apiKey,
          },
        },
        { signal },
      );
      const data = (await response.json()) as { web?: { results?: BraveResult[] } };
      return (data.web?.results ?? [])
        .filter((r): r is BraveResult & { url: string } => typeof r.url === "string")
        .map((r) => ({
          title: r.title ?? r.url,
          url: r.url,
          snippet: (r.description ?? "").slice(0, 400),
          publishedDate: r.page_age,
        }));
    },
  };
}
