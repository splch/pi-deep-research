# Security policy

`pi-deep-research` is a multi-agent extension that reads from the open web and writes to local files. The threat model and reporting process are below.

## In scope

- **Lethal-trifecta egress bypass.** A URL accepted by `web_fetch` that should have been refused by `exfilCheck` (sensitive query keys: `api_key`, `secret`, `token`, `bearer`, `password`, `auth*`; oversized opaque base64-shaped values; non-HTTP(S) protocols; query strings >4 kB).
- **Host allow/blocklist bypass.** Any input that lets a worker fetch a host outside `host_allowlist` (or inside `host_blocklist`), including via env-var manipulation of `PI_DR_HOST_ALLOWLIST` / `PI_DR_HOST_BLOCKLIST`.
- **Worker isolation escape.** A worker reaching the parent's tool surface, executing arbitrary code, or making network calls outside `web_search` / `web_fetch` / `extra_worker_tools`.
- **Markdown sanitizer bypass.** Image, link, or script vectors in `report.md` that survive post-processing (`![alt](url)`, raw `<img>`, `javascript:` autolinks, or any equivalent).
- **Subprocess argument or environment injection** through tool parameters (`query`, `brief`, `host_allowlist`, `extra_worker_tools`, etc.).
- **Manifest tampering** — a path that lets a worker write to or alter `manifest.json` or `findings.jsonl` outside the run's `output_dir`.

## Out of scope

- **Model jailbreaks** of upstream LLMs (a property of the model, not this extension).
- **Prompt-only injection** that the worker correctly logs to `disagreements[]` prefixed `[injection-attempt]` and does not act on — this is the documented behavior, not a vulnerability.
- **Hallucinated citations.** Verification is the human verifier's obligation; the disclosure header, `[N]💀` markers, CitationAgent, and SAFE phase mitigate but do not eliminate this. Filing a "the AI made up a citation" report won't be treated as a security issue.
- **Vulnerabilities in upstream dependencies** (`pi`, `pi-ai`, `typebox`, `node:`, search-provider APIs, Jina). Please report those upstream; we'll bump versions when fixes ship.
- **Findings extracted from the web that the user disagrees with.** That's a research-quality concern, not a security one.

## Reporting

Open a private security advisory at <https://github.com/splch/pi-deep-research/security/advisories/new>. If GitHub Security Advisories are unavailable to you, fall back to the maintainer's email on their GitHub profile (<https://github.com/splch>) with subject prefix `[pi-deep-research SECURITY]`. Please include:

- Affected version (`extension_version` from a recent `manifest.json` is ideal).
- Proof-of-concept showing the bypass, with a clear "expected vs. actual" outcome.
- Impact analysis (data exfil? code execution? sandbox escape? scope inflation?).

Please **do not** open public issues for unpatched vulnerabilities. We aim to acknowledge within 7 days and ship a fix, mitigation, or coordinated-disclosure timeline within 90 days. Reporters will be credited in the release notes if they request it.

## Disclosure

Coordinated, with a 90-day default window. Earlier disclosure is acceptable when the issue is already being exploited or when a clear public mitigation exists. The maintainers will not pursue legal action against good-faith research that respects this policy.
