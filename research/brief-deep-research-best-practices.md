# Building AI Deep-Research Workflows: Practices and Standards (mid-2026)

Deep-research report for a developer designing a deep-research workflow/extension for a coding agent (Pi at pi.dev). Companion to [brief-pi-extension-development.md](./brief-pi-extension-development.md).

**Provenance**: researched 2026-07-17. Pipeline: 22 sources fetched, 105 claims extracted, top 25 put through 3-vote adversarial verification - 21 confirmed, 4 refuted, 0 left unverified. Publication dates are stamped per claim because the field moves fast (sources span Sept 2023 to mid-2026).

---

## TL;DR

Deep-research systems share a canonical pipeline - scope/clarify, plan and decompose, iterative multi-hop search-read-reason, compress, verify, synthesize with citations - but diverge sharply on orchestration. The two proven poles are OpenAI's single agent trained end-to-end with RL (not reproducible without training access) and Anthropic's orchestrator-worker multi-agent design (buildable today, but ~15x token cost, so reserve it for high-value parallelizable work). The open-source blueprints (LangChain Open Deep Research, GPT Researcher, Stanford STORM) converge on the same template: scope to a brief, fan out research sub-questions to parallel workers that each return a *compressed, cited* synthesis, then write the final report in a single one-shot call. Ground claims with factored verification (Chain-of-Verification style), not frequency-of-repetition. Evaluate with LLM-as-judge against expert golden reports plus a closed-answer agentic benchmark. Prompt-injection defense, citation-faithfulness checking, and checkpointing are real gaps in the primary literature.

## 1. The two reference architectures

Confidence: **high** (3-0 on all constituent claims).

- **OpenAI Deep Research** (product, Feb 2, 2025) is a **single agent**: a fine-tuned o3 trained end-to-end with reinforcement learning on hard browsing/reasoning tasks. The builders (Josh Tobin, Isa Fulford, Sequoia "Training Data" podcast) explicitly rejected hand-wiring a graph of LLM-node operations - planning, browsing, and backtracking are an emergent learned policy.
- **Anthropic's Research system** (engineering blog, June 13, 2025) is **multi-agent orchestrator-worker**: a lead agent (Claude Opus 4) decomposes the question and delegates to parallel subagents (Claude Sonnet 4). It beat Anthropic's single-agent baseline by **90.2%** on their internal research eval. Anthropic scopes the recommendation to open-ended, breadth-first, parallelizable research - it is not a universal claim.
- An independent survey ([arXiv:2506.18096](https://arxiv.org/pdf/2506.18096), June 2025) corroborates both characterizations.

Two caveats carried from verification: the 90.2% is Anthropic's own non-reproducible internal eval (the *architectural* characterization is what is multi-source solid), and "OpenAI Deep Research" is now ambiguous - the RL-trained ChatGPT product (single-agent) vs the separate Deep Research API / Agents SDK reference app (which *you* assemble as multi-agent). Claims here refer to the product.

**Design takeaway**: single-agent-RL is not reproducible without training access, so the practical build for an extension is an orchestrator-worker you assemble yourself, reserved for genuinely parallelizable research.

## 2. When multi-agent pays (cost/latency economics)

Confidence: **medium** - every number is Anthropic self-report (June 2025); the qualitative direction is robust and widely corroborated.

- Parallelism is the primary latency lever: the lead agent spawns **3-5 subagents in parallel**, each calling **3+ tools in parallel**, cutting research time by up to ~90% on complex queries.
- Multi-agent burns **~15x more tokens** than ordinary chat.
- On BrowseComp, **token usage alone explains ~80% of performance variance** (~95% adding tool-call count and model choice) - much of the quality gain is "spend more tokens," not architectural magic.

**Design takeaway**: multi-agent is economically justified only for high-value tasks whose payoff scales with token spend. Cheap/frequent or tightly-coupled tasks do not justify the multiplier. Treat exact percentages as directional, not settled.

## 3. Scoping and clarification (stage 1)

Confidence: **high**. The [arXiv:2506.18096](https://arxiv.org/pdf/2506.18096) taxonomy names three strategies:

1. **Planning-Only** - no clarification, plan straight from the prompt (most agents: Grok, Manus, H2O).
2. **Intent-to-Planning** - ask targeted clarifying questions *before* planning (OpenAI Deep Research; confirmed by builder interviews and OpenAI's Help Center).
3. **Unified Intent-Planning** - generate a preliminary plan, then have the user confirm/revise it (Gemini Deep Research).

**Design takeaway**: because unattended runs are long and expensive (5-30 minutes), front-load intent clarification (strategy 2 or 3). A Gemini-style plan-confirm handshake gives the user steering without a full Q&A round-trip.

## 4. The retrieval core: iterative search-read-reason, seeded with perspectives

Confidence: **high** (3-0).

- The core loop is **iterative and multi-hop**, not a fixed pre-planned query set: reason about the request, search, fetch and read, assess, then decide the *next* query from what was just learned, backtracking on live web content. In OpenAI DR this adaptive policy is emergent from RL; in open-source pipelines it is prompted.
- **STORM** (Stanford OVAL, NAACL 2024) adds a complementary decomposition technique: discover multiple *perspectives* by surveying existing articles on similar topics, then use those perspectives to steer question-asking instead of generic questions.

**Design takeaway**: condition each query on accumulated findings rather than fixing queries up front; seeding distinct perspectives/personas is a cheap prompt-level way to force decomposition breadth and avoid single-viewpoint tunnel vision.

## 5. Copyable open-source blueprints (and where they converge)

Confidence: **high** (3-0, each verified against its own primary source).

| System | Architecture | Pipeline |
|---|---|---|
| [LangChain Open Deep Research](https://www.langchain.com/blog/open-deep-research) (blog July 16, 2025) | Supervisor + parallel sub-agents (LangGraph) | Scope (clarify, write research brief) -> Research (supervisor delegates sub-questions) -> Write (one-shot report) |
| [GPT Researcher](https://github.com/assafelovic/gpt-researcher) | Planner + parallel execution agents (asyncio.gather) | Planner generates sub-questions; execution agents gather per question |
| [STORM](https://github.com/stanford-oval/storm) (NAACL 2024) | Two-stage | Pre-writing (research, collect references, build outline) -> Writing (outline + references to cited article) |

Shared template: **scope to a brief, fan out research sub-questions in parallel, consolidate**.

Correction from verification: the circulating claim that LangChain demoted its multi-agent supervisor to legacy was **refuted 0-3** - the supervisor design is the *current* one. LangChain Open Deep Research is the closest reference implementation for a Pi-style extension (LangGraph-native, configurable, provider-agnostic).

## 6. Context-window management and the parallelism boundary

Confidence: **high** (3-0, verbatim from the LangChain blog, July 16, 2025; consistent with Anthropic's pattern).

- **Compress at every boundary**: chat history is compressed into a research brief before research begins; each sub-agent prunes raw findings and makes a final LLM call to write a *cleaned, cited answer* to its sub-question before returning to the supervisor. Workers return compressed syntheses, never raw scraped pages.
- **Confine parallelism to the research phase; keep writing single-agent.** The final report is written in one one-shot call because an earlier parallel-section-writers design produced disjoint, poorly-coordinated reports.

This is also the field's partial answer to "when single-agent beats multi-agent": synthesis/writing stays single-agent on purpose.

## 7. Model tiering per stage

Confidence: **medium** (pattern solid; exact model IDs churn).

Open Deep Research exposes four independently-configurable LLM slots: Summarization (cheap, e.g. gpt-4.1-mini at the Aug 2025 commit) vs Research, Compression, and Final Report (stronger, e.g. gpt-4.1), each swappable across providers. The README already shows a newer GPT-5 config scoring higher.

**Design takeaway**: take the pattern, not the model names - cheap model for high-volume mechanical steps (summarizing/pruning fetched pages), strong model for reasoning and synthesis, behind a provider-agnostic init API. (Pi's multi-provider design fits this naturally.)

## 8. Verification and grounding: the weak-to-rigorous spectrum

Confidence: **high** (3-0).

- **Weak end - breadth heuristic** (GPT Researcher): scrape 20+ sources per query and keep the most frequently repeated information, betting they cannot all be wrong. Cheap, but it is not fact-checking: it launders consensus errors and does nothing against a widely-repeated falsehood. (Its optional Reviewer/Reviser loop is editorial style-checking, off by default - not claim verification.)
- **Rigorous end - Chain-of-Verification** (CoVe, [arXiv:2309.11495](https://arxiv.org/abs/2309.11495), Meta AI, Sept 2023): (i) draft a response, (ii) plan verification questions to fact-check the draft, (iii) answer them **independently of the draft**, (iv) regenerate a verified final response. The load-bearing element is *factored* verification - answering each check in a fresh context so the checker cannot inherit the draft's hallucinations. The paper's factored-vs-joint ablation shows factoring wins for exactly this reason.

**Design takeaway**: do not make frequency-of-repetition your grounding story. Add a factored verification pass that re-checks each load-bearing claim against sources in a fresh context - the adversarial/self-critique loop the field recommends.

## 9. Evaluation

Confidence: **high** (3-0), with point-in-time numbers flagged.

Two standardized components:

1. **LLM-as-judge against expert golden sets** for open-ended report quality. [Deep Research Bench](https://arxiv.org/abs/2506.11763) (June 2025): 100 PhD-level tasks across 22 fields, scored by an LLM judge (Gemini) against expert-authored reference reports via a RACE rubric. Open Deep Research reported #6 / 0.4344 (already drifting - the same README shows a newer config at 0.4943). Beware a name collision with FutureSearch's different 89-task "Deep Research Bench."
2. **Closed-answer agentic-browsing benchmarks** for retrieval/answer accuracy. GAIA: OpenAI DR ~67% one-shot (47.6% on hardest level 3); Hugging Face's open reproduction 55.15%; prior open SoTA (Magentic-One) ~46% (all Feb 2025 figures, historical reference). BrowseComp (OpenAI, 1,266 problems) is the other common set.

Refuted - do not cite: the "Deep Research hit 26.6% on Humanity's Last Exam" figure failed verification (1-2).

**Design takeaway**: for your own eval, pair a RACE-style LLM-judge rubric against a small golden set with a closed-answer agentic set (GAIA or BrowseComp style) so you measure both report quality and retrieval accuracy.

## Known gaps in the primary literature (no surviving claims)

The research explicitly could not source verified practices for several sub-topics - absence of evidence that these are covered, not evidence they are unimportant:

- **Indirect prompt-injection defense** for fetched web content - the top operational hazard for a browsing agent that can act (untrusted content + tool access + exfiltration channel, Simon Willison's "lethal trifecta," June 2025). No verified primary source specified a production defense mechanism.
- **Citation faithfulness / anti-laundering** - detecting a real, resolvable citation attached to a sentence it does not support. No dedicated claim-to-source entailment-checking pattern survived verification (one promising direction that surfaced in search: AST-parsing inline citations out of Markdown reports and scoring each along source-attribution dimensions).
- **Checkpointing/resumability** of long (5-30 min) runs after failure or rate-limiting.
- **Prompt/response caching strategy** and low-level fetch/extraction/claim-extraction mechanics.

For a Pi extension these gaps are design work you must do yourself; treat fetched web content as untrusted input to subagents that lack write/exec tools, and persist intermediate stage outputs so runs resume.

## Refuted claims (excluded)

1. Deep Research's 26.6% on Humanity's Last Exam (1-2) - do not cite the figure.
2. "Single-agent enables end-to-end RL while multi-agent inherently blocks it" as *the* core tradeoff (0-3) - not supported by the cited survey.
3. "LangChain Open Deep Research demoted its multi-agent supervisor to legacy" (0-3) - the supervisor design is current.
4. "Code-based actions vs JSON tool-calling is the decisive architecture choice (55.15% vs 33% on GAIA)" (1-2) - the comparison did not hold up as stated.

## Open questions

1. Concrete production-grade prompt-injection defenses used by deep-research systems.
2. How citation laundering is detected/prevented at scale (claim-to-source entailment checking).
3. Standard checkpoint/resume patterns for long research runs.
4. Where exactly the single-vs-multi-agent crossover sits for *coding-agent* workloads - multi-agent wins for breadth-first research, tightly-coupled coding tasks favor simpler supervision, but no benchmark isolates the coding-agent regime.

## Key sources (dated)

- [Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) - June 13, 2025
- [OpenAI: Introducing Deep Research](https://openai.com/index/introducing-deep-research/) - Feb 2, 2025 (site returned 403 during fetch; claims verified via multiple independent verbatim reproductions and the Sequoia podcast)
- [Sequoia Training Data podcast with the Deep Research builders](https://sequoiacap.com/podcast/training-data-deep-research/) - Feb 2025
- [LangChain: Open Deep Research](https://www.langchain.com/blog/open-deep-research) - July 16, 2025; [repo](https://github.com/langchain-ai/open_deep_research)
- [GPT Researcher](https://github.com/assafelovic/gpt-researcher); [STORM](https://github.com/stanford-oval/storm) - NAACL 2024
- [Chain-of-Verification, arXiv:2309.11495](https://arxiv.org/abs/2309.11495) - Sept 2023
- Surveys/benchmarks: [arXiv:2506.18096](https://arxiv.org/pdf/2506.18096) (June 2025), [Deep Research Bench, arXiv:2506.11763](https://arxiv.org/abs/2506.11763) (June 2025), [OpenAI BrowseComp](https://openai.com/index/browsecomp/), [HF open-deep-research blog](https://huggingface.co/blog/open-deep-research) (Feb 2025)
- Safety context: [Simon Willison, the lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) (June 2025), Unit 42 on AI-agent prompt injection
