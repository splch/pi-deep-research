export interface ParsedArgs {
  question: string;
  flags: Record<string, string | boolean>;
  resume: boolean;
  resumeRunId?: string;
}

/** Flags that take a value; everything else prefixed with -- is boolean. */
export const VALUE_FLAGS = new Set([
  "depth",
  "workers",
  "votes",
  "provider",
  "budget",
  "planner",
  "worker",
  "verifier",
  "writer",
  "out",
  "backend",
  "turn-cap",
  "wall-secs",
  "max-fetch",
  "max-iters",
]);

export const BOOLEAN_FLAGS = new Set(["no-verify", "yes", "resume"]);

export const ENUM_FLAG_VALUES: Record<string, string[]> = {
  depth: ["quick", "standard", "deep"],
  provider: ["tavily", "exa", "brave"],
  backend: ["sdk", "subprocess"],
};

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens;
}

export function parseCommandArgs(input: string): ParsedArgs {
  const tokens = tokenize(input.trim());
  const flags: Record<string, string | boolean> = {};
  const questionParts: string[] = [];
  let resumeRunId: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.startsWith("--")) {
      const name = token.slice(2);
      if (VALUE_FLAGS.has(name)) {
        const value = tokens[i + 1];
        if (value !== undefined && !value.startsWith("--")) {
          flags[name] = value;
          i++;
        } else {
          flags[name] = "";
        }
      } else {
        flags[name] = true;
        // --resume may be followed by an optional run id
        if (name === "resume") {
          const value = tokens[i + 1];
          if (value !== undefined && !value.startsWith("--")) {
            resumeRunId = value;
            i++;
          }
        }
      }
    } else {
      questionParts.push(token);
    }
  }

  return {
    question: questionParts.join(" ").trim(),
    flags,
    resume: flags.resume === true,
    resumeRunId,
  };
}
