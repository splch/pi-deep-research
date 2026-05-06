# Example: Single-agent vs. multi-agent LLM deep-research architectures

A worked example of using `deep_research` for a comparative architecture analysis.

## Files

- [`report.md`](./report.md) — the generated report (30 sources, structured TL;DR + trade-off matrix + "which wins where")
- [`manifest.json`](./manifest.json) — full run metadata (sub-questions, per-worker traces, cited sources)

## Original query

> What are the trade-offs between single-agent and multi-agent LLM deep-research architectures, and which architecture wins under which conditions?

## Run parameters

| Parameter      | Value                  |
| -------------- | ---------------------- |
| `breadth`      | 5                      |
| `depth`        | 2                      |
| `concurrency`  | 5                      |
| `max_sources`  | 30                     |
| Workers        | 9 / 10 succeeded       |
| Wall-clock     | ~11.7 min              |
| Cost           | ~$32.42                |
| Unique sources | 30                     |

## What made this prompt work

The `instructions` brief was structured around five concrete scaffolds the planner could lean on:

1. **Audience pinned** — "ML engineers, applied researchers, tech leads," with explicit "skip definitions of what an LLM/agent is" so workers don't waste turns on background.
2. **Scope fenced both ways** — explicit INCLUDE list of named systems (Anthropic Research, OpenAI Deep Research, Gemini DR, Perplexity, GPT Researcher, STORM, Open Deep Research) and an EXCLUDE list (general "agentic AI" hype, robotics, pure RAG).
3. **Source preferences ranked** — first-party engineering posts → peer-reviewed/arXiv → named practitioner blogs → benchmark leaderboards, with an explicit anti-list (SEO Medium, listicles).
4. **Output shape pre-specified** — markdown structure, ~1,500–2,500 words, a literal trade-off matrix with named axes, inline numbered citations, confidence labels on TL;DR claims.
5. **Completeness checklist** — eight bullet points the report must address (Anthropic's quality vs cost numbers, GAIA/BrowseComp/HLE/FRAMES coverage, ≥1 documented failure mode per architecture, latency comparison, hybrid patterns, explicit recommendations for five workload profiles, where evidence is thin).

The checklist in particular is what kept the report from becoming a balanced-but-vague essay — it forced the workers to chase specific numbers (the 15× token figure, 90.2% lift, 67.36% GAIA, etc.) rather than hand-wave.

## Claims worth spot-checking

Three load-bearing claims a reader should verify before quoting the report:

1. **"+90.2% over single-agent Opus 4"** — single source (Anthropic's own engineering post), Anthropic-internal eval, Anthropic-designed LLM-judge rubric. Re-read the source to confirm the exact framing (win-rate vs. percentage-point delta vs. relative improvement).
2. **Gemini 3 Pro Deep Research at "46.4% HLE / 59.2% BrowseComp"** — vendor self-reported, recent release, SOTA-shifting numbers. Worth cross-checking against independent leaderboard runs and confirming what tool/compute budget was allowed.
3. **"~15× chat tokens for multi-agent, ~4× for single-agent tool use"** — the central economic claim driving every "which wins where" recommendation. Confirm whether it's a measured average (over what query mix) or an illustrative figure, and whether it includes the CitationAgent / tool-testing-agent overhead.

## Reproducing

```ts
deep_research({
  query: "What are the trade-offs between single-agent and multi-agent LLM deep-research architectures, and which architecture wins under which conditions?",
  instructions: "...", // see prompt.md for the full brief
  depth: 2,
  breadth: 5,
  concurrency: 5,
  max_sources: 30,
});
```
