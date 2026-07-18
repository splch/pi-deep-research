# Designing a Deep-Research Extension for the pi Coding Agent: Platform Surface, Reference Architectures, Retrieval Stack, and Long-Horizon Engineering (mid-2026)

## Executive summary

The pi coding agent exposes a genuine extension platform — TypeScript modules with registered tools, commands, lifecycle-event handlers, and a TUI integration surface — that is sufficient to host a full deep-research pipeline without forking the agent [1]. The recommended architecture is a **durable, resumable state machine running an orchestrator–worker research loop**: a lead agent plans and decomposes, parallel workers search and read in isolated context windows with compact schema-constrained handoffs, and a synthesizer writes with verifiable citations [15, 17, 18]. The retrieval stack should sit behind a **provider-neutral adapter** with separate `search`, `read`, and bounded `crawl` tools; a 2026 third-party benchmark found Brave, Firecrawl, Exa, and Parallel Search Pro statistically tied at the top, with Brave the only API to clearly beat Tavily — so vendor selection should be driven by a pi-specific benchmark, not marketing claims [2]. The single most important engineering discipline is **context engineering**: treat the model prompt as a compiled view over durable sessions, searchable memory, and versioned artifacts, never as an append-only transcript [14, 15]. Two gaps in the verified evidence base must be closed before or during the build: explicit prompt-injection defenses for web-derived content, and mappings of the LangChain `open_deep_research` and `gpt-researcher` implementations, neither of which is covered by the sources reviewed here.

---

## 1. The pi extension platform: what a deep-research extension builds on

### 1.1 Loading, packaging, and distribution

Pi extensions are TypeScript modules loaded automatically from designated directories or from npm/git packages [1]. Two auto-discovered locations exist: `~/.pi/agent/extensions/` for global extensions and `.pi/extensions/` for project-local ones [1]. For distribution, a packaged extension declares a `pi` section in its `package.json` defining entry points, and users install it with `pi install` from npm or a git repository [1]. This gives a deep-research extension a conventional shipping path: develop locally in `.pi/extensions/`, then publish to npm with the `pi` manifest section. (This loading/packaging description is marked partially verified in the underlying findings; confirm exact manifest fields against the current docs before publishing [1].)

The ecosystem also provides developer tooling — `pi-extension-toolkit` and `pi-dev-kit` — offering scaffolding, verification, and introspection utilities for extension development, versioning, and documentation. Using these from day one keeps the package conformant with platform conventions rather than retrofitting compliance later.

### 1.2 The ExtensionAPI surface

Extensions interact with the agent through four registration mechanisms [1]:

- **Tools** via `pi.registerTool()`, with a name, description, parameters defined as **Typebox schemas**, and an execution function. This is where the retrieval stack lives: the `search`, `read`, and `crawl` tools recommended in §3 should be ordinary pi tools with discriminated, compact schemas.
- **Commands** via `pi.registerCommand()` — the natural home for `/research <question>`, `/research-resume <id>`, `/research-status`, and a `/research-cancel`.
- **Lifecycle events** via `pi.on()`, including `session_start`, `tool_call`, and `session_shutdown` [1]. These are the hooks on which the durable state machine (§4) hangs: initialize run storage at `session_start`, observe tool calls for tracing, and checkpoint at `session_shutdown`.
- **UI context** via the `ExtensionContext` (`ctx.ui`): `notify` for notifications, `confirm` for confirmations, `input` for user input, `setStatus` for footer status, and `setWidget` / `custom` for richer TUI widgets [1]. This is the surface for the progress view specified in §4.6 — a live research widget with plan, phase, counters, and budget, plus footer status for compact ambient progress.

### 1.3 Lifecycle discipline

Extension factory functions may be asynchronous, permitting startup work such as fetching remote configuration [1]. The documented convention — partially verified — is that long-lived resources should be started after `session_start` rather than at module load, and session-scoped resources must be cleaned up in `session_shutdown` handlers [1]. Extensions in auto-discovered locations support hot-reloading via `/reload` [1]. For a deep-research extension this maps directly to resource policy: open provider HTTP clients and concurrency pools at `session_start`; flush and close the run-state store, cancel in-flight requests, and release pools at `session_shutdown`. One design caution follows from hot-reload: because a user can `/reload` the extension mid-run, all in-progress research state must live in the durable run store (not in module-level memory), and the reloaded extension must be able to re-attach to it — which the state-machine design in §4.4 provides anyway.

---

## 2. Reference architecture for the research pipeline

### 2.1 The orchestrator–worker pattern

The strongest first-party reference in the evidence base is Anthropic's multi-agent research system: a lead agent plans the investigation and spawns **3–5 subagents in parallel**, each of which itself fans out **3+ tool calls in parallel**; this cut research time on complex queries by up to 90% [17]. Each subagent explores with a large private context — tens of thousands of tokens — but returns only a condensed summary of roughly **1,000–2,000 tokens** to the lead [15, 17]. Two structural rules accompany the pattern:

1. **Task specification.** Each worker needs an explicit objective, an output format, guidance on which tools and sources to use, and clear non-overlap boundaries [17].
2. **Fit check.** Multi-agent execution pays off for breadth-first research but is a poor fit when subtasks share dense dependencies or require the same full context [17]. A pi extension should therefore make fan-out adaptive, not mandatory.

### 2.2 Effort tiers

Anthropic's system scaled effort to query complexity with explicit tiers: a simple fact lookup needs one agent and 3–10 tool calls; a direct comparison needs 2–4 subagents with 10–15 calls each; complex research can justify more than 10 subagents with clearly divided responsibilities [17]. The pi extension should expose this as a user-selectable depth setting (and an automatic classifier default), because it is the primary cost/latency lever: it multiplies both token spend and provider request volume.

### 2.3 The pipeline as a state machine

Across the Google ADK, Anthropic, and OpenAI references, the convergent design is a **durable, idempotent state machine** rather than a loop over chat history [17, 18, 19]:

- **Active states:** planning, searching, reading, reflecting, synthesizing, paused. **Terminal states:** completed, cancelled, failed, budget-exhausted [18].
- Persist state **before and after** every externally visible side effect and every phase transition; give tool calls stable IDs so retries never duplicate work [18].
- On interruption, reconstruct from durable state and rerun only incomplete, idempotent operations — never replay raw history, which Google warns causes context pollution, token explosion, and "hallucinated progress" [18]. Anthropic's rationale is complementary: restarts of long runs are expensive and frustrating, so they combined retry logic with regular checkpoints [17].
- OpenAI's background-mode API is a useful interaction model for the pi command surface: pollable `queued`/`in_progress`/terminal statuses, **idempotent cancellation** ("cancelling twice is idempotent"), and cursor-based stream reconnection using per-event sequence numbers [19]. A pi `/research` command can adopt exactly this contract so a TUI detach/reattach or session restart is a non-event.

Within this skeleton, the research loop itself is: plan → decompose into scoped subtasks → parallel search/read cycles per worker → reflection (coverage check, conflict detection, gap list) → either another iteration or synthesis with citations. The reflection step's content is defined by the checkpoint schema in §4.3.

---

## 3. The search, reading, and extraction stack

### 3.1 What the 2026 benchmark evidence says

A third-party 2026 benchmark tested eight search APIs on 100 agent-style queries (4,000 retrieved results), scoring relevance, source quality, and noise with an LLM judge [2]. Results:

| Provider | Quality score | Avg. latency |
|---|---|---|
| Brave Search | 14.89 | 669 ms |
| Firecrawl | 14.58 | 1,335 ms |
| Exa | 14.39 | ~1.2 s |
| Parallel Search Pro | 14.21 | 13.6 s |

The top four were **statistically tied** ("so close that the differences could be random variation"), Brave was the only product reported to significantly outperform Tavily, and latency varied 20× across APIs [2]. Because the judge was an LLM and the corpus only 100 queries, the correct conclusion is not "pick Brave" but: **shortlist Brave (Web Search + LLM Context), Exa (Search + Contents), Tavily, and Firecrawl (Search/Scrape) behind one adapter, and run a pi-specific benchmark** stratified by coding documentation, news/freshness, exact-fact lookup, comparisons, PDFs, and adversarial/SEO pages — measuring recall@k, authoritative-source rate, duplicate rate, extraction success, citation support, p50/p95 latency, and cost per completed research task [2]. (This benchmark summary is marked partially supported in the findings; treat the numbers as directional.)

### 3.2 Provider profiles

**Brave (discovery + model-ready context).** Brave's standard Web Search offers freshness/date filters, country and language targeting, search operators, "extra snippets" (up to five additional excerpts per result), and Goggles custom re-ranking [3]. Its agent-oriented **LLM Context** endpoint returns extracted, query-relevant chunks plus source metadata in a single call, with configurable URL, snippet, and token caps (1,024–32,768 total tokens; default 8,192), relevance thresholds, and freshness filters [4]. The extension should expose **both modes**: SERP mode for transparent discovery and user-inspectable result lists, Context mode for compact, budgeted model input [3, 4].

**Exa (semantic discovery + selective reading).** Exa's contents endpoint returns full main text as extractive Markdown with navigation and popups stripped, in compact/standard/full verbosity with semantic section inclusion/exclusion; **highlights** are extractive and query-directed, while **summaries** are abstractive (generated by Gemini Flash) and can follow a JSON schema [5]. The citation rule that follows: use highlights and full text as citable evidence; treat summaries as convenience text, never as citable evidence [5]. Exa also reports **per-URL crawl statuses** and only errors the whole batch on internal failures — a response shape worth copying for pi tool results [5].

**Tavily (convenient all-in-one, with explicit switches).** Tavily's mid-2026 Search API exposes ultra-fast/fast/basic/advanced depth tiers, 0–20 results, news/general/finance topics, date ranges, up to 300 include/exclude domains, exact-phrase matching, and optional cleaned raw Markdown [6]. Two cost traps must stay explicit in the pi schema: `advanced` depth costs **2 credits vs. 1**, and automatic parameter selection can silently choose it; raw content and answer generation inflate response size [6]. Recommended wrapper defaults: `include_answer=false`, `include_raw_content=false`, shallow depth first, then a separate `read` for selected URLs [6]. (Partially supported; verify current parameter names against the live docs.)

**Optional synthesized-answer backends: Perplexity Search and Google grounding.** Perplexity Search returns ranked records with URL, title, extracted snippet, date, and `last_updated`, useful for real-time multi-query retrieval [12]. Google's Gemini grounding automatically decides whether to search, generates its own queries, and returns synthesized text with character-span URL citations plus the executed queries — and bills **per search query the model chooses to execute**, making cost less deterministic [13]. Both are legitimate optional backends, but their synthesized layers must not replace transparent retrieval: preserve the raw query/result/citation trace and **re-fetch important sources before final citation**, because generated summaries are downstream model output, not source text [12, 13].

### 3.3 A layered page reader

Route extraction through tiers of escalating cost [7, 8]:

1. **Cheap local/static-HTML readability first** for ordinary pages.
2. **Hosted browser-rendered fallback** — Jina Reader, Firecrawl, or Exa contents — for dynamic, blocked, PDF, or structurally complex pages. Jina Reader offers timeout and token-budget controls, CSS include/exclude/wait selectors, cache bypass/tolerance, no-cache/no-track modes, locale/proxy/cookie controls, iframe and Shadow DOM extraction, JavaScript execution, and an experimental ReaderLM-v2 conversion that costs **3× tokens** [7]. Firecrawl returns Markdown, HTML/raw HTML, screenshots, links, metadata, page counts, and concurrency information, with document parsing and OCR fallback [8].

Sending every easy static page through a hosted browser adds latency, cost, and **another trust boundary** for content that will enter the model's context — so escalation should be triggered by failure or page-class signals, not be the default [7, 8].

### 3.4 Retrieval design: passages, reranking, and query normalization

A SIGIR 2026 study on BrowseComp-Plus (two agents, five retrievers, three rerankers) supplies the internal retrieval guidance (both findings below are marked partially supported) [9]:

- **Operate on passages, not documents.** Passage-level units enabled more search/reasoning iterations under context limits and beat truncated documents. **Rerank a wider candidate pool** — reranking consistently improved ranking and answer accuracy while *reducing* search calls, with deeper reranking helping further. BM25 over passages alone reached 0.572 accuracy; BM25 plus monoT5-3B reranking reached 0.716 recall and 0.689 answer accuracy [9].
- **Keep two query representations.** Agent-issued queries skew toward keyword/quoted web-search syntax, which mismatches neural rankers trained on natural-language questions; a query-to-question (Q2Q) transformation significantly improved neural retrieval and reranking [9]. Practical rule: send the **original query** to Brave/Tavily/operators/BM25, and a generated natural-language question to dense retrieval/reranking — and log both for evaluation [9].
- Agent query style favors lexical, learned-sparse, and multi-vector retrieval over large single-vector dense retrievers [9], supporting a **hybrid lexical + semantic candidate generation** design with passage chunking that carries stable source/offset metadata, plus cross-encoder reranking.

### 3.5 Tool schema design for pi

The vendor surfaces converge on a three-tool split, which maps cleanly onto `pi.registerTool()` with Typebox schemas [4, 5, 6]:

- **`search`** — inputs: `query`, `mode` (`web|news|semantic|llm_context`), `max_results`, date/freshness, include/exclude domains, locale, safe-search, and a context budget. Results carry stable result/source IDs, title, canonical *and* original URL, snippet/highlights, rank and provider score, published/updated/retrieved timestamps, source type, and provider — and **never full page text by default** [4, 5, 6].
- **`read`** — inputs: URL or source ID, `output` (`markdown|passages|structured`), the driving `query`, max tokens, freshness/cache mode, and rendering strategy. Returns final URL, content hash, extraction method, passages with offsets/headings, metadata, warnings, and **per-item status** [5].
- **`crawl`** — separately permissioned and bounded by domain, path scope, and depth/page/time budgets [6].

### 3.6 Rate limits and failure handling as first-class behavior

Deep research fans out requests and **partial success is normal**, so resilience is a design feature, not an afterthought [5, 10, 11]:

- Provider-specific **concurrency pools** with deadlines and cancellation; bounded retries with exponential backoff and jitter for 429/5xx/timeouts; honor `Retry-After` and rate-limit reset headers; never blindly retry 400/auth/robots/forbidden failures; return partial results with **typed per-item errors** [10, 11, 5].
- Concrete limits to encode: Tavily documents 100 RPM (development) and 1,000 RPM (production), but crawl is 100 RPM and research-task creation only 20 RPM, returning 429 with a `retry-after` header [10]. Brave enforces a **1-second sliding window** and exposes limit/policy/remaining/reset headers [11]. Exa's per-URL statuses distinguish 404, crawl timeout, live-crawl timeout, forbidden/unavailable (403), and unknown 500+ [5].
- A **circuit breaker plus fallback provider** is preferable to stalling an entire run when one vendor degrades [10, 11].

---

## 4. Long-horizon agent engineering inside pi

### 4.1 Context is a compiled view, not a transcript

Google's production ADK guidance defines four distinct layers: ephemeral **working context** (the prompt for this one model call), a durable structured **session/event log**, long-lived searchable **memory**, and versioned **artifacts** addressed by name and version rather than pasted into prompts [14]. "The working context is the compiled view you ship to the LLM for this one invocation" [14]. For the pi extension this means: persist every plan change, query, tool result, source record, error, and control signal structurally in the run store, and build each model call from only the relevant slice. The payoffs are model portability, observability, clean compaction, time-travel debugging, and controlled latency and token cost [14].

### 4.2 Just-in-time retrieval and the source ledger

Anthropic's context-engineering guidance (flagged as contested/uncertain in the findings, so treat it as one vendor's recommended practice rather than settled consensus) argues context "must be treated as a finite resource with diminishing marginal returns," and recommends optimizing for the smallest high-signal token set [15]. Agents built "just in time" keep lightweight identifiers — file paths, stored queries, URLs — and load data into context dynamically at runtime [15]. Concretely for research runs: maintain a **source ledger** recording URL, title, date, trust level, fetch status, content hash, and local artifact path; have `search`/`read` tools return bounded snippets; and let workers request more only when a decision requires it [15]. A hybrid policy preloads a compact plan and source index while keeping full documents off-context [15].

### 4.3 Continuity: checkpoints *and* compaction

Relying on compaction alone is insufficient — Anthropic explicitly pairs it with structured note-taking and multi-agent isolation [15, 16]. Two complementary mechanisms:

1. **Periodic structured checkpoints.** A research checkpoint should preserve: the original question and constraints; the current plan and a coverage matrix; verified intermediate claims with source IDs; unresolved conflicts and gaps; failed queries; active worker status; budget consumption; and the exact next actions [15, 16]. Anthropic's long-running-harness writeup makes the same point from practice: agents need a fast way to reconstruct state from a fresh context window, accomplished there with a `claude-progress.txt` file alongside git history [16].
2. **Context compaction.** Trigger it *before* the hard context limit and at phase boundaries. When tuning the compaction prompt, "start by maximizing recall … then iterate to improve precision" [15]. Raw old tool outputs are among the safest content to clear once they are persisted externally [15].

### 4.4 Subagent isolation and handoffs

Workers should run in **fresh context windows** with explicit objectives, scopes, expected sources/tools, output schemas, and non-overlap boundaries, returning 1,000–2,000-token summaries rather than traces [15, 17]. Each handoff should include findings, evidence/source references, caveats, gaps, and suggested follow-ups [17]. This isolation "reduces path dependency and enables thorough, independent investigations" [17] — and it is what keeps the lead agent's context small enough to synthesize at the end.

Parallelize at two levels — independent workers, and independent search/read calls within a worker — but **bound it**: configurable global and per-host concurrency, queuing of excess work, respect for provider rate limits, cancellation of sibling work once coverage is sufficient, and no parallelization of dependent steps [17]. Effort follows the tiers in §2.2.

### 4.5 Observability and version pinning

Long-horizon multi-agent behavior is nondeterministic and small changes cascade, so structured tracing is a day-one requirement: record model calls, tool requests/results, worker lifecycle events, context-compaction decisions, retries, timings, token/cost counters, and checkpoint versions [17, 14]. Anthropic reports that "adding full production tracing let us diagnose why agents failed and fix issues systematically," and that they monitor decision patterns and interaction structures *without* reading conversation contents — a privacy-conscious redaction stance worth adopting, along with a policy of not storing hidden reasoning in traces [17]. Google's framing reinforces the mechanism: a rich structured event stream lets compaction, time-travel debugging, and memory ingestion operate without parsing opaque text [14]. Finally, **version everything that affects run semantics** — prompts, tool schemas, model IDs, run-state formats — and pin running jobs to a version or migrate checkpoints explicitly; Google uses rainbow deployments so updates never silently change the behavior of agents mid-run [17].

### 4.6 Progress UX in pi's TUI

The TUI surface (`setStatus`, `setWidget`, `custom`, `notify`, `confirm`) should render a **compact, event-driven progress view**, not chain-of-thought or raw token streams [1, 19, 20]:

- Show the plan, current phase, completed/total work (**X/Y counters** wherever totals exist — queries, sources, plan sections), active workers, newly accepted findings, source count, elapsed time, budget consumption, warnings, and a cancellation hint [20, 19].
- Use a **spinner only for brief indeterminate work**; use multi-line or aggregate bars for multiple concurrent workers, since "progress bars are best suited … for several lengthy, similar processes running in parallel" [20].
- **Update on meaningful events** so a stalled indicator reveals a hung worker rather than hiding it [20].
- Separate the ephemeral live view from a clean, redirect-safe final log; on completion, convert present-progress labels to completed states ("avoid the silent treatment … ensure a neat and readable log is left behind") [20].
- Offer expandable details or a verbose mode for worker/tool logs while the default view stays stable and readable; **never expose private reasoning** — show concise action/status summaries and evidence-backed intermediate findings [20, 19].

---

## 5. The quality, citation, and safety bar

**Citation standards.** The evidence base supports a strict provenance rule chain: (1) citable evidence must be *extractive* — Exa highlights/full text or equivalent — while abstractive provider summaries are convenience output, not evidence [5]; (2) synthesized-answer backends (Perplexity, Google grounding) must preserve their raw query/result/citation trace, and important sources must be **re-fetched before final citation**, because generated summaries are downstream model output [12, 13]; (3) source records carry content hashes, retrieval timestamps, and per-URL fetch statuses so every claim in the final report can be traced to a specific fetched artifact [5, 14]; (4) passages keep stable source/offset metadata through chunking and reranking so citations can point at spans, not just URLs [9].

**Evaluation.** Three layers are supported by the findings: the pi-specific provider benchmark of §3.1 (recall@k, authoritative-source rate, duplicate rate, extraction success, citation support, p50/p95 latency, cost per completed task) [2]; retrieval-level metrics from the BrowseComp-Plus study as reference points (passage recall, answer accuracy; e.g., 0.716/0.689 for BM25+monoT5-3B) [9]; and trace-driven evaluation in production, where structured traces let failures be diagnosed systematically rather than anecdotally [17]. Logging both query representations (raw and Q2Q) supports offline retrieval evaluation [9].

**Safety and prompt injection — an explicit gap.** The verified findings reviewed here do **not** include dedicated sources on prompt-injection defenses for web-derived content, and none is cited in this report. The adjacent mitigations that *are* evidenced: minimizing what enters context from untrusted pages (bounded snippets, JIT loading) [15]; avoiding unnecessary hosted-browser trust boundaries [7, 8]; treating all provider-generated summaries as untrusted downstream output rather than source text [5, 12, 13]; and redacting traces while avoiding storage of hidden reasoning [17]. A rigorous injection-threat model — content sanitization, instruction/data separation, tool-output tainting, and confirmation gates (`ctx.ui.confirm`) before acting on web-sourced instructions — must be specified from additional sources before the build is finalized.

---

## 6. Consolidated design recommendations and feature checklist

**Recommended default architecture.** A packaged npm extension (`pi` section in `package.json`, installable via `pi install`) registering: three retrieval tools (`search`, `read`, `crawl`) behind a provider-neutral adapter with Brave/Exa/Tavily/Firecrawl drivers and circuit-breaker fallbacks [1, 2, 10]; commands for run lifecycle (`/research`, `/research-status`, `/research-resume`, `/research-cancel`) with OpenAI-background-mode semantics (pollable states, idempotent cancel, cursor reconnect) [19]; an orchestrator–worker engine with effort tiers [17]; a durable run store implementing the four-layer context model [14]; and a TUI widget for event-driven progress [1, 20].

### Feature checklist

**Platform integration**
- [ ] TypeScript extension with async factory; resource startup after `session_start`, cleanup on `session_shutdown`; safe under `/reload` [1]
- [ ] Tools registered with compact Typebox schemas: `search` (modes, freshness, domain filters, context budget), `read` (output formats, token cap, per-item status), bounded `crawl` [4, 5, 6]
- [ ] Commands for start/status/resume/cancel; `confirm` gate for crawl permissions and budget increases [1]
- [ ] Packaged with `pi` manifest section; built/verified with `pi-extension-toolkit` / `pi-dev-kit` [1]

**Retrieval stack**
- [ ] Provider-neutral adapter; drivers for Brave (SERP + LLM Context modes), Exa (highlights/full text), Tavily (explicit credit-affecting switches), Firecrawl; optional Perplexity/Google grounding with trace preservation [2, 3, 4, 5, 6, 12, 13]
- [ ] Layered reader: local readability first, hosted rendering fallback [7, 8]
- [ ] Passage-level storage with source/offset metadata; hybrid lexical+semantic candidates; cross-encoder reranking; dual query representation (raw + Q2Q), both logged [9]
- [ ] Per-provider concurrency pools, backoff+jitter, `Retry-After` handling, typed per-item errors, partial results, circuit breaker + fallback [5, 10, 11]

**Long-horizon engineering**
- [ ] Durable state machine: planning/searching/reading/reflecting/synthesizing/paused; terminal completed/cancelled/failed/budget-exhausted; stable tool-call IDs; persist around every side effect [18, 19]
- [ ] Four-layer context model: compiled working context, session event log, searchable memory, versioned artifacts; source ledger with hashes and artifact paths [14, 15]
- [ ] Structured checkpoints (question, plan/coverage matrix, verified claims with source IDs, conflicts/gaps, failed queries, worker status, budget, next actions) + compaction triggered before limits and at phase boundaries [15, 16]
- [ ] Subagent isolation with schema-constrained 1–2k-token handoffs; effort tiers (1 worker/3–10 calls; 2–4 workers/10–15; >10 complex); bounded two-level parallelism with sibling cancellation [15, 17]
- [ ] Full structured tracing with privacy redaction; versioned prompts/schemas/models/run-state; pinned or migrated checkpoints [14, 17]
- [ ] TUI: X/Y counters, per-worker bars, event-driven updates, clean final log, verbose mode, no raw reasoning [19, 20]

**Quality and safety**
- [ ] Extractive-evidence-only citations; re-fetch before citing; span-level citation metadata [5, 9, 12, 13]
- [ ] Pi-specific provider benchmark harness (six stratified categories; recall@k, authoritative rate, extraction success, citation support, latency percentiles, cost per task) [2]
- [ ] Prompt-injection threat model and defenses — **specification pending; not covered by current evidence** (see §5)

**Known evidence gaps to close:** first-party architecture details for OpenAI and Google consumer deep-research products, the LangChain `open_deep_research` and `gpt-researcher` implementations, dedicated research-quality benchmarks, and prompt-injection countermeasures were goals of this research but are not represented in the verified sources, and should be researched before the corresponding design decisions are frozen.

---

## Sources

[1] Pi Coding Agent — https://pi.dev/docs/latest/extensions
[2] Agentic Search in 2026: Benchmark 8 Search APIs for Agents — https://aimultiple.com/agentic-search
[3] Brave Search — API (Web Search) — https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
[4] Brave Search — API (LLM Context) — https://api-dashboard.search.brave.com/documentation/services/llm-context
[5] Contents Retrieval — Exa — https://exa.ai/docs/reference/contents-retrieval
[6] Tavily Search — Tavily Docs — https://docs.tavily.com/documentation/api-reference/endpoint/search
[7] Reader API — Jina AI — https://jina.ai/reader/
[8] Scrape — Firecrawl Docs — https://docs.firecrawl.dev/api-reference/endpoint/scrape
[9] Revisiting Text Ranking in Deep Research — https://arxiv.org/html/2602.21456
[10] Rate Limits — Tavily Docs — https://docs.tavily.com/documentation/rate-limits
[11] Brave Search — API (Rate Limiting) — https://api-dashboard.search.brave.com/documentation/guides/rate-limiting
[12] Perplexity Search API — https://docs.perplexity.ai/docs/search/quickstart
[13] Google 検索によるグラウンディング (Grounding with Google Search) — https://ai.google.dev/gemini-api/docs/google-search?hl=ja
[14] Architecting efficient context-aware multi-agent framework for production — https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/
[15] Effective context engineering for AI agents — Anthropic — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
[16] Effective harnesses for long-running agents — Anthropic — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
[17] How we built our multi-agent research system — Anthropic — https://www.anthropic.com/engineering/multi-agent-research-system
[18] Build long-running AI agents that pause, resume, and never lose context with ADK — https://developers.googleblog.com/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/
[19] Background mode | OpenAI API — https://developers.openai.com/api/docs/guides/background
[20] CLI UX best practices: 3 patterns for improving progress displays — Evil Martians — https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays