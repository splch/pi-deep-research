import { describe, expect, it } from "vitest";
import { parseCommandArgs } from "../src/args.js";

describe("parseCommandArgs", () => {
  it("separates the question from flags", () => {
    const p = parseCommandArgs("How do A and B compare for C? --workers 3 --no-verify");
    expect(p.question).toBe("How do A and B compare for C?");
    expect(p.flags.workers).toBe("3");
    expect(p.flags["no-verify"]).toBe(true);
    expect(p.resume).toBe(false);
  });

  it("honors quoted questions and value flags", () => {
    const p = parseCommandArgs('"exact quoted question" --provider exa --budget 1.50');
    expect(p.question).toBe("exact quoted question");
    expect(p.flags.provider).toBe("exa");
    expect(p.flags.budget).toBe("1.50");
  });

  it("parses --resume with an optional run id", () => {
    const withId = parseCommandArgs("--resume abc123");
    expect(withId.resume).toBe(true);
    expect(withId.resumeRunId).toBe("abc123");
    const bare = parseCommandArgs("--resume");
    expect(bare.resume).toBe(true);
    expect(bare.resumeRunId).toBeUndefined();
  });

  it("treats a value flag with no value as empty string", () => {
    const p = parseCommandArgs("question --depth");
    expect(p.flags.depth).toBe("");
  });
});
