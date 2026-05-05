# Session transcript

The chat session that produced the artifacts in this directory. Reconstructed
post-hoc from the agent's context window — user messages are verbatim,
agent reasoning and tool calls are summarized for readability (full tool
output would add ~50 KB of raw search JSON without adding signal).

## Metadata

| Field | Value |
| ----- | ----- |
| Date | 2026-05-05 |
| Harness | Pi (Claude Code TUI) |
| Model | `anthropic/claude-opus-4-7`, thinking: xhigh |
| Search provider | Tavily (28 of 1,000 monthly credits consumed) |
| Cost | ~$2.82 subscription credit |
| Context usage at finish | 17.4% of 1.0M auto-compact window |
| Tool calls | ~22 (1 mkdir, 12 `search.sh`, 1 `fetch.sh`, 3 `url-check.sh`, 5 file writes/edits) |
| Final report | 3,508 words, 39 cited URLs, all live |

## Turn 1 — User invokes the skill

> compare ion-trap and superconducting qubits for NISQ-era chemistry

(The skill prompt was attached automatically by Pi's `/skill:deep-research`
slash command, providing the five-phase methodology in the system context.)

## Turn 2 — Phase 1 (Clarify): skipped

The agent decided not to ask clarifying questions. Reasoning recorded in
the assistant turn: the comparison is well-scoped (two named modalities),
the era is defined ("NISQ"), the application is defined ("chemistry" =
electronic structure / VQE-family). Per the skill rubric, these are bad
reasons to ask: "to confirm something the prompt already implies."

A single sanity check ran via `Bash`:

```bash
ls .../skills/deep-research/scripts/   # confirm search.sh / fetch.sh / url-check.sh
env | grep -E "TAVILY|BRAVE|EXA"        # confirm a key is set
# → TAVILY_API_KEY=***
```

## Turn 2 (cont.) — Phase 2 (Plan)

Workspace created at `./research/ion-trap-vs-superconducting-chemistry/cache/`.
Slug derived from the natural compound noun in the query.

`brief.md` written in one shot with: goal, audience, in/out of scope,
deliverable shape, success criteria, 7 sub-questions, and the
source-quality bar from the SKILL.md template.

The seven sub-questions chosen:

1. Hardware metrics (gate fidelity, gate time, T1/T2, connectivity)
2. Largest molecule simulated end-to-end on each platform
3. Circuit-depth budget for chemistry
4. Connectivity → ansatz gate-count overhead
5. Wall-clock throughput / shot cost
6. Error-mitigation methods and overhead
7. Consensus and 1–2 year direction

## Turn 2 (cont.) — Phase 3 (Research loop)

Four parallel `search.sh` calls were issued in a single tool block to
cover sub-question 1 (hardware metrics):

```bash
search.sh "trapped ion two-qubit gate fidelity 2024 benchmark Quantinuum H1 H2"
search.sh "IBM Heron processor two-qubit gate fidelity benchmark 2024"
search.sh "IonQ Forte AQ qubit fidelity gate time 2024"
search.sh "superconducting transmon T1 T2 coherence 2024 best"
```

Returned ~10 results each. High-quality hits identified by domain:
`quantinuum.com`, `ionq.com`, `nature.com`, `quantum-journal.org`,
`fnal.gov`, `ibm.com/quantum`, `qir.mit.edu`. SEO-style aggregator hits
on `medium.com` and `linkedin.com` were noted but not used as primary
sources.

A second batch of four parallel searches covered chemistry experiments
(sub-questions 2–4):

```bash
search.sh "VQE chemistry trapped ion experiment Quantinuum H1 hydrogen LiH BeH2"
search.sh "VQE superconducting IBM Google chemistry largest molecule experiment"
search.sh "Hartree-Fock 12 qubits Sycamore Google Arute molecular simulation"
search.sh "ADAPT-VQE trapped ion chemistry IonQ ground state"
```

Surfaced the canonical chemistry papers: Kandala 2017 (BeH₂), Arute 2020
(Sycamore Hartree–Fock on H₆–H₁₂), Nam 2020 (H₂O on IonQ), Liu 2023
(uPCCD on IonQ Aria), Robledo-Moreno 2024 (SQD [4Fe-4S] on Heron).

A third batch of three parallel searches plus one targeted `fetch.sh`
covered error mitigation, connectivity overhead, and the largest IBM
chemistry workload. Total: 12 `search.sh` calls, 1 `fetch.sh` call (the
Quantum-Journal IonQ 30-qubit benchmarking page).

The agent followed the skill's "do not paste raw HTML into the
conversation" rule throughout — Tavily returned snippets with enough
quoted text to ground the report directly, so only one full page fetch
was needed. The cache directory holds that one fetched markdown file.

The `notes.md` file was written in a single pass after all searches
completed, with ~30 source tuples organized by sub-question. Every tuple
carries a verbatim quote, a quality grade (high / medium-high / medium),
and a date.

## Turn 2 (cont.) — Phase 4 (Synthesize)

The agent re-read `brief.md` and the report-template skeleton, then
wrote `report.md` in a single `Write` call. No section-parallel
synthesis (the skill explicitly warns against it).

Final report shape: TL;DR (5 bullets) → Background → 6 sub-question
sections → Comparison table → Practical implications → "What I couldn't
verify" → alphabetized Sources bibliography.

Length: 3,508 words, within the 800–2,500 target's "comprehensive" upper
bound. 39 unique URL citations.

## Turn 2 (cont.) — Phase 5 (Verify citations)

```bash
url-check.sh report.md > url-check.log
# → 39 URLs checked, 1 DEAD (apps.dtic.mil/sti/pdfs/AD1159426.pdf, HTTP 403)
url-check.sh report.md --fix
# → Wayback Machine has no snapshot of the DTIC PDF
```

The DTIC URL supported one specific claim (ion-shuttling overhead in
QCCD architectures). The same factual point is independently supported
by IonQ's own Q2 2024 investor deck ("on average only 1-2% of wall
clock time spent computing"), which is a primary source for the same
claim. The agent's call: drop the DTIC citation, keep the claim, point
to the IonQ source.

```bash
url-check.sh report.md
# → 0 dead, 0 fixed, all URLs resolved
```

End of Phase 5.

## Turn 3 — User asks to capture the run

> I want to capture this run as an example in ~/Repositories/pi-deep-research

The agent inspected the target repo:

- `.gitignore` excludes `research/` (so the working dir can't ship as-is)
- `README.md` already uses this exact query as the canonical example
  (`/skill:deep-research compare ion-trap and superconducting qubits for NISQ-era chemistry`)

Decision: ship under `examples/<slug>/` (top-level, outside the ignored
`research/` path), not under `skills/deep-research/` (which is
shipped to npm — examples are repo-browsing artifacts, not runtime
assets). Skipped the `cache/` directory — implementation detail, only
44 KB but not interesting to a reader. Added an `examples/README.md`
index and linked it from the top-level `README.md`.

A second issue surfaced: `*.log` in `.gitignore` would have swallowed
`url-check.log`, but that log is the proof that Phase 5 ran cleanly and
should ship. Fixed with a scoped negation:

```gitignore
# Keep verification logs that ship with checked-in example runs.
!examples/**/*.log
```

## Turn 4 — User asks to also include this chat history

> Also, I'd like you to include this chat history.

This file. Reconstructed from the agent's context window since the
harness doesn't expose a transcript-export tool, with user messages
verbatim and tool-call output summarized rather than dumped.

## What this example demonstrates

- **Clarification skipping**: a well-scoped query goes straight to Phase 2.
- **Parallel search fan-out**: 4 search queries per tool block, 3 blocks,
  covered the entire research surface in 12 calls.
- **Snippet-first evidence gathering**: only 1 of 12 search-result sets
  needed a full page fetch — Tavily snippets were enough to extract
  verbatim quotes for `notes.md`.
- **One-shot synthesis**: the report was written in a single `Write`
  call, not section-by-section.
- **Citation rot recovery**: a dead URL was caught in Phase 5, the
  Wayback fallback failed, and the agent dropped the citation rather
  than leaving a broken link or a fake "verified" claim.
- **End-to-end cost**: ~$2.82 in model credits, 28 Tavily credits, ~17%
  of context window. Reproducing this run on a fresh API key and
  default Tavily plan is well under $5.
