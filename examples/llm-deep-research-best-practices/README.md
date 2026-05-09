# LLM Deep Research — Best Practices and Industry Standards

A self-referential example: using `deep_research` to research how to build
deep-research agents.

## Original question

> What are the best practices and industry standards for LLM deep research?

## Scope interpretation (caller-side, before the call)

- **Scope.** Meta-question about how to *build, run, and evaluate* LLM-based deep-research agent systems — planner/worker/writer multi-agent patterns, citation hygiene, hallucination mitigation, search/fetch tooling, eval benchmarks, cost controls. *Not* "how do I use ChatGPT to research a topic."
- **Audience.** Engineers and tech leads designing or operating deep-research agents, plus evaluators choosing between commercial systems.
- **Source preferences.** Vendor engineering posts (Anthropic, OpenAI, Google DeepMind, Perplexity), peer-reviewed/arXiv on agentic research and factuality (SAFE, FActScore, BrowseComp, GAIA, HLE), credible practitioner blogs. Avoid marketing pages, listicles, SEO content farms.
- **Output.** Practitioner's guide (~2,200 words) covering architecture, citation/verification, evals, anti-injection, cost.
- **Preset.** None — software-engineering topic, not legal/medical/academic/financial/regulatory.

## Call parameters

```jsonc
{
  "query": "What are the best practices and industry standards for building, running, and evaluating LLM-based \"deep research\" agent systems (multi-agent planner/worker/writer pipelines that search the web, fetch sources, and produce cited reports)?",
  "depth": 2,
  "breadth": 5,
  "max_sources": 30,
  "safe_check": true,
  "verify_urls": true,
  "citation_audit": true,
  "brief": {
    "audience": "Engineers and tech leads designing or operating LLM-powered deep-research agents…",
    "scope_in": [
      "Multi-agent architectures (orchestrator/planner + parallel workers + writer + citation auditor)",
      "Tool design (web_search vs web_fetch, host allow/blocklists, fetch-size limits)",
      "Citation/grounding standards (FActScore, SAFE, attribution F1, dead-link audits)",
      "Hallucination mitigation (atomic-fact decomposition, refusal on conflict)",
      "Eval benchmarks (BrowseComp, GAIA, HLE, DeepResearch-Bench, ResearchQA)",
      "Effort/cost controls (breadth/depth, USD caps, token caps, breadth-decay)",
      "Prompt engineering for researcher agents (planner/worker/writer, fork-vs-fresh)",
      "Security (XPIA on fetched pages, lethal-trifecta, tool-permission scoping)",
      "Commercial system architecture differences (OpenAI/Anthropic/Gemini/Perplexity/You.com)",
      "Domain presets (legal/medical/academic/financial/regulatory)",
      "Reproducibility/observability (manifests, run logs, deterministic seeds, cost telemetry)"
    ],
    "scope_out": [
      "Generic prompt-engineering tutorials",
      "RAG fundamentals not tied to research-agent design",
      "Consumer how-to guides for ChatGPT/Gemini/Perplexity end users",
      "Pure model-training research not targeted at research-agent capability",
      "Vendor sales/marketing copy"
    ],
    "source_prefer": [
      "Anthropic engineering blog",
      "OpenAI Deep Research system card and technical blog posts",
      "Google DeepMind / Google Research posts on Gemini Deep Research",
      "arXiv on agentic research, SAFE/FActScore, BrowseComp/GAIA/HLE/DeepResearch-Bench",
      "Peer-reviewed venues (NeurIPS, ICML, ACL, EMNLP) on attribution",
      "Credible practitioner blogs (Simon Willison, Hamel Husain, Eugene Yan, LangChain/LlamaIndex)",
      "Vendor technical docs (Perplexity, You.com, Exa, Tavily, Brave Search)"
    ],
    "source_avoid": [
      "Listicles, SEO content farms, 'top 10' marketing roundups",
      "LinkedIn thought-leadership without primary sources",
      "Vendor pricing/sales pages",
      "Reddit/forum threads as primary evidence",
      "Tutorials older than 2023 unless still canonical"
    ],
    "must_address": [
      "Canonical multi-agent architecture and when each component pays for itself",
      "How leading commercial systems actually compose these pieces (concrete differences)",
      "Citation hygiene (inline markers, dead-link audits, repair passes, attribution metrics)",
      "Search vs fetch tool design (allow/block lists, per-domain caps, fetch byte limits)",
      "Effort/cost controls and the thoroughness-vs-runaway-spend tradeoff",
      "Prompt-injection / XPIA / lethal-trifecta defenses",
      "Which benchmarks measure what, and their known limitations",
      "Domain presets (legal/medical/academic/financial/regulatory) and when to raise the bar",
      "Open vs closed stacks and what reproducibility looks like in practice"
    ],
    "recency_bound": "2023-06-01",
    "target_words": 2200,
    "notes": "Heavily favor 2024-2025. Cite papers/leaderboards directly, not blog summaries. Cite vendors' own engineering posts for architecture claims. Surface disagreements rather than picking one side. Each best practice should be implementable, not just a principle."
  }
}
```

## Run summary

| | |
|---|---|
| **Cost** | $12.87 |
| **Wall clock** | 1397.3s (~23 min) |
| **Workers** | 7/7 succeeded |
| **Sources** | 30 unique cited |
| **Cost cap hit** | No (no `max_total_usd` set — enterprise account) |
| **Dead links** | 0 (`💀` count) |
| **URL verification** | All 30 sources returned HTTP 200 |
| **Effort tier** | complex |
| **Turns** | 51 |

## Key findings (verbatim from the report TL;DR, condensed)

1. **Only Anthropic publicly commits to the full orchestrator/worker/citation-auditor split.** `LeadResearcher` (Opus 4) → 3–5 parallel Sonnet 4 subagents (each with isolated 200K context) → dedicated `CitationAgent`. OpenAI Deep Research is a single end-to-end RL-trained o3 derivative; Gemini Deep Research is a single-loop agent that scales via test-time compute SKUs (~80 vs ~160 searches); Perplexity publishes no decomposition.
2. **Multi-agent is contested.** Anthropic claims +90.2% over single-agent Opus 4 at ~15× the tokens. Cognition's *Don't Build Multi-Agents* and FutureSearch's frozen-corpus DRB (where ChatGPT o3 *beats* OpenAI Deep Research) push the other way. PwC's ablation reportedly shows fact-check accuracy *degrading* 42% as tool calls scale 2→150.
3. **Factuality stack has converged on decompose-then-verify.** FActScore (atomic facts) → SAFE (atomic + Google Search + F1@K) → AIS (formal "Attributable to Identified Sources") → ALCE (inline `[N]` citation precision/recall/F1). Run as a separate post-synthesis pass.
4. **URL hygiene is its own audit layer.** A 2026 arXiv paper measured 3–13% hallucinated URLs and 5–18% non-resolving across 10 commercial systems; deep-research agents fabricate URLs *more* than single-shot LLMs (10.7% vs 4.8%). HEAD-probe + Wayback self-correction loops cut this 6–79× to <1%.
5. **Anti-injection is architectural, not a guardrail.** Anthropic's `web_fetch` enforces "URL must already appear in conversation context" — collapses the exfiltration leg of Willison's lethal trifecta. Meta's *Agents Rule of Two* (≤2 of {untrusted input, sensitive systems, state-change/external-comm}) is the operative budget. *Attacker Moves Second* bypassed 12 published defenses >90% adaptively.
6. **Benchmarks bifurcate.** Short-answer (BrowseComp, GAIA, HLE) vs long-form (DeepResearch Bench RACE/FACT, FutureSearch DRB, ResearchQA). HLE has ~29% literature-contradicted chem/bio answers per FutureHouse — *not* a deep-research benchmark, despite frequent misuse.
7. **Domain bars matter.** Stanford RegLab found 17–34% hallucination on Lexis+ AI / Westlaw / Practical Law despite "hallucination-free" marketing. HealthBench grades against 48,562 physician-written rubric criteria, not exact-match.

Full report including `## Fact-check audit` and `## Citation audit` sections is in [`report.md`](./report.md).

## Claims worth spot-checking before quoting

1. **arXiv 2604.03173 — the URL-hallucination paper [16].** Load-bearing for the headline "10.7% vs 4.8% deep-research vs single-shot URL fabrication" claim. The fact-checker itself flagged the unusual arXiv ID prefix (2604 = April 2026, recently indexed). Cited 4 times; underpins much of §"Search/Fetch Tool Design" + §"Citation and Grounding Standards." Open the paper directly and confirm sample sizes (53,090 DRBench URLs, 168,021 ExpertQA URLs) before quoting.
2. **Anthropic's "token usage explains 80% of BrowseComp performance variance" [1].** The audit kept this at `◐` and surfaced PwC counter-evidence (Fact-Check accuracy *degrades* 42% as tool calls scale 2→150). This is the single biggest premise-disagreement in the report — vendor self-report vs independent ablation. Read both before defending an effort-tier policy with this number.
3. **DeepResearch Bench RACE scores (Gemini DR 48.88 / OpenAI DR 46.98 / Perplexity DR 42.25) [24].** The fact-checker caught that the ICLR 2026 version of the paper reports a different snapshot (50.95 / 46.25 / 44.11) — same ranking, different digits. Draft mixed the June 2025 leaderboard with the ICLR 2026 paper. Pick whichever snapshot you actually pulled.

Smaller items also worth verifying: the **HLE "~18% replication"** framing (per the audit, that's a single-reviewer disagreement rate on a health subset, not a clean three-expert replication) and the **Westlaw "33% vs >34%"** discrepancy between Stanford HAI press release and the published JELS paper.
