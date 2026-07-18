# Creating Extensions for Pi (pi.dev)

Deep-research report on building extensions for **Pi**, the open-source AI coding agent by Earendil Inc. (GitHub: [earendil-works/pi](https://github.com/earendil-works/pi), npm: [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)).

**Provenance**: all claims verified 2026-07-17 against the repo `main` branch, [pi.dev/docs/latest](https://pi.dev/docs/latest/extensions), and npm v0.74.0-v0.80.10 (latest published 2026-07-16). Pipeline: 15 sources fetched, 74 claims extracted, top 25 put through 3-vote adversarial verification - 22 confirmed, 3 refuted, 0 left unverified. Pi moves fast; exact counts (events, examples) drift week to week.

---

## TL;DR

A Pi extension is a single TypeScript module (a `.ts` file or a directory with `index.ts`) whose **default export is a factory function** receiving an `ExtensionAPI` object, conventionally named `pi`. The factory registers capabilities through `pi.register*` methods and subscribes to ~33 lifecycle events through `pi.on(...)`. There is **no build step** - Pi loads uncompiled TypeScript via jiti. The dev loop is `pi -e ./my-ext.ts` or dropping the file into `~/.pi/agent/extensions/`. Distribution is a normal npm package whose `package.json` carries a `"pi"` field; users install with `pi install npm:...` / `git:...` / a URL / a local path.

## 1. Anatomy of an extension file

Confidence: **high** (3-0, four independent claim clusters converged).

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => { /* intercept/gate */ });
  pi.registerTool({ /* name, typed params, execute, ... */ });
  pi.registerCommand("name", { /* slash command */ });
}
```

- The factory type is verbatim `export type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>` in [`src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts).
- `ExtensionAPI` is a compile-time `import type`; the runtime object is injected by the loader.
- The factory may be **async** - Pi awaits the returned Promise before startup continues (before `session_start`). Useful for one-time async init such as fetching remote model lists.
- Real shipped extensions (`hello.ts`, `permission-gate.ts`, `confirm-destructive.ts`) all use exactly this shape.

Sources: [types.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts), [docs/extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [pi.dev/docs/latest/extensions](https://pi.dev/docs/latest/extensions), [examples README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/README.md).

## 2. Registration API (`pi.register*`)

Confidence: **high** (3-0). All seven methods confirmed against `types.ts` with matching signatures:

| Method | Registers | Notes |
|---|---|---|
| `registerTool` | Custom tools | `registerTool<TParams extends TSchema, TDetails, TState>(tool: ToolDefinition)` - typed params, execution logic, state persistence |
| `registerCommand` | Slash commands (like `/todos`, `/preset`) | `registerCommand(name, {...})`; surfaced via `getCommands(): SlashCommandInfo[]` |
| `registerShortcut` | Keyboard shortcuts | Keyed by a `KeyId` |
| `registerFlag` | CLI flags | `{type: 'boolean' | 'string'; default?}`, read back with `getFlag` |
| `registerProvider` | LLM providers | How the custom-provider examples plug in |
| `registerMessageRenderer` | Custom message rendering | |
| `registerEntryRenderer` | Custom entry rendering | |

pi.dev's homepage summary - "TypeScript modules with access to tools, commands, keyboard shortcuts, events, and the full TUI" (custom TUI via `ctx.ui.custom()`) - is accurate per capability, with one caveat carried from verification: the `register*` methods are the *main registration points*, but interception and gating behavior runs through the event system (next section), and skills/prompts/themes/MCP are separate mechanisms, not `register*` calls. "Full customization surface" is marketing-strength phrasing.

## 3. Lifecycle events (`pi.on`)

Confidence: **high** (3-0). Extensions hook the agent loop through **~33 literal string event keys** (hand-counted 33 on 2026-07-17; the count drifts). Handlers receive `(event, ctx)`.

Categories:

- **Session lifecycle**: `session_start`, `session_shutdown`, and ~11 `session_*` keys
- **Provider/LLM calls**: `before_provider_request`, `after_provider_response`
- **Agent/turn/message phases**: `agent_start`/`agent_end`/`agent_settled`, `turn_start`/`turn_end`, `message_start`/`message_update`/`message_end`
- **Tool execution**: `tool_call`, `tool_result`, `tool_execution_start`/`update`/`end`
- **User input**: `user_bash`, `input`
- **Misc**: `project_trust`, `model_select`

Two important design facts:

1. **The event system, not `register*`, is how permission gates, plan mode, and context injection are implemented.**
2. Some events are **transform hooks that return a result** rather than pure notifications - e.g. `on(event: 'input', handler: ExtensionHandler<InputEvent, InputEventResult>)`, exercised by `test/extensions-input-event.test.ts`.

## 4. Discovery, loading, and the local dev loop

Confidence: **high** (3-0). Pi discovers extensions from five places:

1. **Global**: `~/.pi/agent/extensions/` (as `*.ts` or `*/index.ts`) - copy a file here for auto-discovery
2. **Project-local**: `.pi/extensions/`
3. **Installed Pi packages** (npm/git, see section 7)
4. **settings.json** `extensions` array of arbitrary paths
5. **CLI flag**: `-e` / `--extension <source>` - "Load extension from path, npm, or git"

The dev/test loop is the same mechanism: `pi --extension ./my-extension.ts` to iterate on a single file, or `cp my-ext.ts ~/.pi/agent/extensions/`. TypeScript loads **uncompiled via jiti**, so there is no build step.

**Gap flagged by verification**: primary sources are thin on anything deeper than this - no documented hot-reload/watch mode, error-surfacing, or source-map story. (See open questions.)

## 5. The shipped examples: what to crib from

Confidence: **high** (3-0, ground truth via GitHub Contents/Trees API on `main`, 2026-07-17).

`packages/coding-agent/examples/extensions/` holds roughly **69-85 `.ts` files plus 9 subdirectories** (~84-118 items counted recursively - both the "50+" and "80+" phrasings you'll see are true, neither is exact). Subdirectories: `custom-provider-anthropic/`, `custom-provider-gitlab-duo/`, `doom-overlay/`, `dynamic-resources/`, `gondolin/`, `plan-mode/`, `sandbox/`, `subagent/`, `with-deps/`.

The advanced patterns all exist as dedicated, correctly-named entries:

| Example | What it demonstrates |
|---|---|
| `permission-gate.ts` | Confirm before dangerous bash (`rm -rf`, `sudo`) - event-hook gating |
| `subagent/` | Delegate to specialized subagents with isolated context windows |
| `ssh.ts` | Delegate all tools to a remote machine via SSH using pluggable operations |
| `sandbox/` | OS-level sandboxing via `@anthropic-ai/sandbox-runtime`, per-project config |
| `plan-mode/` | Claude Code-style read-only exploration with a `/plan` command and step tracking |
| `protected-paths.ts` | Path protection |

Pattern split confirmed across examples: **safety gates / plan mode / context injection are built on `pi.on()` event hooks; new capabilities use `registerTool` / `registerCommand`.**

Two corrections to claims circulating in secondary sources (both caught in verification):

- Subagents run in a **separate `pi` process via `node:child_process.spawn`**, not "via tmux" - the tmux phrasing appears in marketing-adjacent summaries and is unsupported by the `subagent/` README or code.
- An "MCP integration" example **inside `examples/extensions/` is unverified** - MCP appears in pi.dev marketing/nav, but no such example was found in the directory listing or examples README.

## 6. Extensions vs skills, prompt templates, themes, MCP

Confidence: **medium** - the structural facts are 3-0 verified, but explicit "when to use which" guidance was not found in primary sources.

- Pi treats **extensions, skills, prompt templates, and themes as four distinct primitives**, evidenced by the Pi Package manifest's four sibling arrays (section 7). pi.dev frames the design as "Primitives, not features."
- **Extensions are the programmatic primitive** (TS modules registering tools/commands/shortcuts/events/TUI); **skills, prompts, and themes are declarative content** shipped alongside them.
- Extensions are also a **standalone top-level primitive** - loadable as a single file via `-e` - not only deliverable inside packages. (The opposite claim was refuted 0-3.)
- **MCP's precise relationship to extensions is under-documented**: whether an extension can programmatically register/consume MCP servers was not resolvable from primary sources in this pass.

Rule of thumb pending better docs: if it needs code or hooks into the agent loop, it's an extension; if it's instructions/content for the model, it's a skill or prompt template; if it's visual styling, it's a theme.

## 7. Packaging and distribution ("Pi Packages")

Confidence: **high** (3-0).

A Pi Package is a **standard npm package** whose `package.json` adds a `"pi"` field with path arrays, plus the `"pi-package"` keyword (recommended for discoverability in the package gallery at [pi.dev/packages](https://pi.dev/packages)):

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

- Paths are relative to the package root; arrays support **glob patterns and `!` exclusions**.
- With no manifest, Pi **auto-discovers** from conventional directories: `extensions/*.ts,*.js`, `skills/SKILL.md`, `prompts/*.md`, `themes/*.json`.
- The `pi` key may also carry gallery video/image fields.

Users install with `pi install <source>`, which accepts (all version-pinnable where it makes sense):

```
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo
pi install ssh://git@github.com/user/repo    # uses your SSH keys, respects ~/.ssh/config
pi install /absolute/path/to/package         # or ./relative/path
```

`pi install` strictly installs *packages* (which bundle extensions + skills + prompts + themes together).

## Refuted claims (excluded from the guide)

Each killed 0-3 by adversarial verification:

1. An exact "73 files / 82 items" examples count (superseded by API-derived ~84-118 recursive counts).
2. An "eight-category full API surface" enumeration attributed to the examples (overreach beyond what sources support).
3. "Extensions are delivered only as part of packages, not as a standalone mechanism" (contradicted by `-e` and single-file loading).

## Open questions (worth answering from the repo directly before building)

1. The exact, current list of `pi.on()` event keys with per-event semantics and `ctx` shape - and which events are transform hooks (returning a result, like `input` returning `InputEventResult`) vs pure notifications.
2. The real reload/debug workflow beyond `-e` and file-drop: hot reload? how runtime errors and console output surface? do source maps work under jiti?
3. Extension-MCP integration: can an extension register or consume MCP servers/tools programmatically, and does a shipped MCP example actually exist?
4. Authoritative "extension vs skill vs prompt template" decision guidance from the maintainers.

## Key sources

Primary (where nearly all confirmed claims rest):

- [`src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - ground truth for the API
- [`docs/extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) - the canonical extension guide (~2,900 lines)
- [`docs/packages.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md) - packaging/distribution
- [`examples/extensions/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions) + [its README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/README.md)
- [coding-agent README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md), [CHANGELOG](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/CHANGELOG.md)
- [pi.dev](https://pi.dev/), [pi.dev/docs/latest/extensions](https://pi.dev/docs/latest/extensions), [pi.dev/docs/latest/packages](https://pi.dev/docs/latest/packages)
- [npm: @earendil-works/pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

Secondary (used with corroboration): [DeepWiki extension patterns page](https://deepwiki.com/earendil-works/pi/6.3-extension-examples-and-patterns), a Mintlify preview deploy of the customization guide, [github.com/sids/pi-extensions](https://github.com/sids/pi-extensions) (third-party example of a published extension package), one 2026-05 blog post.
