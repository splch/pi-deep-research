# Prompt used for this example

## Query

```
What are the best practices and industry standards for LLM-based "deep research"
systems — agentic systems that decompose a question, run iterative tool-augmented
search, and produce cited synthesis reports?
```

## Research brief

The brief below is the human-readable narrative the prompt was authored in. The structured `brief` object passed to `deep_research` (see [Tool call](#tool-call)) splits it into the typed schema fields (`audience`, `scope_in`, `scope_out`, `source_prefer`, `source_avoid`, `must_address`, `recency_bound`, `target_words`) with residual style/format guidance in `notes`.

```
AUDIENCE
Technically-literate practitioner who is building, evaluating, or hardening an LLM
deep-research system (e.g. an agent that plans sub-questions, fans out parallel
web searches/fetches, and synthesizes a cited report). Assume familiarity with
LLMs, RAG, tool use, and basic agent loops. Do not explain what an LLM is. Do
explain non-obvious tradeoffs.

SCOPE
In scope:
  - Architecture patterns for deep-research agents: planner/worker decomposition,
    lead-agent + subagent fan-out (Anthropic's pattern), single-agent ReAct loops,
    tree-of-thought / iterative deepening, memory/scratchpad design.
  - Production systems to compare and learn from: OpenAI Deep Research, Anthropic
    Claude Research / multi-agent research system, Google Gemini Deep Research,
    Perplexity Deep Research, You.com, plus notable open-source (GPT-Researcher,
    OpenDeepResearch, smolagents-based, LangGraph deep-research templates,
    Hugging Face open Deep Research).
  - Sub-question planning and decomposition: breadth vs depth, when to recurse,
    stopping criteria, budget/iteration caps.
  - Retrieval & browsing: search API choice, query reformulation, dedup,
    freshness, robots/ToS, handling paywalls and PDFs, JS-rendered pages.
  - Grounding and citations: inline numbered citations, span-level attribution,
    hallucinated-citation detection, "confidence" labels, source diversity
    requirements.
  - Evaluation: which benchmarks matter (BrowseComp, GAIA, HELM, Humanity's Last
    Exam, FRAMES, FreshQA, SimpleQA), LLM-as-judge graders, citation faithfulness
    metrics (e.g. Attributable to Identified Sources / AIS), human eval protocols,
    regression test design for agents.
  - Safety and abuse: indirect prompt injection / XPIA from fetched pages,
    exfiltration risks (lethal trifecta: private data + untrusted content +
    outbound comms), data-leak guards, refusal patterns, sandboxing browsing.
  - Cost, latency, and reliability: token budgets, parallelism, caching, model
    cascades (cheap planner + strong synthesizer), retry/timeout policy,
    partial-result handling.
  - Prompting and context engineering specific to research agents: system prompt
    structure, tool descriptions, "lost in the middle" mitigations, context
    compaction, structured intermediate artifacts.

Out of scope:
  - General consumer "prompt engineering" tips for ChatGPT.
  - Pure RAG-over-private-corpus systems with no web search and no agentic
    planning.
  - Full surveys of LLM training or alignment unrelated to research agents.

SOURCE PREFERENCES
Strongly prefer (cite these where they exist):
  - Engineering blog posts and system cards from the labs that ship these
    products: Anthropic (especially the multi-agent research system engineering
    post and Claude system cards), OpenAI (Deep Research launch + system card),
    Google DeepMind / Google blog (Gemini Deep Research), Perplexity engineering
    posts.
  - arXiv / peer-reviewed papers on agentic search, multi-agent LLMs, BrowseComp,
    GAIA, FRAMES, AIS / attribution evaluation, Self-RAG, Search-Augmented LLMs,
    ReAct, Reflexion, Tree-of-Thoughts.
  - Reputable engineering write-ups: LangChain/LangGraph blog, Hugging Face blog
    (open Deep Research), Simon Willison's notes on prompt injection and the
    "lethal trifecta", official LLM-eval framework docs (HELM, Inspect, OpenAI
    Evals).

Acceptable but secondary: well-sourced technical journalism (The Information,
Sequoia, a16z) for product comparisons; vendor docs.

Avoid: SEO listicle blogs ("Top 10 AI research tools 2024"), Medium posts with no
primary citations, marketing pages without technical detail, undated content.

For every non-trivial claim, prefer a primary source (lab blog, paper, official
docs) over a secondary recap.

GEOGRAPHY / TIME
Global. Heavily weight 2024–2026 material — the deep-research product category
effectively started in late 2024 (Gemini Deep Research Dec 2024, OpenAI Deep
Research Feb 2025, Perplexity Deep Research Feb 2025, Anthropic multi-agent
research system writeup mid-2025). Older foundational papers (ReAct 2022,
Self-RAG 2023, AIS 2021) are fine when they're the canonical reference.

OUTPUT FORMAT
Structured Markdown report with these top-level sections, in this order:
  1. Executive summary (≤8 bullets, each one practice + why).
  2. Reference architectures — diagrams-in-prose comparing single-agent vs
     orchestrator-worker vs hierarchical planner; concrete examples from named
     systems.
  3. Planning & decomposition — breadth/depth, recursion, budget caps, stopping
     rules, with empirical numbers where available (e.g. Anthropic's reported
     token-use multipliers, parallel subagent counts).
  4. Retrieval & browsing — search backends, query rewriting, source
     dedup/diversity, freshness, PDFs.
  5. Grounding & citations — citation styles, faithfulness/attribution metrics
     (AIS, citation-F1), hallucinated-citation detection, confidence labeling.
  6. Evaluation — benchmarks (BrowseComp, GAIA, FRAMES, HLE, SimpleQA, FreshQA),
     LLM-judge protocols, regression strategy for non-deterministic agents.
  7. Safety & abuse — indirect prompt injection, lethal-trifecta exfiltration,
     sandboxing, allowlists, output filtering.
  8. Cost, latency, reliability — model cascades, parallelism, caching,
     partial-result handling, observability.
  9. Open problems & disagreements — places where labs/practitioners visibly
     disagree (e.g. multi-agent vs strong-single-agent, when long context
     replaces RAG, citation UX).
  10. Concrete checklist — a numbered "if you're building one tomorrow"
      checklist of ~15 items.

Use inline numbered citations like [1], [2] tied to a numbered References
section at the end. For each cited claim, include a confidence label (High /
Medium / Low) reflecting source quality and corroboration. Note publication
dates next to each reference.

COMPLETENESS CHECKLIST (the report MUST address each)
  [ ] Names and briefly characterizes architectures of OpenAI, Anthropic, Google,
      and Perplexity deep-research systems with primary-source citations.
  [ ] Reports concrete numbers from Anthropic's multi-agent research engineering
      post (token usage vs single-agent, performance lift, parallel subagent
      counts) if available.
  [ ] Discusses orchestrator-worker vs single-agent tradeoffs explicitly.
  [ ] Lists at least 4 evaluation benchmarks relevant to deep research and what
      each measures.
  [ ] Covers citation faithfulness metrics (AIS or equivalent) and
      hallucinated-citation detection.
  [ ] Addresses indirect prompt injection from fetched web pages and the "lethal
      trifecta" exfiltration pattern.
  [ ] Covers cost/latency mitigations (parallelism, model cascade, caching) with
      at least one quantitative anchor.
  [ ] Notes at least 2 substantive disagreements or open questions in the field.
  [ ] Ends with a 15-ish-item concrete build checklist.
  [ ] Flags any claim where sources conflict or evidence is thin.

LENGTH
Aim for a thorough report (target ~3,000–5,000 words of body text). Depth over
breadth — better to cite one primary source well than three listicles.
```

## Tool call

```ts
deep_research({
  query:
    'What are the best practices and industry standards for LLM-based "deep research" systems — agentic systems that decompose a question, run iterative tool-augmented search, and produce cited synthesis reports?',
  brief: {
    audience:
      "Technically-literate practitioner who is building, evaluating, or hardening an LLM deep-research system. Assume familiarity with LLMs, RAG, tool use, and basic agent loops.",
    scope_in: [
      "architecture patterns: planner/worker decomposition, lead-agent + subagent fan-out, single-agent ReAct loops, tree-of-thought / iterative deepening, memory/scratchpad design",
      "production systems to compare: OpenAI Deep Research, Anthropic Claude Research, Google Gemini Deep Research, Perplexity, You.com, plus open-source (GPT-Researcher, OpenDeepResearch, smolagents-based, LangGraph templates, HF open Deep Research)",
      "sub-question planning: breadth vs depth, when to recurse, stopping criteria, budget/iteration caps",
      "retrieval & browsing: search-API choice, query reformulation, dedup, freshness, robots/ToS, paywalls and PDFs, JS-rendered pages",
      "grounding & citations: inline numbered citations, span-level attribution, hallucinated-citation detection, confidence labels, source-diversity requirements",
      "evaluation: BrowseComp, GAIA, HELM, HLE, FRAMES, FreshQA, SimpleQA, LLM-as-judge, AIS / citation-faithfulness metrics, regression tests for non-deterministic agents",
      "safety & abuse: indirect prompt injection / XPIA, lethal-trifecta exfiltration, sandboxed browsing, allowlists, refusal patterns",
      "cost / latency / reliability: token budgets, parallelism, caching, model cascades, retry/timeout, partial-result handling",
      "prompt and context engineering specific to research agents: system-prompt structure, tool descriptions, lost-in-the-middle mitigations, compaction, structured intermediates",
    ],
    scope_out: [
      "general consumer 'prompt engineering' tips for ChatGPT",
      "pure RAG-over-private-corpus systems with no web search and no agentic planning",
      "surveys of LLM training or alignment unrelated to research agents",
    ],
    source_prefer: [
      "engineering blog posts and system cards from labs that ship these products (Anthropic multi-agent research engineering post and system cards; OpenAI Deep Research launch + system card; Google DeepMind Gemini DR; Perplexity engineering)",
      "arXiv / peer-reviewed papers on agentic search, multi-agent LLMs, BrowseComp, GAIA, FRAMES, AIS / attribution evaluation, Self-RAG, Search-Augmented LLMs, ReAct, Reflexion, Tree-of-Thoughts",
      "reputable engineering writeups: LangChain/LangGraph blog, Hugging Face open Deep Research blog, Simon Willison on prompt injection and the lethal trifecta, official LLM-eval framework docs (HELM, Inspect, OpenAI Evals)",
      "acceptable but secondary: well-sourced technical journalism (The Information, Sequoia, a16z) and vendor docs",
    ],
    source_avoid: [
      "SEO listicle blogs ('Top 10 AI research tools 2024')",
      "Medium posts with no primary citations",
      "marketing pages without technical detail",
      "undated content",
    ],
    must_address: [
      "Names and briefly characterizes architectures of OpenAI, Anthropic, Google, and Perplexity deep-research systems with primary-source citations",
      "Reports concrete numbers from Anthropic's multi-agent research engineering post (token usage vs single-agent, performance lift, parallel subagent counts) where available",
      "Discusses orchestrator-worker vs single-agent trade-offs explicitly",
      "Lists at least 4 evaluation benchmarks relevant to deep research and what each measures",
      "Covers citation-faithfulness metrics (AIS or equivalent) and hallucinated-citation detection",
      "Addresses indirect prompt injection from fetched web pages and the 'lethal trifecta' exfiltration pattern",
      "Covers cost/latency mitigations (parallelism, model cascade, caching) with at least one quantitative anchor",
      "Notes at least 2 substantive disagreements or open questions in the field",
      "Ends with a 15-ish-item concrete build checklist",
      "Flags any claim where sources conflict or evidence is thin",
    ],
    recency_bound: "2024-01-01",
    target_words: 4000,
    notes: [
      "Time scope: heavily weight 2024–2026 material (Gemini DR Dec 2024, OpenAI DR Feb 2025, Perplexity DR Feb 2025, Anthropic multi-agent writeup mid-2025). Older foundational papers (ReAct 2022, Self-RAG 2023, AIS 2021) are fine when canonical.",
      "Output structure (in this order): (1) Executive summary (≤8 bullets, each one practice + why); (2) Reference architectures — diagrams-in-prose comparing single-agent vs orchestrator-worker vs hierarchical planner with concrete examples from named systems; (3) Planning & decomposition — breadth/depth, recursion, budget caps, stopping rules with empirical numbers; (4) Retrieval & browsing; (5) Grounding & citations — styles, AIS / citation-F1, hallucinated-citation detection, confidence labels; (6) Evaluation — benchmarks, judge protocols, regression strategy; (7) Safety & abuse; (8) Cost / latency / reliability — cascades, parallelism, caching, partial results, observability; (9) Open problems & disagreements; (10) Concrete checklist (~15 items, 'if you're building one tomorrow').",
      "Per-claim: include a confidence label (High / Medium / Low) reflecting source quality and corroboration; note publication dates next to each reference.",
      "Style: depth over breadth — better to cite one primary source well than three listicles.",
    ].join("\n\n"),
  },
  depth: 2,
  breadth: 5,
  concurrency: 5,
  max_sources: 35,
  output_dir: "./.deep-research/llm-deep-research-best-practices",
});
```
