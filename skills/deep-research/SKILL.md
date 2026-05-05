---
name: deep-research
description: Multi-source web research for open-ended questions. Use when the user asks for a "report on X", a "deep dive into Y", a "compare A vs B with sources" answer, a literature or market review, or any question that needs several authoritative sources answered with inline citations. Plans 5-8 sub-questions, searches and fetches sources via shell scripts, persists a brief and structured notes to ./research/<slug>/, synthesizes one markdown report, then verifies every cited URL resolves and rewrites dead links to web.archive.org snapshots. Provider-agnostic search via Tavily, Brave, or Exa based on which API key env var is set.
license: MIT
---

# Deep Research

A five-phase pipeline. Run them in order. Persist state to disk between
phases so the work survives compaction and so the user can resume or audit.

> **Hard rules.** Do not skip Phase 5. Do not synthesize in parallel section
> writers. Do not pass raw HTML between phases - always summarize before
> moving on. Cap total sources at ~100. Default to proceeding rather than
> asking permission.

## Workspace

Create `./research/<slug>/` once at the start, where `<slug>` is a short
kebab-case slug derived from the topic (e.g. `ion-trap-vs-superconducting`).
All artifacts go here:

```text
research/<slug>/
├── brief.md         # research plan; write once, re-read after compaction
├── notes.md         # (claim, url, quote) tuples organized by sub-question
├── report.md        # final synthesized report
├── cache/           # fetched pages, content-addressed (managed by fetch.sh)
└── url-check.log    # output of the liveness scan
```

Set `PI_RESEARCH_CACHE` to the slug-specific cache before invoking
`fetch.sh`, so caches don't bleed across topics:

```bash
export PI_RESEARCH_CACHE=./research/<slug>/cache
```

---

## Phase 1 — Clarify

Ask **at most 1-3** clarifying questions, and only if the topic is genuinely
ambiguous on a dimension that materially changes the report (audience, time
window, scope, or required depth). When in doubt, **proceed without asking**.

Good reasons to ask:
- "compare A vs B" but A or B is undefined
- The user named a domain you can't disambiguate (e.g. "Atlas" — the rocket,
  the company, the dataset?)
- The deliverable shape is unclear (one-pager? 10-page report? table only?)

Bad reasons to ask:
- To confirm something the prompt already implies
- To offload a judgement call you can make from context

When you do ask, format as a short bulleted list, in the first person, no
preamble. Do not invent or assume preferences in the question text.

---

## Phase 2 — Plan (write `brief.md`)

Once intent is clear, write `./research/<slug>/brief.md` with these sections:

```markdown
# Research brief: <topic>

**Goal**: <one sentence>
**Audience**: <who reads this>
**Scope**: <what's in>
**Out of scope**: <what's out>
**Deliverable**: <shape and length>
**Success criteria**: <what makes this report good>

## Sub-questions
1. ...
2. ...
(5-8 total. Each must be answerable from web sources.)

## Source-quality bar
- Prefer: .gov, .edu, peer-reviewed, original press releases, primary docs,
  named-author technical blogs from recognized practitioners.
- Avoid: SEO content farms, undated articles, unsourced aggregators, AI
  content mills, listicles without authorship.
```

Re-read this file after any compaction and at the start of Phase 4.

---

## Phase 3 — Research loop (per sub-question)

For each sub-question, run a bounded ReAct loop. Use the budget heuristics:

| Sub-question complexity | Tool calls per sub-question |
| ----------------------- | --------------------------- |
| simple fact lookup      | 3-5                         |
| comparison or synthesis | 8-12                        |
| open-ended hard         | 15-20 (cap)                 |

**Do not exceed 20 tool calls per sub-question or ~100 sources total across
the report.** When you hit the cap, stop and accept what you have.

### Loop body

1. **Search.** Issue 2-4 `bash` calls to `scripts/search.sh "<query>"` in
   parallel via separate tool invocations. Vary the query — never reuse the
   same string twice. Start broad, narrow as you learn the vocabulary.
2. **Score.** Read titles and snippets. Drop content farms. Prefer high-bar
   sources from `brief.md`. Pick 3-5 to fetch.
3. **Fetch.** `scripts/fetch.sh "<url>"` returns clean markdown (cached).
4. **Extract.** For each useful source, append a tuple block to
   `notes.md` (format below). Quote text *exactly* — copy-paste, don't
   paraphrase.
5. **Reflect.** Have we answered the sub-question? If not, what gap remains?
   Refine the next query against the gap, not against the previous query.
6. **Stop** when one of: (a) the sub-question is answered with ≥2
   independent high-quality sources, (b) you hit the call cap, or (c) two
   consecutive iterations add no new information.

### `notes.md` format

```markdown
## Sub-question 1: <text>

### [Source title](https://example.gov/path)
- **Claim**: <one-sentence claim grounded in this source>
- **Quote**: > "<exact text from the page, ≤2 sentences>"
- **Quality**: high | medium | low
- **Date**: <publication date if available, else "undated">

### [Another source](https://...)
- **Claim**: ...
- **Quote**: > "..."
- ...

## Sub-question 2: <text>
...
```

Every claim that ends up in `report.md` must trace to a tuple here. If a
tuple has no quote, the source isn't usable — drop it.

---

## Phase 4 — Synthesize (write `report.md`, one shot)

Re-read `brief.md` and `notes.md`. Then write `report.md` in **a single
pass**. Do not split sections across parallel writers — disjointed reports
are the well-documented failure mode of section-parallel synthesis.

Use `references/report-template.md` as the skeleton. Standard structure:

1. **TL;DR** — 3-6 bullets answering the headline question.
2. **Background** (only if non-obvious to the audience).
3. **One H2 per sub-question** from the brief. Inline citations per claim
   as `[label](url)` linking to entries in `notes.md`.
4. **Comparison table** when the topic is "A vs B" or "options for X".
5. **What I couldn't verify** — the gaps. List them. This is the most
   trust-building section in the whole report; do not skip it.
6. **Sources** — deduplicated bibliography, alphabetized by domain.

Length: 800-2500 words for most queries; up to ~5000 for "comprehensive"
ones. Do not pad.

---

## Phase 5 — Verify citations (mandatory)

```bash
scripts/url-check.sh ./research/<slug>/report.md > ./research/<slug>/url-check.log
# If any DEAD lines, attempt Wayback rewrite:
scripts/url-check.sh ./research/<slug>/report.md --fix
```

For any URL that the script can't repair, either remove the citation and
the claim it supports, or move the claim to "What I couldn't verify".

A report with dead citations is worse than a shorter report — recent audits
show 3-13% of cited URLs in deep-research outputs are fabricated. Treat
this phase as load-bearing.

---

## Tool reference

| Script                 | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `scripts/search.sh`    | Provider-agnostic search; JSON array out.      |
| `scripts/fetch.sh`     | URL → clean markdown, content-hash cached.     |
| `scripts/url-check.sh` | Liveness scan; `--fix` rewrites to Wayback.    |

All three are POSIX shell + `curl` + `jq`. No build step.

For deeper guidance on each phase (clarifier prompt rubric, source-quality
heuristics, recovery from common failures), read
`references/methodology.md` on demand.

## Failure modes to avoid

- **Source laundering**: an SEO blog citing an unnamed "study" — find the
  primary source or drop the claim.
- **Confirmation drift**: searching only for queries that match your
  current draft. Force at least one disconfirming query per sub-question.
- **Token waste**: never paste raw HTML into the conversation. `fetch.sh`
  already returns markdown; if you need only a section, extract the
  relevant paragraphs into `notes.md` and discard the rest.
- **Citation rot**: writing the report without re-reading `notes.md`. The
  one-shot synthesizer must read the notes file fresh.
- **Trailing summary loop**: do not write a "summary of what I did" at the
  end of the report. The TL;DR and "What I couldn't verify" cover it.
