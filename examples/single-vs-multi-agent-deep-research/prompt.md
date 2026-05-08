# Prompt used for this example

## Query

```
What are the trade-offs between single-agent and multi-agent LLM deep-research
architectures, and which architecture wins under which conditions?
```

## Research brief

The brief below is reproduced as the human-readable narrative the prompt was authored in. The structured `brief` object passed to `deep_research` (see [Tool call](#tool-call)) splits it into the typed schema fields (`audience`, `scope_in`, `scope_out`, `source_prefer`, `source_avoid`, `must_address`, `recency_bound`, `target_words`) and stashes the residual style guidance in `notes`.

```
AUDIENCE
Technically sophisticated readers: ML engineers, applied researchers, and tech leads
who already understand LLMs, tool use, RAG, and agent loops. Skip definitions of
"what an LLM is" or "what an agent is" beyond a one-line framing. Assume familiarity
with terms like ReAct, planner-executor, orchestrator-worker, context window, token
budget, tool calling.

SCOPE — INCLUDE
- LLM "deep research" systems specifically: systems that autonomously plan, search
  the web/corpora, fetch & read sources, iterate, and synthesize a long-form answer
  with citations. Concrete reference points to cover:
  * Anthropic's multi-agent Research system (Claude orchestrator + parallel subagent
    researchers; their public engineering write-up on building it)
  * OpenAI Deep Research (o3-based) and ChatGPT's deep research feature
  * Google Gemini Deep Research
  * Perplexity Pro Search / "Deep Research" mode
  * Open-source: GPT Researcher, open_deep_research / LangGraph deep-research
    templates, CrewAI research crews, AutoGen / Magentic-One research patterns,
    Stanford STORM, "smolagents" deep research
- Architectural axes to compare for SINGLE-agent (one ReAct/planner loop, one
  context) vs MULTI-agent (orchestrator + parallel/sequential subagents, separate
  contexts):
  * Answer quality / breadth / recall on research-style benchmarks
  * Token cost and $-per-query (Anthropic publicly noted ~15× tokens for
    multi-agent; surface comparable numbers)
  * Wall-clock latency and parallelism gains
  * Context-window pressure & "context rot" / lost-in-the-middle behavior
  * Reliability, error compounding, and coordination failure modes (subagent drift,
    redundant work, conflicting findings, prompt-injection blast radius)
  * Observability, debuggability, and evaluation difficulty
  * Citation faithfulness & hallucination rates
  * Engineering complexity (prompts, memory, handoff protocols, retries)
- Decision guidance: which architecture wins for which workload profile (breadth-
  first vs depth-first queries, cost-sensitive vs quality-sensitive, latency-
  sensitive interactive vs batch, narrow-domain vs open-web, regulated/auditable vs
  exploratory).
- Hybrid patterns and middle grounds (single agent with sub-tools, plan-and-execute,
  "researcher + writer" two-agent split, verifier/critic loops).

SCOPE — EXCLUDE
- General "agentic AI" hype pieces with no concrete deep-research framing.
- Robotics / embodied multi-agent systems.
- Pure RAG architecture comparisons that don't involve autonomous iterative
  research.
- Marketing copy without technical claims.

SOURCE PREFERENCES (in priority order)
1. First-party engineering posts from labs/vendors: Anthropic engineering blog,
   OpenAI, Google DeepMind, Perplexity. Especially Anthropic's "How we built our
   multi-agent research system" post.
2. Peer-reviewed papers and well-cited arXiv preprints (STORM, AutoGen,
   Magentic-One, multi-agent debate, planner-executor papers, evals like GAIA,
   BrowseComp, HLE, FRAMES).
3. Reputable practitioner write-ups: LangChain blog, LlamaIndex blog, Hamel Husain,
   Eugene Yan, Simon Willison, Chip Huyen, Sebastian Raschka, Jason Liu.
4. Benchmark leaderboards / system cards (GAIA, BrowseComp, Humanity's Last Exam)
   where deep-research systems are scored.
5. Avoid: low-quality SEO Medium posts, content-farm "Top 10 agent frameworks"
   listicles, Twitter threads without substantive content.

OUTPUT FORMAT
Markdown report, ~1,500–2,500 words, with this structure:
1. TL;DR (5–8 bullets, each with a confidence label)
2. Definitions & framing (one short section: what counts as single-agent vs
   multi-agent here)
3. Trade-off matrix — a literal markdown table with rows = axes (quality, cost,
   latency, reliability, observability, complexity, security/injection surface)
   and columns = single-agent / multi-agent / notes
4. Evidence by axis — one subsection per axis, citing concrete numbers/benchmarks
   where available (e.g., Anthropic's reported quality lift and ~15× token cost;
   GAIA / BrowseComp scores for OpenAI Deep Research, Gemini Deep Research, etc.)
5. "Which wins where" — explicit recommendations by workload profile
6. Open questions / where the evidence is thin
7. References (numbered, matching inline citations)

Use inline numbered citations like [1], [2] tied to a numbered References list.
Include a confidence label (high/medium/low) on each major claim in the TL;DR and
the "which wins where" section.

COMPLETENESS CHECKLIST — the report must explicitly address:
- [ ] Anthropic's published quality vs cost numbers for their multi-agent Research
      system (and the ~15× token figure or whatever the current public number is).
- [ ] Public benchmark scores (GAIA, BrowseComp, Humanity's Last Exam, FRAMES) for
      at least: OpenAI Deep Research, Gemini Deep Research, and one open-source
      baseline (e.g., GPT Researcher or open_deep_research).
- [ ] At least one concrete failure mode documented for multi-agent (coordination/
      drift/redundancy) and at least one for single-agent (context rot / lost-in-
      the-middle on long research traces).
- [ ] Latency comparison: where parallelism actually pays off vs where serial
      single-agent is faster end-to-end.
- [ ] Engineering/observability cost (debuggability, eval, prompt-injection blast
      radius across subagents).
- [ ] Hybrid patterns (e.g., single orchestrator with parallel tool calls but no
      full subagents; researcher+writer split; critic/verifier loops).
- [ ] Explicit "which wins where" recommendations for: (a) interactive Q&A under
      30s, (b) deep batch research reports, (c) cost-constrained production use,
      (d) regulated/auditable use cases, (e) open-source self-hosted setups.
- [ ] Note where evidence is publicly thin or vendor-claimed-only, and flag it.

TIME / GEOGRAPHY SCOPE
- Prioritize material from 2024–2026. Older multi-agent papers (AutoGen 2023,
  debate papers) are fine as foundational citations but the head-to-head
  comparisons should lean on 2024+ deep-research-era systems.
- English-language sources are sufficient.

STYLE
- No fluff, no "in today's fast-paced AI landscape" intros.
- Lead each section with the answer, then evidence.
- Where vendors disagree or evidence is thin, say so explicitly rather than
  papering over it.
```

## Tool call

```ts
deep_research({
  query:
    "What are the trade-offs between single-agent and multi-agent LLM deep-research architectures, and which architecture wins under which conditions?",
  brief: {
    audience:
      "ML engineers, applied researchers, and tech leads who already understand LLMs, tool use, RAG, and agent loops.",
    scope_in: [
      "Anthropic's multi-agent Research system (orchestrator + parallel subagent researchers, public engineering writeup)",
      "OpenAI Deep Research (o3-based) and ChatGPT's deep-research feature",
      "Google Gemini Deep Research; Perplexity Pro Search / 'Deep Research' mode",
      "Open-source: GPT Researcher, open_deep_research / LangGraph templates, CrewAI, AutoGen / Magentic-One, Stanford STORM, smolagents",
      "Architectural axes: quality/breadth/recall, $-per-query, latency, context-window pressure, reliability, observability, citation faithfulness, engineering complexity, prompt-injection blast radius",
      "Decision guidance by workload profile and hybrid patterns (single agent + sub-tools, plan-and-execute, researcher+writer split, verifier loops)",
    ],
    scope_out: [
      "general 'agentic AI' hype with no concrete deep-research framing",
      "robotics / embodied multi-agent systems",
      "pure RAG architecture comparisons without autonomous iterative research",
      "marketing copy without technical claims",
    ],
    source_prefer: [
      "first-party engineering posts (Anthropic, OpenAI, Google DeepMind, Perplexity)",
      "peer-reviewed papers / well-cited arXiv preprints (STORM, AutoGen, Magentic-One, planner-executor, GAIA, BrowseComp, HLE, FRAMES)",
      "named practitioner writeups (LangChain, LlamaIndex, Hamel Husain, Eugene Yan, Simon Willison, Chip Huyen, Sebastian Raschka, Jason Liu)",
      "benchmark leaderboards and system cards (GAIA, BrowseComp, Humanity's Last Exam)",
    ],
    source_avoid: [
      "low-quality SEO Medium posts",
      "content-farm 'Top 10 agent frameworks' listicles",
      "Twitter threads without substantive content",
    ],
    must_address: [
      "Anthropic's published quality-vs-cost numbers for the multi-agent Research system (≈15× token figure or current public number)",
      "Public benchmark scores (GAIA, BrowseComp, HLE, FRAMES) for at least OpenAI Deep Research, Gemini Deep Research, and one open-source baseline",
      "At least one concrete failure mode for multi-agent (coordination/drift/redundancy) and one for single-agent (context rot / lost-in-the-middle on long traces)",
      "Latency comparison: where parallelism actually pays off vs where serial single-agent is faster end-to-end",
      "Engineering/observability cost (debuggability, eval, prompt-injection blast radius across subagents)",
      "Hybrid patterns (single orchestrator with parallel tool calls but no full subagents; researcher+writer split; critic/verifier loops)",
      "Explicit 'which wins where' for: (a) interactive Q&A under 30s, (b) deep batch research reports, (c) cost-constrained production, (d) regulated/auditable use cases, (e) open-source self-hosted setups",
      "Note where evidence is publicly thin or vendor-claimed-only and flag it",
    ],
    recency_bound: "2024-01-01",
    target_words: 2200,
    notes: [
      "Output: Markdown, ~1,500–2,500 words, in this order — (1) TL;DR (5–8 bullets, each with a confidence label), (2) Definitions & framing, (3) literal trade-off matrix (rows = axes, cols = single-agent / multi-agent / notes), (4) Evidence by axis (cite concrete numbers/benchmarks), (5) 'Which wins where' (explicit recommendations by workload profile), (6) Open questions / where evidence is thin, (7) numbered References matching inline [N] cites.",
      "Style: lead each section with the answer, then evidence. No 'in today's fast-paced AI landscape' intros. Where vendors disagree, say so explicitly. English-language sources are sufficient.",
    ].join("\n\n"),
  },
  depth: 2,
  breadth: 5,
  concurrency: 5,
  max_sources: 30,
});
```
