import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { workerSystemPrompt } from "../prompts/worker.js";
import { resolveSearchProvider } from "../search/index.js";
import { SourceStore } from "../sources.js";
import { createFetchUrlTool } from "../tools/fetch-url.js";
import { HostLimiter } from "../tools/politeness.js";
import { createFileSubmitFindingsTool } from "../tools/submit.js";
import { createWebSearchTool } from "../tools/web-search.js";

/**
 * Entry point for the subprocess backend. A child `pi` process loads THIS as its
 * only extension (`pi -e worker-entry.ts`), so it registers just the three web
 * tools and a file-writing submit tool. Everything varies by environment:
 *   PI_DR_WORKER_DIR  - artifact dir; sources.json + result.json land here
 *   PI_DR_PROVIDER    - optional explicit search provider (else auto-detect by key)
 *   PI_DR_ANGLE_ID    - label for fetched sources
 *   PI_DR_MAX_FETCH   - per-fetch char cap
 * The task is the positional CLI prompt; the system prompt is injected below.
 */
export default function (pi: ExtensionAPI) {
  const dir = process.env.PI_DR_WORKER_DIR;
  if (!dir) throw new Error("worker-entry: PI_DR_WORKER_DIR is not set");

  const store = new SourceStore(dir);
  const limiter = new HostLimiter();
  const { provider } = resolveSearchProvider(process.env.PI_DR_PROVIDER);
  const maxFetch = Number(process.env.PI_DR_MAX_FETCH) || 8000;
  const angleId = process.env.PI_DR_ANGLE_ID || "sub";

  pi.registerTool(createWebSearchTool(provider));
  pi.registerTool(createFetchUrlTool({ store, limiter, byAngle: angleId, maxCharsDefault: maxFetch }));
  pi.registerTool(createFileSubmitFindingsTool(store, join(dir, "result.json"), join(dir, "sources.json")));

  // Fully replace the coding-agent system prompt with the research-worker prompt.
  pi.on("before_agent_start", () => ({ systemPrompt: workerSystemPrompt() }));
}
