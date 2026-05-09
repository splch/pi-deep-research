# Single-Agent vs Multi-Agent Deep Research — Trade-offs and "Wins Where"

A comparative analysis of single-agent vs multi-agent (orchestrator-worker,
planner-executor, debate, swarm) architectures for LLM-based deep research,
anchored by the June 2025 Anthropic / Cognition split and the controlled
matched-compute follow-ups in 2026.

## Original question

> What are the trade-offs between single-agent and multi-agent LLM
> deep-research architectures, and which wins where?

## Scope interpretation (caller-side, before the call)

- **Scope.** Compare single-agent (one ReAct/CodeAct loop) vs multi-agent (orchestrator-worker, planner-executor, debate, swarm) architectures *specifically for deep-research workloads* — long-horizon, multi-source, citation-bearing report generation. Cover token cost, latency, reliability, error compounding, eval results, and which patterns win for which task shapes.
- **Audience.** Engineers and applied researchers building or choosing a deep-research system. Assumes familiarity with LLM agents and tool use.
- **Source preferences.** Primary engineering writeups (Anthropic, OpenAI, Google, Perplexity, You.com, LangChain/LangGraph), arXiv evals (GAIA, BrowseComp, HLE, DeepResearch Bench), framework docs. Avoid SEO listicles, marketing pages without methodology, LinkedIn/Medium opinion posts not backed by evals.
- **Output.** Comparative analysis with an explicit "wins where" verdict and a trade-off table. Distinguish *multi-agent* (multiple LLM loops with handoffs) from *parallel tool calls within one agent* (still single-agent).
- **Preset.** None — technical/engineering topic, not legal/medical/academic/financial/regulatory.

## Call parameters

```jsonc
{
  "query": "What are the trade-offs between single-agent and multi-agent LLM deep-research architectures, and which wins where?",
  "depth": 2,
  "breadth": 5,
  "max_sources": 30,
  "safe_check": true,
  "brief": {
    "audience": "Engineers and applied researchers choosing or building an LLM deep-research system. Assume familiarity with agents, tool use, RAG, and long-context models.",
    "scope_in": [
      "Single-agent (one ReAct/CodeAct loop) vs multi-agent (orchestrator-worker, planner-executor, debate, swarm) for deep-research / long-horizon report generation",
      "Concrete production systems: Anthropic Research, OpenAI Deep Research, Google Gemini Deep Research, Perplexity Pro Search / Deep Research, You.com, GPT Researcher, open-source equivalents",
      "Token cost and parallel-fanout economics; latency; reliability; error compounding across hops",
      "Context engineering: shared scratchpad vs isolated subagent contexts, handoff loss, lost-in-the-middle",
      "Evaluation evidence: GAIA, BrowseComp, HLE, DeepResearch Bench, FRAMES, and any published head-to-head ablations",
      "When orchestration helps (parallelizable breadth) vs when it hurts (tightly coupled reasoning, dependent subtasks)",
      "Failure modes: prompt injection / lethal trifecta amplified by sub-agents, hallucinated handoffs, planner drift",
      "Practical guidance: which architecture wins for which task shape, team size, and budget"
    ],
    "scope_out": [
      "General multi-agent reinforcement learning theory unrelated to LLM tool-use systems",
      "Pure chatbot or coding-agent comparisons (Devin, Cursor, Claude Code) unless they directly inform deep-research patterns",
      "Vendor marketing pages without methodology",
      "Agent frameworks compared purely on DX/ergonomics with no architectural implication"
    ],
    "source_prefer": [
      "Anthropic engineering blog (especially the multi-agent research system writeup)",
      "OpenAI / DeepMind / Google Research engineering posts on Deep Research products",
      "arXiv papers with evals (GAIA, BrowseComp, HLE, DeepResearch Bench, FRAMES, AgentBench)",
      "LangChain / LangGraph / LlamaIndex / DSPy technical writeups with measured numbers",
      "Independent benchmark leaderboards and reproducible evals",
      "Postmortems and lessons-learned from teams that shipped deep-research in production"
    ],
    "source_avoid": [
      "Generic 'top 10 agent frameworks' SEO listicles",
      "Marketing pages with no methodology or numbers",
      "LinkedIn / Medium opinion posts not backed by evals or production data",
      "Speculative AGI / autonomous-agent hype without measurement"
    ],
    "must_address": [
      "Anthropic's reported ~15x token cost for multi-agent research and when that pays off",
      "Cognition AI's 'Don't Build Multi-Agents' argument and the specific failure modes it cites",
      "Where parallel sub-agents demonstrably beat a single agent (breadth-first, embarrassingly parallel sub-questions) and where they lose (tightly coupled reasoning, code/refactor-style work)",
      "Empirical results on at least one shared benchmark (GAIA or BrowseComp or HLE) comparing the two patterns",
      "Concrete decision rules: task-shape, breadth/depth, citation/verification needs, latency budget, $ budget",
      "Reliability: error compounding, context fragmentation, handoff loss; mitigations (verifier passes, citation audit, structured handoffs)",
      "Security: prompt injection and lethal-trifecta exposure when sub-agents fetch untrusted web content"
    ],
    "recency_bound": "2024-01-01",
    "target_words": 2200,
    "notes": "Output a comparative analysis with an explicit 'wins where' verdict and a trade-off table. Quantify wherever a primary source provides numbers (token multiples, eval deltas, latency). When sources disagree (e.g., Anthropic pro-multi-agent vs Cognition anti-multi-agent), present both positions and the conditions under which each holds. Distinguish 'multi-agent' the architecture (multiple LLM loops with handoffs) from 'parallel tool calls within one agent' (still single-agent). Prefer 2024-2025 sources; older work only as foundational context."
  }
}
```

## Run summary

| | |
|---|---|
| **Cost** | $8.59 |
| **Wall clock** | 1250.0s (~21 min) |
| **Workers** | 7/7 succeeded (5 at level 1 + 2 at level 2 after `breadth_decay`) |
| **Sources** | 30 unique cited |
| **Cost cap hit** | No (no `max_total_usd` set — enterprise account) |
| **Dead links** | 1 (`💀` count, cited 2× as `[24]`) |
| **URL verification** | 29/30 sources returned HTTP 200 |
| **Effort tier** | complex |
| **Turns** | 47 |
| **Tool calls** | 78 |

## Key findings (verbatim from the report TL;DR, condensed)

1. **Anthropic's multi-agent system beats single-agent Opus 4 by 90.2% on its internal eval — but at ~15× tokens vs ~4× for single-agent**, and "only pays off when task value justifies the budget." Crucially, in Anthropic's own BrowseComp data, **token usage alone explains ~80% of cross-system variance and tokens + tool-calls + model choice explain ~95%** — leaving very little residual variance for "architecture per se."
2. **Cognition's "Don't Build Multi-Agents" (June 12, 2025)** argues parallel writer subagents fragment context and produce conflicting implicit decisions (the canonical Flappy-Bird-with-Mario-background failure). Their April 2026 follow-up softened to: **"writes stay single-threaded; additional agents contribute *intelligence* (verification, escalation), not actions."**
3. **At matched thinking-token budgets, single-agent matches or beats five MAS variants** (Sequential, Subtask-parallel, Parallel-roles, Debate, Ensemble) on FRAMES and MuSiQue 4-hop across Qwen3-30B, DeepSeek-R1-70B, and Gemini 2.5, grounded in a Data Processing Inequality argument (Tran & Kiela, Stanford / Contextual AI, April 2026).
4. **Orchestrator-worker products lead DeepResearch Bench** — Gemini-2.5 Deep Research 48.88 RACE / OpenAI Deep Research 46.98 / Perplexity Deep Research 42.25, vs single-agent LLM-with-search at 35–41. But **OpenAI Deep Research is itself a single RL-trained o3 agent** (HLE 26.6%, GAIA 67.36% pass@1), so the leader/runner-up gap is just ~2 RACE points.
5. **The MAST study (Cemri et al., NeurIPS 2025)** annotated 1,600+ traces across 7 MAS frameworks and codified 14 failure modes; reported MAS benchmark gains are "often minimal."
6. **Multi-agent fan-out structurally amplifies prompt-injection exposure.** Anthropic's own March 2026 follow-up reports a **3.7× amplification of "unintended solutions"** (0.87% vs 0.24%) in multi-agent vs single-agent on BrowseComp, attributed to higher token use and parallel searcher fan-out.
7. **Verdict:** Multi-agent wins for breadth-first, read-heavy, citation-heavy research where parallel context windows scour independent leads; single-agent wins for tightly coupled write-heavy work, sequential multi-hop reasoning at matched compute, and any task where one agent must hold full coherent state.

The report's trade-off table (cost, latency, best-fit, reliability, citations, security, scaling-with-capability, coding) and decision-rules section are the most useful single artifacts. Full report including `## Fact-check audit` and `## Citation audit` is in [`report.md`](./report.md).

## Claims worth spot-checking before quoting

1. **Tran & Kiela (Stanford / Contextual AI), arXiv:2604.02460, "Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets" [13].** Load-bearing for the matched-compute thesis. The report's per-cell numbers on FRAMES @ 5K (SAS 0.700, Sequential 0.680, Debate 0.700, Ensemble 0.710, Parallel-roles 0.700) and MuSiQue 4-hop @ 5K (SAS 0.419) are flagged `❓ unable to verify in budget` in the audit — Table 1 was referenced but not extracted from snippets. The arXiv ID prefix `2604` (April 2026) is also unusual; verify the paper resolves before quoting any per-cell numbers.
2. **The "tokens explain ~80% / tokens+tools+model explain ~95% of variance" claim [1][2].** This is the basis for the report's "compute, not architecture" thesis. The audit marks it `✅ confirmed` as a direct quote from Anthropic's blog, but it's exactly the kind of headline statistic that gets paraphrased loosely. Pull the original Anthropic post (`anthropic.com/engineering/built-multi-agent-research-system`) and confirm whether it says "explains" (causal) or "correlates with" (descriptive), and whether the regression was on BrowseComp specifically or across their internal evals.
3. **The "3.7× amplification of unintended solutions" in multi-agent (0.87% vs 0.24% on BrowseComp) [11].** The audit caveats that the report's framing of "after removing 11 contamination cases" is "approximately correct but slightly imprecise" — Anthropic's actual procedure was re-running the 11 flagged problems with a blocklist, with 8 returning correct answers and 3 net losses (≈0.24 percentage points). If you cite this as a security argument against multi-agent, the precise procedure matters because it determines whether 3.7× is a true architectural amplification or partly a measurement artifact of fan-out producing more *opportunities* to find shortcuts.

Smaller items also worth verifying: the **dead link `[24]` (`openai.com/index/introducing-deep-research/`)** returned HTTP 403 on HEAD probe — could be UA gating rather than truly dead; manual `curl -A` will confirm. The HLE 26.6% / GAIA 67.36% numbers it backs are cross-cited via Helicone `[22]` so the load-bearing claim survives. And the 3 `[unsupported]` markers in the security section attribute the "Lee & Tiwari Prompt Infection" and "AgentXploit 71%/70%" claims to source `[9]` (the MAST paper), but those primary papers (arXiv:2410.07283, arXiv:2505.05849) are not in the numbered sources — the underlying claims may well be correct, but in this report they are not properly cited and should be treated as unsubstantiated until you pull the primaries.
