# Methodology — phase-by-phase depth

Load this on demand when you need more detail than `SKILL.md` provides.

---

## Clarifier prompt rubric (Phase 1)

When you do ask clarifying questions, follow these rules. They come from
OpenAI's published prompt-design notes for the Deep Research API and have
been validated across providers.

- **Maximize relevance.** Ask only about dimensions that change the
  report's structure or content.
- **Surface missing critical dimensions.** Common ones: time window
  ("most recent" vs historical), audience expertise, geography, decision
  context (academic / commercial / regulatory).
- **Do not invent preferences.** Don't say "do you prefer a brief one-page
  format?" if the user didn't hint at length.
- **First person, concise.** "Are you focused on X or Y?" not "The
  assistant would like to know whether the user prefers..."
- **Bullet list, no preamble.** Three questions max. Skip if zero are
  needed.

When you skip clarifying, briefly state your interpretation in one
sentence ("Reading this as a comparative review for an engineering
audience as of 2026 — proceeding") so the user can interrupt if wrong.

---

## Source-quality heuristic (Phase 3)

The biggest hallucination-fix in any deep-research system, per Anthropic's
published failure analysis, is *not* a model upgrade — it's a prompt-level
source-quality bar.

Score sources on a three-point scale before extracting tuples:

**High** (count toward "verified" claim):
- Government domains (.gov, .gc.ca, gov.uk, etc.)
- Educational and research institutions (.edu, .ac.*, lab homepages)
- Peer-reviewed papers (PubMed, arXiv preprints with multiple citations)
- Original press releases from named organizations
- Primary documents (filings, court records, datasets, RFCs)
- Named-author technical posts from recognized practitioners

**Medium** (use, but flag):
- Major news outlets with bylined journalism (NYT, FT, Reuters, BBC,
  Bloomberg, Nature News, Ars Technica, IEEE Spectrum, etc.)
- Trade publications with clear editorial standards
- Wikipedia articles with strong inline citations (use as a map to
  primaries, not as the cite itself)

**Low** (deprioritize or reject):
- SEO content farms, AI-generated explainers
- Undated articles
- Aggregators or "10 best X" listicles without authorship
- Pages where the claim's source is itself uncited

If only low-quality sources answer a sub-question, that sub-question
graduates to the "What I couldn't verify" section.

---

## Search strategy (Phase 3)

**Start wide, narrow down.** Anthropic's analysis shows agents
systematically err toward overly long, specific queries. Counter this:

- First query: 2-5 word topic words, no jargon.
- Second/third: add domain vocabulary you learned from snippets.
- Only then go specific: dates, named entities, exact technical terms.

**Diversify.** For each sub-question, issue at least one query that could
*disconfirm* your current draft. If you've been finding articles in favor
of X, search "criticism of X", "X failure modes", "X vs Y skeptics".

**Parallel search.** Issue 2-4 `search.sh` calls in parallel via separate
`bash` tool invocations. Pi runs them concurrently.

**Caching.** Don't re-issue a query you already ran in this session.
Search results are not cached by the script — track them in your scratch
or `notes.md`.

---

## Tuple extraction (Phase 3)

For each useful source, the tuple is the unit of trust. Extract this:

```yaml
claim: "..."           # what the source supports, in your words
url: "https://..."
quote: "..."           # exact words from the page, ≤2 sentences
quality: high|medium|low
date: "YYYY-MM-DD" | "undated"
```

Rules:

- **No paraphrase quotes.** If you can't find the exact words, the
  claim isn't grounded — go back and read the page more carefully or
  drop the claim.
- **One quote per claim.** If a source supports two distinct claims,
  make two tuples.
- **Quote length cap of two sentences.** If you need more, you're
  probably restating the page; refine the claim instead.

---

## Synthesis discipline (Phase 4)

**One pass, one writer.** Do not parallelize section authorship. The
LangChain `open_deep_research` team explicitly reverted parallel
section-writing because reports came out disjointed; this matches
Cognition's general guidance against parallel agent work where outputs
must compose.

**Read inputs fresh.** Before writing `report.md`, re-read `brief.md`
and skim every section of `notes.md`. Do not rely on memory of what's
in the notes — Phase 3 is long enough that compaction may have run.

**Cite per claim, not per paragraph.** Inline `[short-label](url)` for
every factual statement. Repeat citations if the same source supports
multiple claims; the post-pass URL check costs nothing per repeat.

**Write the limitations section honestly.** "What I couldn't verify"
should list every sub-question whose answer relies on low-quality
sources, every contradiction between sources you couldn't resolve, and
every dimension you cut for scope. This section earns trust.

---

## Recovery from common failures

**"All sources contradict each other."** This is good information.
Document the contradictions explicitly in the relevant section and in
"What I couldn't verify". Do not pick a winner without a tiebreaker
source.

**"I can't find primary sources, only blog summaries."** Add one more
search round targeting the original venue (e.g. "site:arxiv.org",
"filetype:pdf", "company.com/press"). If still nothing, downgrade the
claim to "reported by..." with the secondary source cited and flag in
limitations.

**"The cap hit and I haven't finished a sub-question."** Stop. Write
what you have. Note in "What I couldn't verify" that the sub-question
is partially answered. Don't keep digging — the cap exists to prevent
unbounded sprawls.

**"`url-check.sh` flagged a citation as DEAD but I know it works."**
Some sites block HEAD or non-browser user-agents. Try the page in
`fetch.sh` (which uses GET via Jina); if that succeeds, replace the
citation URL with the same URL — `url-check.sh` re-runs against the
report file. If it still fails, the user's environment can't reach it
either; treat it as dead.

---

## When *not* to use this skill

- Single-fact lookup ("what year was X founded") — answer directly,
  cite once, skip the pipeline.
- Coding or implementation tasks — different workflow entirely.
- Questions about private/internal systems where web search wouldn't
  help — the skill has no value here.
- Time-sensitive monitoring (price quotes, live scores) — use a
  dedicated tool, not a research report.
