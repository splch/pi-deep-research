import { createBraveProvider } from "./brave.js";
import { createExaProvider } from "./exa.js";
import type { ProviderInit, SearchProvider } from "./provider.js";
import { createTavilyProvider } from "./tavily.js";

export type { SearchHit, SearchProvider, SearchQuery } from "./provider.js";

interface ProviderSpec {
  envVar: string;
  factory: (init: ProviderInit) => SearchProvider;
}

/** Ordered: auto-detection picks the first entry whose env var is set. */
export const PROVIDERS: ReadonlyMap<string, ProviderSpec> = new Map<string, ProviderSpec>([
  ["tavily", { envVar: "TAVILY_API_KEY", factory: createTavilyProvider }],
  ["exa", { envVar: "EXA_API_KEY", factory: createExaProvider }],
  ["brave", { envVar: "BRAVE_API_KEY", factory: createBraveProvider }],
]);

export interface ProviderResolution {
  provider: SearchProvider;
  detectedFrom: "explicit" | "auto";
}

export function resolveSearchProvider(
  explicit: string | undefined,
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: typeof fetch,
): ProviderResolution {
  if (explicit) {
    const spec = PROVIDERS.get(explicit);
    if (!spec) {
      throw new Error(`Unknown search provider "${explicit}". Supported: ${[...PROVIDERS.keys()].join(", ")}.`);
    }
    const apiKey = env[spec.envVar];
    if (!apiKey) {
      throw new Error(`Search provider "${explicit}" selected but ${spec.envVar} is not set.`);
    }
    return { provider: spec.factory({ apiKey, fetchImpl }), detectedFrom: "explicit" };
  }
  for (const [, spec] of PROVIDERS) {
    const apiKey = env[spec.envVar];
    if (apiKey) {
      return { provider: spec.factory({ apiKey, fetchImpl }), detectedFrom: "auto" };
    }
  }
  const wanted = [...PROVIDERS.values()].map((s) => s.envVar).join(", ");
  throw new Error(
    `No search provider configured. Set one of: ${wanted} (or pass --provider <${[...PROVIDERS.keys()].join("|")}>).`,
  );
}
