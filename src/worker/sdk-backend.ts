import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  resolveCliModel,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  ResearchBackend,
  WorkerProgress,
  WorkerResult,
  WorkerRunSpec,
  WorkerStatus,
  WorkerUsage,
} from "./interface.js";

export interface SdkBackendDeps {
  agentDir: string;
  cwd: string;
  modelRegistry?: ModelRegistry;
}

const EMPTY_USAGE: WorkerUsage = { costUSD: 0, tokensIn: 0, tokensOut: 0, turns: 0 };

function lastAssistantText(messages: AgentMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const text = msg.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * In-process worker backend. Each worker gets its own AgentSession with an
 * in-memory session store, a fully-replaced system prompt, and ONLY the custom
 * tools passed in - no built-ins, no user extensions/skills/context files. This
 * is the isolation + injection boundary: a worker has no shell, no filesystem,
 * and cannot load another extension that might grant those.
 */
export function createSdkBackend(deps: SdkBackendDeps): ResearchBackend {
  let sharedRegistry = deps.modelRegistry;

  return {
    name: "sdk",
    async runWorker<T>(
      spec: WorkerRunSpec<T>,
      signal: AbortSignal | undefined,
      onProgress?: (progress: WorkerProgress) => void,
    ): Promise<WorkerResult<T>> {
      const sink = spec.result;

      const loader = new DefaultResourceLoader({
        cwd: deps.cwd,
        agentDir: deps.agentDir,
        settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        systemPrompt: spec.systemPrompt,
      });
      await loader.reload();

      if (!sharedRegistry) {
        sharedRegistry = ModelRegistry.create(AuthStorage.create(`${deps.agentDir}/auth.json`));
      }
      const modelRegistry = sharedRegistry;
      const resolved = resolveCliModel({
        cliProvider: spec.model.provider,
        cliModel: spec.model.model,
        cliThinking: spec.model.thinkingLevel,
        modelRegistry,
      });
      if (resolved.error) {
        return { label: spec.label, status: "error", usage: { ...EMPTY_USAGE }, error: resolved.error };
      }

      const { session } = await createAgentSession({
        cwd: deps.cwd,
        agentDir: deps.agentDir,
        modelRegistry,
        model: resolved.model,
        thinkingLevel: resolved.thinkingLevel ?? spec.model.thinkingLevel,
        tools: spec.toolNames,
        customTools: spec.customTools,
        resourceLoader: loader,
        sessionManager: SessionManager.inMemory(deps.cwd),
        settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
      });

      const usage: WorkerUsage = { ...EMPTY_USAGE };
      let capHit = false;
      let errorMessage: string | undefined;

      const unsubscribe = session.subscribe((event) => {
        if (event.type === "message_end" && event.message.role === "assistant") {
          const u = event.message.usage;
          usage.turns++;
          usage.tokensIn += u.input + u.cacheRead + u.cacheWrite;
          usage.tokensOut += u.output;
          usage.costUSD += u.cost.total;
          onProgress?.({ label: spec.label, turns: usage.turns, costUSD: usage.costUSD });
          if (usage.turns >= spec.turnCap && !sink.settled) {
            capHit = true;
            void session.abort();
          }
        }
      });

      const onOuterAbort = () => void session.abort();
      signal?.addEventListener("abort", onOuterAbort, { once: true });
      const wallTimer = setTimeout(() => {
        capHit = true;
        void session.abort();
      }, spec.wallClockMs);

      try {
        if (signal?.aborted) {
          await session.abort();
        } else {
          // Whichever resolves first: the run completes, or the terminating tool fires.
          await Promise.race([session.prompt(spec.task), sink.promise.then(() => session.abort())]);
        }
      } catch (error) {
        if (!sink.settled) errorMessage = error instanceof Error ? error.message : String(error);
      } finally {
        clearTimeout(wallTimer);
        signal?.removeEventListener("abort", onOuterAbort);
        unsubscribe();
      }

      const result = sink.settled ? await sink.promise : undefined;
      let status: WorkerStatus;
      let salvagedText: string | undefined;
      if (result !== undefined) {
        status = "ok";
      } else {
        salvagedText = lastAssistantText(session.state.messages);
        if (signal?.aborted) status = "aborted";
        else if (capHit) status = "capped";
        else if (errorMessage) status = "error";
        else status = salvagedText ? "salvaged" : "error";
      }

      session.dispose();

      return {
        label: spec.label,
        status,
        result,
        salvagedText: result === undefined ? salvagedText : undefined,
        usage,
        error: errorMessage,
      };
    },
  };
}
