# pi-deep-research

A deep-research extension for [Pi](https://pi.dev), the coding agent by Earendil. It runs a multi-agent research pipeline behind a single `/research` command:

**clarify → plan (you confirm) → parallel web research → factored verification → single-writer cited report → citation-integrity check.**

The design follows current deep-research practice (Anthropic's orchestrator-worker system, LangChain Open Deep Research, GPT Researcher, Stanford STORM, and Chain-of-Verification). The two research briefs it is based on are in [`research/`](./research).

## What it does

- **Plan-confirm gate.** A planner LLM decomposes your question into complementary, perspective-diverse angles and proposes a research brief. You run, edit, regenerate-with-guidance, or cancel before any expensive work starts.
- **Parallel isolated workers.** One worker per angle, each an isolated agent with **only** web tools (`web_search`, `fetch_url`) - no shell, no filesystem. Each returns compressed, schema-validated findings with citations, never raw pages.
- **Factored verification (Chain-of-Verification).** Load-bearing claims are re-checked by fresh verifiers that see **only** the claim plus the fetched source excerpts - no web access, no draft - so they cannot inherit the researchers' hallucinations. Refuted claims are dropped.
- **Single-writer report.** One writer synthesizes the surviving, verified findings into a coherent cited Markdown report (parallel section-writing is a known incoherence antipattern).
- **Citation integrity.** Every URL the report cites is checked against the set of pages actually fetched; unverifiable citations are flagged in the report rather than silently trusted.
- **Budgeted, checkpointed, resumable.** A hard USD ceiling governs the fan-out; every stage checkpoints to the session so an interrupted run resumes with `--resume`.

## Install

Requires Pi and Node 20+. You need one search-provider API key (Tavily, Exa, or Brave) and a model provider configured in Pi (e.g. Anthropic).

```bash
# From npm (once published)
pi install npm:pi-deep-research

# From git
pi install git:github.com/splch/pi-deep-research

# From a local checkout
pi install /path/to/pi-deep-research
```

For local development, load it directly without installing:

```bash
pi -e ./src/index.ts
```

## Configuration

Set a search key (auto-detected in this order: Tavily → Exa → Brave):

```bash
export TAVILY_API_KEY=...   # or EXA_API_KEY / BRAVE_API_KEY
```

Everything else has sane defaults and can be set per-run via flags or globally via env.

| Flag | Env | Default | Meaning |
|---|---|---|---|
| `--depth quick\|standard\|deep` | `PI_RESEARCH_DEPTH` | `standard` | Angle count, turns, and claims to verify |
| `--workers N` | `PI_RESEARCH_WORKERS` | depth-based | Max parallel workers (capped at 4 concurrent) |
| `--votes N` | `PI_RESEARCH_VOTES` | `2` | Verifiers per claim |
| `--budget USD` | `PI_RESEARCH_BUDGET_USD` | `2.00` | Hard spend ceiling for the fan-out |
| `--provider tavily\|exa\|brave` | `PI_RESEARCH_PROVIDER` | auto | Search provider |
| `--no-verify` | - | off | Skip the verification stage |
| `--backend sdk\|subprocess` | `PI_RESEARCH_BACKEND` | `sdk` | Research-worker isolation (see below) |
| `--turn-cap N` | `PI_RESEARCH_TURN_CAP` | depth-based | Soft per-worker turn budget (hard cap adds a small buffer) |
| `--wall-secs N` | `PI_RESEARCH_WALL_SECS` | `180` | Per-research-worker wall-clock limit in seconds |
| `--max-fetch N` | `PI_RESEARCH_MAX_FETCH` | `8000` | Characters of extracted text returned per `fetch_url` |
| `--out DIR` | `PI_RESEARCH_OUT_DIR` | `./research` | Where the report is written |
| `--planner/--worker/--verifier/--writer <model>` | `PI_RESEARCH_{PLANNER,WORKER,VERIFIER,WRITER}_MODEL` | tiered | Per-stage model override |
| `--yes` | - | off | Skip the plan-confirm gate |
| `--resume [runId]` | - | - | Continue the latest (or named) run in this session |

**Model tiering.** By default the planner and writer use your session model (strong reasoning/synthesis) while workers and verifiers drop to the cheapest model from the same provider (high-volume, mechanical). Override any stage explicitly.

## Usage

```
/research How do WebGPU and WebGL compare for in-browser ML inference in 2026?
/research "Is Postgres logical replication production-ready for multi-region?" --depth deep --budget 5
/research --resume            # continue an interrupted run
```

You'll see a live progress board (per-angle status, findings, spend, elapsed) and a plan-confirm dialog before the expensive stage. Cancel a run with `Ctrl+Alt+R`. The final cited report is written to the output directory and summarized in the session.

## Safety model (prompt-injection containment)

Fetched web content is treated as untrusted data throughout:

- **Workers have no action tools** - only `web_search` and an SSRF-guarded, GET-only `fetch_url`. Even a fully hijacked worker has no shell, no file write, and no exfiltration channel, so the "lethal trifecta" is broken by construction.
- **`fetch_url` blocks** non-HTTP(S) schemes, credentials-in-URL, and any host that resolves to a private/loopback/link-local/cloud-metadata address.
- **The orchestrator is deterministic TypeScript** that branches on schema-validated fields, never on free-text model output. Worker text never re-enters the main session as instructions.
- **The writer has no tools**; the worst a poisoned source can do is corrupt prose, which the verification and citation-integrity passes are there to catch.

## SDK vs subprocess backend

The default `sdk` backend runs workers in-process as isolated `AgentSession`s - fast, and already fully tool-isolated. The `subprocess` backend runs each research worker as a separate `pi --no-extensions` child process for OS-level isolation on top of that, sharing fetched sources back via the filesystem. Planner, verifier, and writer always run in-process. Use `subprocess` only if you want hard process isolation; the marginal security benefit over the SDK backend's tool-level isolation is small.

## Development

```bash
npm install
npm run typecheck
npm test                 # unit tests (no network)
PI_DR_LIVE=1 npm test    # also runs live LLM + search integration tests (costs tokens)
```

Debugging: set `PI_DR_DEBUG=1` to print per-angle worker outcomes to stderr during the research stage. The subprocess backend resolves the `pi` binary from `PI_DR_PI_BIN` (default: `pi` on `$PATH`).

Architecture: `src/orchestrator.ts` is the deterministic stage machine; `src/stages/*` are the pipeline stages; `src/worker/*` are the two backends behind one interface; `src/tools/*` are the web tools and terminating "structured output" tools; `src/search/*` are the pluggable search providers. Adding a provider is one adapter file plus one registry entry in `src/search/index.ts`.

## License

MIT
