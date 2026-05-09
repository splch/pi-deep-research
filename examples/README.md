# Examples

Curated `deep_research` runs kept in-repo for reference. Each subdirectory is one
end-to-end run, with the exact prompt, brief, parameters, and produced artifacts.

`.deep-research/` (the default output directory) is gitignored so day-to-day
runs don't pollute the repo. Move a run here when it's worth keeping — as a
reference for prompt design, as a regression baseline, or as documentation of
what a "good" run looks like.

## Layout

Each example lives at `examples/<slug>/` and contains:

| File | What it is |
|---|---|
| `README.md` | The original question, the caller's interpretation of scope, the exact `brief` passed to `deep_research`, a summary of findings, and any spot-check notes. |
| `report.md` | The final report verbatim, including the `## Fact-check audit` and `## Citation audit` sections. |
| `manifest.json` | Full machine-readable run manifest: request, planner output, per-worker findings, sources, costs, timings, and verification results. Absolute filesystem paths are sanitized to repo-relative. |
| `findings.jsonl` | One JSON object per worker finding (claim + evidence + sources_used). |

## Adding a new example

1. Run `deep_research` as normal — output lands in `.deep-research/<timestamp>-<slug>/`.
2. Pick a short, hyphenated slug (e.g. `gemini-vs-openai-pricing`, not the timestamped run id).
3. Copy `report.md`, `findings.jsonl`, and a path-sanitized `manifest.json` into `examples/<slug>/`:

   ```bash
   SRC=.deep-research/<run-id>
   DST=examples/<slug>
   mkdir -p "$DST"
   cp "$SRC/report.md" "$SRC/findings.jsonl" "$DST/"
   sed "s|$(pwd)/||g" "$SRC/manifest.json" > "$DST/manifest.json"
   ```

4. Write `examples/<slug>/README.md` covering: the original question, scope
   interpretation, the `brief` you used, key findings, and 2–3 claims worth
   spot-checking (cross-reference dead-link `💀` markers, the citation audit,
   and any cost-cap warnings).

## Index

| Slug | Question | Cost | Sources | Notes |
|---|---|---|---|---|
| [`llm-deep-research-best-practices`](./llm-deep-research-best-practices/) | Best practices and industry standards for LLM-based deep research agents | $12.87 | 30 | depth=2, breadth=5, safe_check=true; 0 dead links |
| [`single-vs-multi-agent-architectures`](./single-vs-multi-agent-architectures/) | Trade-offs between single-agent and multi-agent LLM deep-research architectures, and which wins where | $8.59 | 30 | depth=2, breadth=5, safe_check=true; 1 dead link (`[24]`) |
