import { getAgentDir, ModelRuntime, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { BOOLEAN_FLAGS, ENUM_FLAG_VALUES, parseCommandArgs, VALUE_FLAGS } from "./args.js";
import { latestRunState } from "./checkpoint.js";
import { resolveConfig, type ResolvedConfig } from "./config.js";
import { newRunId } from "./ids.js";
import { resolveStageModels } from "./models.js";
import { Orchestrator } from "./orchestrator.js";
import { resolveSearchProvider } from "./search/index.js";
import type { SourceStore } from "./sources.js";
import { ResearchUI } from "./ui.js";
import { createSdkBackend } from "./worker/sdk-backend.js";
import { createSubprocessBackend } from "./worker/subprocess-backend.js";
import type { RunState } from "./types.js";

/** One active run at a time; the cancel shortcut aborts whatever is here. */
let activeRun: { abort: () => void; runId: string } | undefined;

export function abortActiveRun(): boolean {
  if (!activeRun) return false;
  activeRun.abort();
  return true;
}

export function hasActiveRun(): boolean {
  return activeRun !== undefined;
}

export async function handleResearchCommand(pi: ExtensionAPI, args: string, ctx: ExtensionCommandContext): Promise<void> {
  if (activeRun) {
    ctx.ui.notify("A research run is already in progress. Press the cancel shortcut to stop it first.", "warning");
    return;
  }

  const parsed = parseCommandArgs(args);
  const defaultOutDir = join(ctx.cwd, "research");
  let config: ResolvedConfig;
  try {
    config = resolveConfig({ flags: parsed.flags, defaultOutDir });
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return;
  }

  // Model tiering: keep planner/writer on the session model, drop worker/verifier to the
  // cheapest same-provider model, unless the user set a stage model explicitly.
  const agentDir = getAgentDir();
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json") });
  const sessionModel = { provider: ctx.model?.provider, model: ctx.model?.id };
  config.models = resolveStageModels(config.models, modelRuntime, sessionModel);

  // Resume: find the latest checkpoint in this session's branch.
  let resumeState: RunState | undefined;
  if (parsed.resume) {
    resumeState = latestRunState(ctx.sessionManager.getEntries(), parsed.resumeRunId);
    if (!resumeState) {
      ctx.ui.notify("No research checkpoint found in this session to resume.", "warning");
      return;
    }
  }

  const question = resumeState?.question ?? parsed.question;
  if (!question) {
    ctx.ui.notify('Usage: /research <question> [--depth quick|standard|deep] [--workers N] [--budget USD] ...', "warning");
    return;
  }

  let provider;
  try {
    provider = resolveSearchProvider(config.provider).provider;
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return;
  }

  const runId = resumeState?.runId ?? newRunId();
  const backend = createSdkBackend({ agentDir, cwd: ctx.cwd, modelRuntime });
  const ui = new ResearchUI(ctx.ui, ctx.hasUI, question);

  const makeResearchBackend =
    config.backend === "subprocess"
      ? (store: SourceStore, artifactDir: string) =>
          createSubprocessBackend({
            parentStore: store,
            artifactDir,
            provider: config.provider,
            maxFetchChars: config.maxFetchChars,
          })
      : undefined;

  const orchestrator = new Orchestrator(
    {
      ctx,
      appendEntry: (customType, data) => pi.appendEntry(customType, data),
      sendMessage: (message, options) => pi.sendMessage(message, options),
      config,
      provider,
      backend,
      makeResearchBackend,
      ui,
      runId,
      question,
    },
    resumeState,
  );

  activeRun = { abort: () => orchestrator.abort(), runId };
  try {
    const outcome = await orchestrator.run();
    if (outcome.stage === "complete") ui.notify(outcome.message, "info");
  } catch (error) {
    ctx.ui.notify(`Research error: ${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    activeRun = undefined;
    ui.clear();
  }
}

export function researchArgumentCompletions(argumentPrefix: string) {
  const tokens = argumentPrefix.split(/\s+/);
  const last = tokens[tokens.length - 1] ?? "";

  // Completing a value for an enum flag?
  const prevFlag = tokens.length >= 2 ? tokens[tokens.length - 2]?.replace(/^--/, "") : undefined;
  if (prevFlag && ENUM_FLAG_VALUES[prevFlag] && !last.startsWith("--")) {
    return ENUM_FLAG_VALUES[prevFlag]
      .filter((v) => v.startsWith(last))
      .map((v) => ({ value: v, label: v, description: `${prevFlag}=${v}` }));
  }

  if (last.startsWith("--")) {
    const stem = last.slice(2);
    const names = [...VALUE_FLAGS, ...BOOLEAN_FLAGS];
    return names
      .filter((n) => n.startsWith(stem))
      .map((n) => ({
        value: `--${n}`,
        label: `--${n}`,
        description: VALUE_FLAGS.has(n) ? "takes a value" : "flag",
      }));
  }
  return null;
}
