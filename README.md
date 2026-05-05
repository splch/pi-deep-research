# pi-deep-research

A deep research skill for [Pi](https://pi.dev). One slash command takes a
topic, plans sub-questions, searches and fetches authoritative sources,
synthesizes a structured markdown report, and verifies that every cited URL
resolves.

Single-agent, file-backed state, post-hoc citation grounding. No extension or
build step.

## Install

```bash
pi install git:github.com/splch/pi-deep-research
# or, after publish:
pi install npm:pi-deep-research
```

## Use

```text
/skill:deep-research compare ion-trap and superconducting qubits for NISQ-era chemistry
```

The agent will:

1. Ask 1-3 clarifying questions only if intent is ambiguous.
2. Write a research brief to `./research/<slug>/brief.md`.
3. Search and fetch sources, recording `(claim, url, quote)` tuples in `notes.md`.
4. Synthesize one report (`report.md`) with inline citations.
5. Run a URL liveness check; rewrite dead links to `web.archive.org` snapshots.

All artifacts land in `./research/<slug>/` so a session can be resumed,
inspected, or shared.

## Configure

Set one of these env vars (the skill picks the first available):

| Var               | Provider | Notes                                  |
| ----------------- | -------- | -------------------------------------- |
| `TAVILY_API_KEY`  | Tavily   | Default. Agent-native search.          |
| `BRAVE_API_KEY`   | Brave    | Independent index, low latency.        |
| `EXA_API_KEY`     | Exa      | Neural / semantic search.              |

Page fetch uses [Jina Reader](https://r.jina.ai) (no key, free tier) and
falls back to raw `curl`. Cached by content hash under
`./research/<slug>/cache/`.

## Layout

```text
pi-deep-research/
├── package.json
└── skills/
    └── deep-research/
        ├── SKILL.md
        ├── references/
        │   ├── methodology.md     # phase-by-phase depth, on-demand
        │   └── report-template.md
        └── scripts/
            ├── search.sh          # provider-agnostic search
            ├── fetch.sh           # cached URL → markdown
            └── url-check.sh       # liveness scan + Wayback rewrite
```

## License

MIT.
