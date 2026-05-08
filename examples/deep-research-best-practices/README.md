# Example: Best practices and industry standards for LLM deep-research systems

A worked example of using `deep_research` for a meta-survey: "what does the field
agree (and disagree) on about how to build a deep-research agent?" Useful as a
template when the goal is a *practitioner-facing reference*, not a comparison or
recommendation.

## Files

- [`report.md`](./report.md) — the generated report (35 sources, 10-section structure: TL;DR → architectures → planning → retrieval → citations → eval → safety → cost → open problems → 16-item build checklist)
- [`prompt.md`](./prompt.md) — the exact query and structured `brief`
- [`manifest.json`](./manifest.json) — full run metadata (sub-questions, per-worker traces, cited sources)

## Original query

> What are the best practices and industry standards for LLM-based "deep
> research" systems — agentic systems that decompose a question, run iterative
> tool-augmented search, and produce cited synthesis reports?

## Run parameters

| Parameter      | Value                  |
| -------------- | ---------------------- |
| `breadth`      | 5                      |
| `depth`        | 2                      |
| `concurrency`  | 5                      |
| `max_sources`  | 35                     |
| Workers        | 9 / 10 succeeded       |
| Wall-clock     | ~18.0 min              |
| Cost           | ~$45.99                |
| Unique sources | 35                     |

## What made this prompt work

The brief borrowed five scaffolds from the
[single-vs-multi-agent example](../single-vs-multi-agent-deep-research/) and
added two that matter specifically for a *standards/best-practices* report:

1. **Audience pinned** — "practitioner who is building, evaluating, or hardening
   an LLM deep-research system." Explicit "do not explain what an LLM is."
2. **Scope fenced both ways** — IN: nine technical areas (architecture, planning,
   retrieval, citations, eval, safety, cost, prompting). OUT: consumer prompt
   tips, pure private-corpus RAG, alignment surveys.
3. **Source preferences ranked with primary-source insistence** — "for every
   non-trivial claim, prefer a primary source (lab blog, paper, official docs)
   over a secondary recap." This is what kept the report anchored in Anthropic
   engineering posts, OpenAI system cards, and arXiv rather than secondhand
   summaries.
4. **Output shape pre-specified down to the section list** — ten numbered
   top-level sections in order, with a literal final "concrete checklist"
   section. Inline numbered citations + confidence labels (High/Medium/Low) +
   publication dates per reference.
5. **Time window calibrated to the product category** — "the deep-research
   product category effectively started in late 2024 (Gemini DR Dec 2024,
   OpenAI DR Feb 2025…)." Older canonical papers (ReAct 2022, Self-RAG 2023)
   explicitly allowed when they're foundational. Without this calibration the
   workers would over-cite 2022–2023 ReAct/RAG material that predates the
   actual deep-research-mode shipped systems.
6. **Quantitative anchors named** — the completeness checklist explicitly asks
   for "concrete numbers from Anthropic's multi-agent research engineering post
   (token usage vs single-agent, performance lift, parallel subagent counts)"
   and "at least one quantitative anchor" for cost/latency. This forced the
   workers to chase specific figures (90.2% lift, ~15× tokens, ~80% of
   BrowseComp variance from token use, 3–18% → 0–2.6% prompt-injection ASR)
   instead of producing a balanced-but-vague essay.
7. **Disagreements made a deliverable** — "Notes at least 2 substantive
   disagreements or open questions" and "Flags any claim where sources conflict
   or evidence is thin." Surfaced the BM25-vs-reasoning-embedding split, the
   sync-vs-async orchestration choice, and the multi-agent-vs-compute-matched
   single-agent debate explicitly rather than papering over them.

The `~3,000–5,000 words` length budget paired with `35 max sources` gave the
workers room to be specific without forcing breadth-padding.

## Claims worth spot-checking

Three load-bearing claims a reader should verify before quoting the report:

1. **Anthropic's "+90.2% lift over single-agent Opus 4," "~15× chat tokens for
   multi-agent vs ~4× single-agent," and "~80% of BrowseComp variance explained
   by token use alone"** [refs 1–3]. These three numbers carry most of the
   architecture recommendation. The Anthropic post is real and primary, but the
   specific phrasing/pairing has the shape of figures that get slightly
   mis-paraphrased between summaries — confirm the original framing (internal
   eval scope, what the 80% is regressing on, whether the multipliers include
   the CitationAgent).
2. **Refs [33] SAGE (`arxiv.org/abs/2602.05975`) and [34] AgentIR
   (`arxiv.org/abs/2603.04384v2`)**, plus the numbers attributed to them ("BM25
   beats reasoning retrievers by ~30%"; "37% → 50% → 68% on BrowseComp-Plus").
   The arXiv IDs are dated Feb/Mar 2026 — plausible given the report date but
   exactly the regime where LLMs most often hallucinate well-formed-but-fake
   IDs. The whole §4.2 BM25-vs-reasoning-retriever debate pivots on these two
   refs, so resolve both URLs and re-check the headline numbers before relying
   on the recommendation.
3. **OpenAI's "3–18% pre-mitigation → 0–2.6% post-mitigation" prompt-injection
   ASR** [refs 5–7]. This is the *only* quantitative safety anchor in the
   report and is what a security reviewer would cite. Confirm the bands, what
   attack types they cover, and what "post-mitigation" was measured against.
   The report itself flags that the canonical "lethal trifecta" framing post is
   *not* in the cited source set despite being attributed framing-wise.

Lower-priority: the "code-actions take ~30% fewer steps than JSON tool-calls"
attribution to HF Open Deep Research [24]; Gemini's HLE 46.4% / DeepSearchQA
66.1% numbers [9] (cross-version comparability with the Feb-2025 OpenAI 26.6%);
and the LiveResearchBench claim that Claude 4 Sonnet was specifically called out
as an inconsistent citation judge [35].

## Reproducing

See [`prompt.md`](./prompt.md) for the full structured `brief`. Skeleton:

```ts
deep_research({
  query:
    'What are the best practices and industry standards for LLM-based "deep research" systems — agentic systems that decompose a question, run iterative tool-augmented search, and produce cited synthesis reports?',
  brief: {
    audience: "Practitioner building/evaluating/hardening an LLM deep-research system...",
    scope_in: [/* architecture, planning, retrieval, citations, eval, safety, cost, prompting */],
    scope_out: [/* consumer prompt tips, pure RAG, alignment surveys */],
    source_prefer: [/* lab eng posts → papers → practitioner writeups → journalism */],
    source_avoid: [/* SEO listicles, Medium, marketing, undated */],
    must_address: [/* 10-item completeness checklist with quantitative anchors */],
    recency_bound: "2024-01-01",
    target_words: 4000,
    notes: "Output structure (10 numbered sections → checklist) + per-claim confidence labels (High/Medium/Low) + publication dates.",
  },
  depth: 2,
  breadth: 5,
  concurrency: 5,
  max_sources: 35,
  output_dir: "./.deep-research/llm-deep-research-best-practices",
});
```
