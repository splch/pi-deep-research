export interface SearchQuery {
  query: string;
  maxResults: number;
  recencyDays?: number;
  topic?: "general" | "news";
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  score?: number;
}

export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery, signal?: AbortSignal): Promise<SearchHit[]>;
}

export interface ProviderInit {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface BackoffOptions {
  retries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fetch that retries retryable HTTP statuses, honoring Retry-After when present.
 * Throws ProviderError on a non-OK final response.
 */
export async function fetchWithBackoff(
  fetchImpl: typeof fetch,
  input: string | URL,
  init: RequestInit,
  options: BackoffOptions = {},
): Promise<Response> {
  const { retries = 3, baseDelayMs = 250, signal, sleep = defaultSleep } = options;
  let attempt = 0;
  for (;;) {
    signal?.throwIfAborted();
    const response = await fetchImpl(input, { ...init, signal: signal ?? init.signal ?? null });
    if (response.ok) return response;
    if (!RETRYABLE_STATUS.has(response.status) || attempt >= retries) {
      const body = await response.text().catch(() => "");
      throw new ProviderError(
        `HTTP ${response.status} from ${new URL(input.toString()).host}: ${body.slice(0, 200)}`,
        response.status,
      );
    }
    void response.body?.cancel().catch(() => {}); // drop the unread retry-response body
    const retryAfter = response.headers.get("retry-after");
    const retryAfterMs = retryAfter && /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter.trim()) * 1000 : undefined;
    const backoffMs = retryAfterMs ?? baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
    await sleep(backoffMs);
    attempt++;
  }
}
