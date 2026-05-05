# Examples

End-to-end captures of `pi-deep-research` runs. Each subdirectory is the
literal `./research/<slug>/` workspace produced by the skill, minus the
`cache/` directory (which holds raw fetched markdown and isn't useful to
read post-hoc), plus a `session.md` reconstructed from the agent's
context window so you can see how the conversation actually went.

These are checked in so you can see what a real run looks like before
installing the skill.

## Index

| Topic | Provider | Date | Sources cited | Words |
| ----- | -------- | ---- | ------------- | ----- |
| [ion-trap-vs-superconducting-chemistry](./ion-trap-vs-superconducting-chemistry/) | Tavily | 2026-05-05 | 39 | ~3,500 |

## Reading order

For each example:

1. **`brief.md`** — the plan: goal, scope, sub-questions, source-quality bar.
2. **`notes.md`** — the evidence: `(claim, url, quote)` tuples per
   sub-question, each tagged with a quality grade.
3. **`report.md`** — the synthesis: TL;DR, one section per sub-question,
   comparison table, "what I couldn't verify", and an alphabetized
   bibliography.
4. **`url-check.log`** — the verification pass: every cited URL fetched
   with its HTTP status. A run is only considered finished when this log
   shows zero `DEAD` entries.
5. **`session.md`** — a reconstructed transcript of the chat session
   that produced the four artifacts above: which clarifying questions
   got skipped, how the parallel searches fanned out, what got cut in
   Phase 5 and why.

## Reproducing

```bash
export TAVILY_API_KEY=...   # or BRAVE_API_KEY / EXA_API_KEY
pi
# inside Pi:
/skill:deep-research <topic from the index above>
```

The agent's behaviour is non-deterministic, so a fresh run will not
produce byte-identical artifacts — but the shape of the output (one
brief, one notes file, one report, one URL-check log) is stable, and
every claim in `report.md` will trace back to a tuple in `notes.md`.
