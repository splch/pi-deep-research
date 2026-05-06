# pi-deep-research

Multi-agent deep research extension for [pi](https://github.com/badlogic/pi-mono). Decomposes a question into parallel sub-questions, dispatches isolated worker subagents that search and synthesize the web, then writes one cited report — with confidence labels, surfaced disagreements, an AI-disclosure header, and a full provenance manifest.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Planner    │ ──► │  N Workers   │ ──► │    Writer    │
│  (subagent)  │     │  (parallel,  │     │  (subagent)  │
│              │     │   isolated)  │     │              │
│ decompose →  │     │ search+fetch │     │ cite [N] →   │
│ sub-questions│     │ structured   │     │ report.md +  │
│              │     │ findings     │     │ manifest.json│
└──────────────┘     └──────────────┘     └──────────────┘
```

Each subagent is a separate `pi -p --mode json` process (isolated context window, least-privilege tool set). The same extension is re-injected into children via `-e <self>`, so workers inherit `web_search` and `web_fetch` and nothing else.

---

## Quick start

```bash
# Install (global; recommended so children pick it up automatically)
pi install git:github.com/splch/pi-deep-research

# OR clone + run locally
git clone https://github.com/splch/pi-deep-research ~/.pi/agent/extensions/pi-deep-research

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

The agent will state its scope interpretation, call `deep_research`, and after 5–20 minutes drop a `report.md` and `manifest.json` into `./.deep-research/<timestamp>/`.

---

## Tools

### `deep_research(query, instructions?, breadth?, depth?, concurrency?, max_sources?, output_dir?)`

Multi-agent orchestrator. Use only for questions a human analyst would take 4+ hours on. For one-shot lookups, call `web_search` / `web_fetch` directly.

| Param | Default | Caps | Meaning |
|---|---|---|---|
| `query` | — | — | The research question. |
| `instructions` | — | — | Detailed brief: audience, scope, sources, exclusions, format. |
| `breadth` | 4 | 1–8 | Parallel sub-questions per level. |
| `depth` | 1 | 1–3 | Recursion levels (each adds a planner+workers round). |
| `concurrency` | 4 | 1–8 | Max parallel worker subagents. |
| `max_sources` | 25 | 1–50 | Max unique sources cited in the final report. |
| `output_dir` | `./.deep-research/<ts>/` | — | Where `report.md` + `manifest.json` are written. |

### `web_search(query, max_results?)`

Provider-agnostic search. Picks whichever of `TAVILY_API_KEY` (preferred), `BRAVE_API_KEY`, `EXA_API_KEY`, `SERPAPI_API_KEY` is configured.

### `web_fetch(url)`

Fetches a URL and returns cleaned text. If `JINA_API_KEY` is set, uses Jina Reader (handles JS, returns markdown). Otherwise raw HTTP + minimal HTML→text. Output is truncated to 50KB.

### `/research <query>`

Slash command: tells the LLM to state its scope interpretation, then call `deep_research` with a detailed brief, and finally flag 2–3 claims worth spot-checking.

---

## How it maps to industry best practices

| Practice | How this extension implements it |
|---|---|
| **Orchestrator–worker architecture** (Anthropic; matches consensus that multi-agent wins for breadth-first research, single-agent wins for tight output coordination) | Planner + parallel Workers + single-shot Writer. Workers are *only* for search; the Writer composes the report alone. |
| **Subagent context isolation** ("search is compression") | Each phase runs in a separate `pi -p --mode json` process. Parent never inherits worker stack frames. |
| **Configurable breadth × depth × concurrency** with hard caps | `breadth ≤ 8`, `depth ≤ 3`, `concurrency ≤ 8`, `max_sources ≤ 50`, plus per-subagent timeout (10 min). |
| **Counter-evidence sub-question** (mitigates confirmation bias) | Planner prompt requires at least one counter-evidence question. |
| **Confidence labels on every claim** | Workers tag each fact `verified` / `single-source` / `inferred` / `uncertain`. Writer renders these as ✓ / ◐ / ? / ?. |
| **Surfaced disagreements** | Workers populate `disagreements[]`; Writer is required to render them inline ("Sources differ on X: [1]…[3]…"). |
| **Post-hoc citation attribution** (Anthropic CitationAgent pattern; more reliable than inline citation generation) | Writer receives a deduped, numbered Source list and is restricted to citing only those indices. Findings carry pre-mapped `sources_used` indices. |
| **Hallucination guard on citations** | Writer prompt explicitly forbids inventing URLs/titles/facts; only the numbered list is permitted. |
| **Indirect-prompt-injection mitigation** (OWASP LLM Top 10 #1) | Worker prompt declares fetched content untrusted; injection attempts must be recorded verbatim in `disagreements`. Workers also have *no* write/edit/bash tools — least privilege by construction. |
| **AI-disclosure header on report** (ICMJE/COPE/WAME consensus) | Every report opens with a frontmatter block + warning ("AI cannot be an author; verify before relying"). |
| **Provenance manifest** | `manifest.json` records run id, query, brief, config, plan, every subagent run with usage/cost, all findings, deduped sources, and the report path. |
| **Cost & turn tracking** | Each phase parses `pi --mode json` events; manifest aggregates `input` / `output` / `cost` / `turns` / `toolCalls`. |
| **Cancellation & timeouts** | All children honor the parent `AbortSignal`; per-subagent SIGTERM→SIGKILL with grace; partial failures are tolerated. |
| **Graceful partial failure** | A failed worker is recorded as such; remaining workers and the writer still proceed. |
| **Reproducibility** | Manifest + plan + per-run config are sufficient to re-execute. Subagents start with `--no-skills --no-context-files --no-prompt-templates --no-session` for clean isolation. |

---

## What this does NOT do (deliberate scope limits)

- **Does not auto-verify citations.** Industry data shows even RAG-grounded vendor tools hallucinate cites at ~17–33%. The disclosure header tells the user to spot-check; the manifest tells them where to look.
- **Does not include a separate evaluator/judge.** Adding one without a calibrated "good enough" threshold creates infinite-loop failure modes ("skeptic loop"). The Writer's grounding constraints are simpler and more reliable.
- **Does not search local docs.** For grounded-corpus research (NotebookLM-style), use a different tool — open-web deep research has a different failure profile.
- **Does not bypass enterprise data policy.** It uses your shell environment and pi's configured model. Run it on enterprise-tier LLM accounts (zero data retention) for sensitive work.

---

## Output layout

```
.deep-research/2026-05-05T14-32-07-123Z/
├── report.md       # disclosure header + cited markdown report
└── manifest.json   # full provenance: plan, findings, sources, runs, usage
```

`report.md` opens with:

```markdown
---
generated_by: pi-deep-research
generated_at: 2026-05-05T14:32:07.123Z
duration_ms: 632108
query: "..."
breadth: 4
depth: 1
concurrency: 4
unique_sources: 22
workers_total: 4
workers_failed: 0
total_cost_usd: 0.4781
---

> ⚠️  This report was generated by an autonomous AI deep-research agent...

---

## TL;DR
- ✓ Claim with strong support [1][3].
- ◐ Single-source claim [4].
- ? Inferred claim [2].

## ...

## Sources
[1] Title — https://...
[2] Title — https://...
```

---

## Architecture choices (and the trade-offs behind them)

- **Why orchestrator-worker with a single-shot Writer, not full multi-agent everywhere?** Because parallel sub-agents writing parts of one document produce disjoint outputs (the well-documented Cognition / LangChain finding). Multi-agent is a research-phase optimization; single-agent writing keeps the report coherent.
- **Why post-hoc citations rather than inline-as-the-Writer-writes?** Writers attaching citations during composition is the highest-fabrication path. Pre-deduping the source list and constraining the Writer to numeric indices into that list materially reduces invented URLs.
- **Why subprocess isolation rather than threads or async-only?** Each subagent gets its own context window (no cross-contamination), its own retry behavior, and its own SIGTERM kill switch. A single hung worker cannot brick the run.
- **Why no "evaluator" / "skeptic" agent?** Without a calibrated "good enough" threshold, evaluators trap orchestrators in infinite loops. The constraints we *do* enforce (counter-evidence question, confidence labels, source restriction, disagreement surfacing) are deterministic and bias-mitigating without that risk.
- **Why hard caps on breadth/depth/concurrency?** Token spend explains the bulk of variance on hard browsing benchmarks, and unbounded recursion is the easy way to a $50 query. Caps keep cost predictable.

---

## Verifying citations (recommended human workflow)

1. Open `report.md`. Pick 3–5 random `[N]` citations supporting load-bearing claims.
2. Cross-reference each `[N]` to the `## Sources` list. Open the URL.
3. Confirm the cited passage exists and entails the claim. Reject if not.
4. Independently search for one disagreement claim ("Sources differ…"). Confirm both sides exist.
5. For high-stakes outputs (legal, medical, financial), verify *every* citation and inspect `manifest.json → findings[].key_facts` for confidence labels weaker than `verified`.

This step is not optional. It is the difference between deep research as a research tool and deep research as a Mata-v.-Avianca incident.

---

## Configuration reference

| Env var | Required? | Effect |
|---|---|---|
| `TAVILY_API_KEY` | one of these is required | Use Tavily for `web_search` (preferred — built for AI agents). |
| `BRAVE_API_KEY` | " | Use Brave Search for `web_search`. |
| `EXA_API_KEY` | " | Use Exa for `web_search` (neural/semantic). |
| `SERPAPI_API_KEY` | " | Use SerpAPI (Google SERP proxy) for `web_search`. |
| `JINA_API_KEY` | optional | Route `web_fetch` through Jina Reader (handles JS, cleaner extraction). |

The model used by every subagent is whatever `pi` is configured to use. Set with `pi --model …` or in `~/.pi/agent/settings.json` before invoking. (For research workloads, prefer reasoning models for the Planner and Writer; non-reasoning is fine for Workers.)

---

## License

MIT. See `LICENSE`.
