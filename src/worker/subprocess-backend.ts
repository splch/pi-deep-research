import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { SourceStore } from "../sources.js";
import type { SubmitFindingsPayload } from "../types.js";
import type {
  ResearchBackend,
  WorkerProgress,
  WorkerResult,
  WorkerRunSpec,
  WorkerStatus,
  WorkerUsage,
} from "./interface.js";

const WORKER_ENTRY = fileURLToPath(new URL("./worker-entry.ts", import.meta.url));

export interface SubprocessBackendDeps {
  /** Parent store to merge each worker's fetched sources into (keeps citation integrity intact). */
  parentStore: SourceStore;
  /** Run artifact dir; per-worker subdirs are created under it. */
  artifactDir: string;
  provider?: string;
  maxFetchChars: number;
  piBin?: string;
}

interface JsonEvent {
  type?: string;
  message?: { role?: string; usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; cost?: { total: number } } };
}

/**
 * Runs research workers as isolated child `pi` processes (OS-level isolation on top
 * of the tool-level isolation the SDK backend already provides). ONLY supports the
 * research worker shape (web tools + submit_findings); planner/verify/write stay
 * in-process because their terminating tools capture in-process deferreds.
 */
export function createSubprocessBackend(deps: SubprocessBackendDeps): ResearchBackend {
  const piBin = deps.piBin ?? process.env.PI_DR_PI_BIN ?? "pi";

  return {
    name: "subprocess",
    async runWorker<T>(
      spec: WorkerRunSpec<T>,
      signal: AbortSignal | undefined,
      onProgress?: (progress: WorkerProgress) => void,
    ): Promise<WorkerResult<T>> {
      const workerDir = join(deps.artifactDir, "workers", spec.label);
      mkdirSync(workerDir, { recursive: true });
      const resultPath = join(workerDir, "result.json");
      const sourcesPath = join(workerDir, "sources.json");
      if (existsSync(resultPath)) rmSync(resultPath);

      const args = [
        "-e",
        WORKER_ENTRY,
        // Isolation: load ONLY worker-entry, none of the user's global extensions/skills/context.
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-context-files",
        "--mode",
        "json",
        "-p",
        "--no-session",
        "--tools",
        "web_search,fetch_url,submit_findings",
      ];
      if (spec.model.provider) args.push("--provider", spec.model.provider);
      if (spec.model.model) args.push("--model", spec.model.model);
      if (spec.model.thinkingLevel) args.push("--thinking", spec.model.thinkingLevel);
      args.push(spec.task);

      const usage: WorkerUsage = { costUSD: 0, tokensIn: 0, tokensOut: 0, turns: 0 };
      let capHit = false;
      let stderr = "";

      const child = spawn(piBin, args, {
        cwd: workerDir,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PI_DR_WORKER_DIR: workerDir,
          PI_DR_ANGLE_ID: spec.label,
          PI_DR_MAX_FETCH: String(deps.maxFetchChars),
          ...(deps.provider ? { PI_DR_PROVIDER: deps.provider } : {}),
        },
      });

      const wallTimer = setTimeout(() => {
        capHit = true;
        child.kill("SIGTERM");
      }, spec.wallClockMs);
      const onAbort = () => child.kill("SIGTERM");
      signal?.addEventListener("abort", onAbort, { once: true });

      let buffer = "";
      const handleLine = (line: string): void => {
        if (!line.trim()) return;
        let event: JsonEvent;
        try {
          event = JSON.parse(line) as JsonEvent;
        } catch {
          return;
        }
        if (event.type === "message_end" && event.message?.role === "assistant" && event.message.usage) {
          const u = event.message.usage;
          usage.turns++;
          usage.tokensIn += u.input + u.cacheRead + u.cacheWrite;
          usage.tokensOut += u.output;
          usage.costUSD += u.cost?.total ?? 0;
          onProgress?.({ label: spec.label, turns: usage.turns, costUSD: usage.costUSD });
          if (usage.turns >= spec.turnCap) {
            capHit = true;
            child.kill("SIGTERM");
          }
        }
      };
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          handleLine(line);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const exitCode: number | null = await new Promise((resolve) => {
        child.on("close", (code) => resolve(code));
        child.on("error", () => resolve(-1));
      });
      clearTimeout(wallTimer);
      signal?.removeEventListener("abort", onAbort);
      handleLine(buffer); // flush a final unterminated stdout line so its usage isn't dropped

      // Merge this worker's fetched sources into the parent store for citation integrity.
      deps.parentStore.absorb(sourcesPath);

      let payload: SubmitFindingsPayload | undefined;
      if (existsSync(resultPath)) {
        try {
          payload = JSON.parse(readFileSync(resultPath, "utf8")) as SubmitFindingsPayload;
        } catch {
          payload = undefined;
        }
      }

      let status: WorkerStatus;
      if (payload) status = "ok";
      else if (signal?.aborted) status = "aborted";
      else if (capHit) status = "capped";
      else status = "error";

      return {
        label: spec.label,
        status,
        result: payload as T | undefined,
        salvagedText: undefined,
        usage,
        error: payload ? undefined : `subprocess exited ${exitCode}${stderr ? `: ${stderr.slice(0, 300)}` : ""}`,
      };
    },
  };
}
