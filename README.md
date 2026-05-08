# pi-deep-research

Multi-agent deep research extension for [pi](https://github.com/badlogic/pi-mono). Decomposes a question into parallel sub-questions, dispatches isolated worker subagents that search and synthesize the web, then writes one cited report — with confidence labels, surfaced disagreements, post-hoc CitationAgent verification, automatic dead-link checks, optional cost cap, an AI-disclosure header, and a full provenance manifest.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Planner    │ ► │  N Workers   │ ► │    Writer    │ ► │   E1 URL     │ ► │  Citation    │
│  (subagent)  │   │  (parallel,  │   │  (subagent)  │   │   Verify     │   │   Agent      │
│              │   │   isolated)  │   │              │   │  (HEAD)      │   │  (subagent)  │
│ tier + sub-  │   │ search+fetch │   │ cite [N] →   │   │ mark dead    │   │ audit & 💀   │
│ questions    │   │ structured   │   │ draft.md     │   │ links        │   │ repaired md  │
│              │   │ findings     │   │              │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

URL verification runs **before** the CitationAgent so the agent receives the dead-link map and can mark `[N]💀` directly while it audits citations. If the CitationAgent is disabled, the orchestrator inlines the `💀` markers itself.

Each subagent is a separate `pi -p --mode json` process (isolated context window, least-privilege tool set). The same extension is re-injected into children via `-e <self>`, so workers inherit `web_search` and `web_fetch` and nothing else.

---

## Quick start

```bash
# Install (global; recommended so children pick it up automatically)
pi install git:github.com/splch/pi-deep-research

# Configure at least one search provider (one is enough)
export TAVILY_API_KEY=...      # preferred — built for AI agents
# or BRAVE_API_KEY, EXA_API_KEY, SERPAPI_API_KEY

# Optional: better page extraction for JS-heavy sites
export JINA_API_KEY=...

# Use it
pi
> /research What are the trade-offs between single-agent and multi-agent
  LLM deep-research architectures, and which wins where?
```

The agent will state its scope interpretation, call `deep_research`, and after 5–20 minutes drop a `report.md` and `manifest.json` into `./.deep-research/<timestamp>-<slug>/`.

---

## Tools

### `deep_research(query, ...)`

Multi-agent orchestrator. Use only for questions a human analyst would take 4+ hours on. For one-shot lookups, call `web_search` / `web_fetch` directly.

**Core parameters**

| Param | Default | Caps | Meaning |
|---|---|---|---|
| `query` | — | — | The research question. |
| `brief` | — | — | **Structured brief** — see [Structured brief](#structured-brief). |
| `preset` | — | — | `legal` \| `medical` \| `academic` \| `financial` \| `regulatory` — overlays sources, raises verification bar, adds a domain-specific disclosure. |
| `language` | — | — | Primary language for searches and report (e.g. `English`, `Deutsch`, `日本語`). |
| `breadth` | 4 | 1–8 | Parallel sub-questions per level (cap; effort tier may shrink it further). |
| `depth` | 1 | 1–3 | Recursion levels (each adds a planner+workers round). |
| `concurrency` | = `breadth` | 1–8 | Max parallel worker subagents. |
| `max_sources` | 25 | 1–50 | Max unique sources cited in the final report. |
| `max_total_usd` | — | — | Soft USD cap. Run aborts gracefully and writes partial results when exceeded. |
| `output_dir` | `./.deep-research/<ts>-<slug>/` | — | Where `report.md` + `manifest.json` are written. |

**Quality / cost dials**

| Param | Default | Meaning |
|---|---|---|
| `effort_tier` | `auto` | `fact` (≤2 subq), `comparison` (≤4), `complex` (= breadth), or `auto` (planner picks). Caps breadth. |
| `breadth_decay` | `true` | Halve breadth at each recursion level (`max(2, breadth // 2)`). |
| `citation_audit` | `true` | Run a 5th-phase auditor that repairs miscited claims and marks 💀 dead links. |
| `verify_urls` | `true` | HEAD-check every cited URL. Failed URLs are tagged `[N]💀` in the report. |
| `brief.recency_bound` | — | ISO date — older sources get downgraded to "uncertain" unless canonical. |

**Per-phase model & thinking overrides**

The dominant cost lever in practice. Workers do bulk extraction (cheap models OK); Writer/CitationAgent benefit from reasoning.

| Param | Effect |
|---|---|
| `planner_model` / `planner_thinking` | Override pi's model / thinking level for the Planner. |
| `worker_model` / `worker_thinking` | Override pi's model / thinking level for Workers. |
| `writer_model` / `writer_thinking` | Override pi's model / thinking level for the Writer. |
| `citation_model` / `citation_thinking` | Override pi's model / thinking level for the CitationAgent. |

`thinking` accepts `off | minimal | low | medium | high | xhigh`.

**Security / egress**

| Param | Meaning |
|---|---|
| `host_allowlist` | Host patterns (`example.com`, `*.gov`) — workers can only fetch matching hosts. Empty = no allowlist. |
| `host_blocklist` | Host patterns to refuse. |
| `extra_worker_tools` | Additional pi-registered tool names workers may call (e.g. MCP-provided tools). Default: just `web_search` + `web_fetch`. |

URL exfiltration sinks (api keys, tokens, oversized opaque blobs in query strings) are **always** refused at the `web_fetch` layer regardless of allowlist — this blocks the third leg of the lethal trifecta architecturally.

### `web_search(query, max_results?)`

Provider-agnostic search. Picks whichever of `TAVILY_API_KEY` (preferred), `BRAVE_API_KEY`, `EXA_API_KEY`, `SERPAPI_API_KEY` is configured.

### `web_fetch(url)`

Fetches a URL and returns cleaned text. If `JINA_API_KEY` is set, prefers Jina Reader (handles JS, returns markdown). Direct HTTP otherwise; auto-escalates to Jina on sparse/empty pages when Jina is configured. Refuses URLs that look like exfiltration sinks. Output truncated to 50KB. Returns `content_sha256` in tool details for provenance.

### `/research <query>`

Slash command: tells the LLM to state its scope interpretation, call `deep_research` with a structured `brief` (and matching `preset` if applicable), and finally flag 2–3 claims worth spot-checking — paying attention to any `[N]💀` dead-link markers, citation-audit section, and cost-cap warnings.

---

## Structured brief

The `brief` is the primary input shape. Use it to get the benefit of a well-engineered research prompt without writing one from scratch each time. `notes` is the free-form escape hatch for context that doesn't fit a structured field.

| Field | Type | Effect |
|---|---|---|
| `audience` | string | Who the report is for. |
| `scope_in` | string[] | What's in-scope. |
| `scope_out` | string[] | What's out-of-scope. |
| `source_prefer` | string[] | Source types/exemplars to prefer. |
| `source_avoid` | string[] | Source types to avoid. |
| `must_address` | string[] | Completeness checklist (per-item). |
| `recency_bound` | ISO date | Older sources downgraded to "uncertain" unless canonical. |
| `target_words` | integer | Length budget (100–50,000). |
| `notes` | string | Free-form addendum (replaces the old top-level `instructions`). |

Example:

```ts
deep_research({
  query: "How are central banks deploying CBDC pilots in 2025–2026?",
  preset: "financial",
  language: "English",
  brief: {
    audience: "Senior policy analyst at a G20 finance ministry",
    scope_in: ["wholesale and retail CBDC pilots since 2024", "interoperability standards", "privacy designs"],
    scope_out: ["cryptocurrency speculation", "CBDC opinion pieces"],
    source_prefer: ["central bank releases", "BIS papers", "primary CBDC pilot reports"],
    source_avoid: ["crypto news listicles"],
    must_address: [
      "Cover at least 5 distinct jurisdictions.",
      "Distinguish wholesale from retail designs.",
      "Note any cross-border interop pilots.",
    ],
    recency_bound: "2024-01-01",
    target_words: 3500,
    notes: "Frame the analysis around the Eurosystem's current digital-euro investigation phase."
  },
  depth: 2, breadth: 5, max_sources: 30,
  max_total_usd: 10.0,
});
```

---

## Domain presets

Each preset overlays source preferences, a stricter completeness checklist, a higher source-per-claim bar, and a domain-specific disclosure header.

| Preset | Disclosure invokes | Source preferences | Min sources per claim |
|---|---|---|---|
| `legal` | Mata v. Avianca; Charlotin's database; Versant Funding | Statutes, reported decisions, agency rulemaking, law reviews | 1 (primary cites are often singular) |
| `medical` | JMIR fabricated-citation review; Retraction Watch; PRISMA / L-PRISMA | RCTs, Cochrane, society guidelines, FDA/EMA, PubMed | 2 |
| `academic` | ICMJE/COPE/WAME consensus; PRISMA / ROSES | Peer-reviewed, primary datasets, replication packages | 1 |
| `financial` | SR 26-02 (replacing SR 11-7) | EDGAR filings, earnings transcripts, central bank releases, BLS/BEA/Census | 2 |
| `regulatory` | NIST AI RMF / ISO 42001 framing; binding-vs-voluntary distinction | NIST/ENISA/FTC/EU AI Office, EUR-Lex, ISO/IEC/IEEE/W3C, GAO/NAO | 1 |

Presets do not change the architecture — they raise the bar and pre-fill the brief.

---

## How it maps to industry best practices

| Practice | How this extension implements it |
|---|---|
| **Orchestrator–worker architecture** with a single-shot Writer (Anthropic; matches consensus that multi-agent wins for breadth-first research, single-agent wins for tight output coordination) | Planner + parallel Workers + single-shot Writer + CitationAgent. Workers are *only* for search; the Writer composes the report alone. |
| **Subagent context isolation** ("search is compression") | Each phase runs in a separate `pi -p --mode json` process. Parent never inherits worker stack frames. |
| **Configurable breadth × depth × concurrency with hard caps** | `breadth ≤ 8`, `depth ≤ 3`, `concurrency ≤ 8` (defaults to breadth), `max_sources ≤ 50`, plus per-subagent timeout (10 min). |
| **Anthropic-style effort scaling** ("simple → 1 agent + 3-10 calls; complex → 10+") | `effort_tier` with `auto` / `fact` / `comparison` / `complex`; planner can choose tier in `auto` mode and tier caps the effective breadth. |
| **Breadth decay over recursion** (GPT-Researcher's `max(2, breadth // 2)`) | `breadth_decay: true` (default). |
| **Explicit search budget per worker** (≤8 searches, ≤6 fetches, stop-after-3-empty rule) | Worker prompt enforces this hard cap. |
| **Required publication date** on every cited source | Worker output schema requires `publication_date` per source; presets that demand it forbid `unknown`. |
| **Triangulation for "verified" claims** | Worker prompt requires ≥2 INDEPENDENT sources for a `verified` label; same author/org doesn't count as independent. |
| **Counter-evidence sub-question** (mitigates confirmation bias) | Planner prompt requires at least one counter-evidence question. |
| **Confidence labels on every claim** | Workers tag each fact `verified` / `single-source` / `inferred` / `uncertain`. Writer renders these as ✓ / ◐ / ? / ?. |
| **Surfaced disagreements** | Workers populate `disagreements[]`; Writer is required to render them inline ("Sources differ on X: [1]…[3]…"). |
| **Post-hoc citation attribution** (Anthropic CitationAgent pattern) | Two-layer: (1) Writer is constrained to a deduped, numbered Source list with pre-mapped `sources_used` indices; (2) CitationAgent 5th phase audits the draft, repairs miscited claims, flags unsupported ones, appends a `## Citation audit` section. |
| **E1 URL-resolve verification** (LiveResearchBench's E1 step) | HEAD-check every cited URL after the Writer; tag `[N]💀` in the report; full results in `manifest.url_checks`. |
| **Indirect-prompt-injection mitigation** (OWASP LLM Top 10 #1) | Worker prompt declares fetched content untrusted; injection attempts must be recorded verbatim in `disagreements`. Workers also have *no* write/edit/bash tools — least privilege by construction. |
| **Lethal-trifecta egress block** (Simon Willison; OpenAI's "no arbitrary URL construction" mitigation) | `web_fetch` refuses URLs whose query strings contain `api_key` / `secret` / `token` / `password` / `auth` / `bearer` keys, oversized opaque blobs (>300 chars base64-shaped), or whose protocol is not HTTP(S). Optional `host_allowlist` / `host_blocklist` per query. |
| **Cost cap + graceful partial-results** (token-spend-explains-80%-of-variance literature) | `max_total_usd` checked before each subagent launch; the run aborts gracefully and writes whatever it has. Disclosure header surfaces 💸 cap-hit. |
| **AI-disclosure header on report** (ICMJE/COPE/WAME consensus; preset adds domain-specific extras) | Every report opens with a frontmatter block + warning ("AI cannot be an author; verify before relying"); presets add an extra warning line. |
| **Per-phase model cascade** (Anthropic Opus-lead/Sonnet-subagent; OpenAI o3 + o3-mini summarizer) | Independent `planner_model` / `worker_model` / `writer_model` / `citation_model` overrides plus matching `*_thinking` levels. |
| **Domain presets** (raises verification bar for high-stakes queries) | `legal | medical | academic | financial | regulatory` overlays source preferences, a stricter checklist, an extra disclosure line, and a min-sources-per-claim bar. |
| **Structured brief** (the seven-element brief Doc-C describes — audience/objective/scope/sources/recency/format/checklist) | Typed `brief` schema with `audience`, `scope_in/out`, `source_prefer/avoid`, `must_address`, `recency_bound`, `target_words`, `notes`. |
| **Multilingual research** | `language` parameter is propagated into the brief preamble for all phases. |
| **Web-fetch escalation** (Jina Reader for JS-heavy pages) | Direct HTTP first; auto-escalates to Jina if `JINA_API_KEY` is set and the page came back sparse/empty. If `JINA_API_KEY` is set, Jina is preferred from the start (fall back to direct). |
| **Provenance manifest with full lineage** | `manifest.json` records run id, query, brief (user input + resolved post-preset), preset, language, config, plan, every subagent run with usage/cost/turns/model/level, all findings (with content SHA-256), deduped sources, URL-check results, and the report path. `schema_version: 4`. |
| **Reproducibility metadata** (Doc-B reproducibility checklist) | Manifest captures `extension_version`, `node_version`, `platform`, `arch`, `search_provider`, `jina_configured`, plus per-phase models actually used (resolved from pi's events). |
| **Cost & turn tracking** | Each phase parses `pi --mode json` events; manifest aggregates `input` / `output` / `cost` / `turns` / `toolCalls`. |
| **Cancellation & timeouts** | All children honor the parent `AbortSignal`; per-subagent SIGTERM→SIGKILL with grace; partial failures are tolerated. |
| **Graceful partial failure** | A failed worker is recorded as such; remaining workers and the writer still proceed. Cost-cap mid-run also writes partial results. |

---

## What this does NOT do (deliberate scope limits)

- **Does not perform full E2/E3 entailment-grade verification.** E1 (URL-resolves) is automated — the cheapest failure mode is closed. E2 (URL is topically relevant) and E3 (content actually supports the claim) require running another LLM pass and substantial cost; the disclosure header tells the user to spot-check, the CitationAgent flags clearly miscited claims, and the manifest tells them where to look.
- **Does not include a separate evaluator/judge agent.** Adding one without a calibrated "good enough" threshold creates infinite-loop failure modes ("skeptic loop"). The CitationAgent has a deterministic single-pass scope and cannot loop.
- **Does not search local docs by default.** Use `extra_worker_tools` to grant workers MCP-provided tools registered globally in pi for proprietary-corpus research.
- **Does not bypass enterprise data policy.** It uses your shell environment and pi's configured model. Run it on enterprise-tier LLM accounts (zero data retention) for sensitive work.

---

## Output layout

```
.deep-research/2026-05-08T14-32-07-123Z-cbdc-pilots-2025-2026/
├── report.md       # disclosure header (+preset/cap/failure extras) + cited markdown report
└── manifest.json   # full provenance: run, request, config, environment, plan, findings, sources, url_checks, runs, usage
```

`report.md` opens with:

```markdown
---
generated_by: pi-deep-research
extension_version: 0.4.0
generated_at: 2026-05-08T14:32:07.123Z
duration_ms: 632108
query: "..."
language: English
breadth: 5
effective_breadth: 4
depth: 2
concurrency: 5
effort_tier: comparison
preset: financial
unique_sources: 22
workers_total: 4
workers_failed: 0
dead_link_citations: 1
citation_audit: enabled
url_verify: enabled
total_cost_usd: 0.4781
---

> ⚠️  This report was generated by an autonomous AI deep-research agent...
>
> 💀 1 cited URL(s) failed HEAD verification — see [N]💀 markers...
>
> ⚠️ FINANCIAL DOMAIN: This output is NOT investment, accounting, or compliance advice...

---

## TL;DR
- ✓ Claim with strong support [1][3].
- ◐ Single-source claim [4]💀.
- ? Inferred claim [2].

## ...

## Sources
[1] Title [2025-01-12] — https://...
[2] Title [2024-11-30] — https://...

## Citation audit
- Total citations: 47
- Dead-link citations: 1
- Repaired during audit: 3
- [unsupported] claims: 0
```

`manifest.json` (`schema_version: 4`) is grouped:

```json
{
  "schema_version": 4,
  "run":         { "id": "...", "started_at": "...", "duration_ms": ..., "report_path": "...", "cost_cap_hit": false, "abort_reason": null },
  "request":     { "query": "...", "brief": {...}, "brief_resolved": {...}, "preset": "financial", "language": "English" },
  "config":      { "breadth": 5, "effective_breadth": 4, "depth": 2, "concurrency": 5,
                   "max_sources": 30, "max_total_usd": 10.0, "breadth_decay": true,
                   "effort_tier": "comparison", "citation_audit": true, "url_verify": true,
                   "host_allowlist": [], "host_blocklist": [], "extra_worker_tools": [],
                   "models":   { "planner": "...", "worker": "...", "writer": "...", "citation": "..." },
                   "thinking": { "planner": "...", "worker": "...", "writer": "...", "citation": "..." } },
  "environment": { "extension_version": "0.4.0",
                   "node_version": "v24.15.0", "platform": "darwin", "arch": "arm64",
                   "search_provider": "tavily", "jina_configured": true },
  "plan": [...],
  "findings": [ { "...", "_content_sha256": "..." }, ... ],
  "sources":  [...],
  "url_checks": [...],
  "dead_link_indices": [...],
  "runs": [ { "phase": "planner", "level": null, ... }, { "phase": "worker", "level": 1, ... }, ... ],
  "usage": { "input": ..., "output": ..., "cost": ..., "turns": ..., "toolCalls": ... }
}
```

---

## Architecture choices (and the trade-offs behind them)

- **Why orchestrator-worker with a single-shot Writer, not full multi-agent everywhere?** Because parallel sub-agents writing parts of one document produce disjoint outputs (the well-documented Cognition / LangChain finding). Multi-agent is a research-phase optimization; single-agent writing keeps the report coherent.
- **Why a separate CitationAgent rather than inline citation generation alone?** Anthropic's documented experience: post-hoc citation attribution is materially more reliable than asking the synthesis model to attach citations during composition. The CitationAgent runs once, deterministically, with the source list and `sources_used` indices in front of it.
- **Why HEAD-only URL verification (E1) and not entailment (E3)?** E1 catches the cheapest and most embarrassing failure mode (broken/invented URLs) for ~$0 in LLM cost. E3 (does the page actually support the claim?) requires a second LLM pass per claim and is what the human verifier is for.
- **Why an effort tier instead of a flat breadth knob?** Anthropic's lead-agent prompt encodes effort tiers explicitly (`simple → 1 agent + 3-10 calls`; `complex → 10+ subagents`). Without tier-aware breadth, a `breadth=8` factoid query spawns 8 wasteful workers.
- **Why subprocess isolation rather than threads or async-only?** Each subagent gets its own context window (no cross-contamination), its own retry behavior, and its own SIGTERM kill switch. A single hung worker cannot brick the run.
- **Why no "evaluator" / "skeptic" agent?** Without a calibrated "good enough" threshold, evaluators trap orchestrators in infinite loops. The CitationAgent runs once and cannot loop; the constraints we *do* enforce (counter-evidence question, confidence labels, source restriction, disagreement surfacing, URL verify) are deterministic.
- **Why hard caps on breadth/depth/concurrency *and* an optional `max_total_usd`?** Token spend explains the bulk of variance on hard browsing benchmarks. Caps alone keep cost bounded; the USD cap gives a hard ceiling for budgeted runs and writes partial results when hit.
- **Why per-phase model overrides?** Workers do most of the token volume but benefit least from reasoning capacity; Writer/CitationAgent benefit most. The per-phase override is the single biggest cost optimization available — see [model cascading](#model-cascading-recipes).

---

## Model cascading recipes

Default behavior uses pi's configured model for every phase. For better cost / quality, cascade:

```ts
// Cheap workers, reasoning Writer + Citation
deep_research({
  query: "...",
  worker_model: "anthropic/claude-haiku-4",
  worker_thinking: "low",
  writer_model: "anthropic/claude-opus-4",
  writer_thinking: "high",
  citation_model: "anthropic/claude-sonnet-4",
});

// Open-weight workers, frontier writer
deep_research({
  query: "...",
  worker_model: "openrouter/qwen/qwen3-235b",
  writer_model: "openai/o3",
  writer_thinking: "high",
});

// With a budget ceiling
deep_research({
  query: "...",
  worker_model: "anthropic/claude-haiku-4",
  writer_model: "anthropic/claude-opus-4",
  max_total_usd: 5.0,           // run aborts gracefully if exceeded
});
```

The manifest records the model that pi actually selected per phase (resolved from JSON events), so you can audit what cascade ran end-to-end.

---

## Verifying citations (recommended human workflow)

1. Open `report.md`. Pick 3–5 random `[N]` citations supporting load-bearing claims; **start with any `[N]💀` markers**.
2. Cross-reference each `[N]` to the `## Sources` list. Open the URL.
3. Confirm the cited passage exists and entails the claim. Reject if not.
4. Independently search for one disagreement claim ("Sources differ…"). Confirm both sides exist.
5. Read the `## Citation audit` section if present — it lists repaired counts and any `[unsupported]` claims the CitationAgent flagged.
6. For high-stakes outputs (legal, medical, financial), verify *every* citation and inspect `manifest.findings[].key_facts` for confidence labels weaker than `verified`. Make sure `manifest.request.preset` matches the domain.
7. If the disclosure header shows `cost_cap_hit: true`, the report is partial — re-read with awareness of which subtopics are likely undercovered.

This step is not optional. It is the difference between deep research as a research tool and deep research as a Mata-v.-Avianca incident.

---

## Configuration reference

| Env var | Required? | Effect |
|---|---|---|
| `TAVILY_API_KEY` | one of these is required | Use Tavily for `web_search` (preferred — built for AI agents). |
| `BRAVE_API_KEY` | " | Use Brave Search for `web_search`. |
| `EXA_API_KEY` | " | Use Exa for `web_search` (neural/semantic). |
| `SERPAPI_API_KEY` | " | Use SerpAPI (Google SERP proxy) for `web_search`. |
| `JINA_API_KEY` | optional | Route `web_fetch` through Jina Reader (handles JS, cleaner extraction). When set, Jina is preferred from the start; without it, direct HTTP is used and Jina is not available for escalation. |

Per-phase models are configured via tool params (`planner_model`, `worker_model`, `writer_model`, `citation_model`); pi's configured default is used when an override is not set. (`pi --model …` or `~/.pi/agent/settings.json` controls the default; for research workloads, prefer reasoning models for the Planner/Writer/CitationAgent and a non-reasoning model for Workers.)

---

## License

MIT. See `LICENSE`.
