import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import { messagesToContextText } from "../src/session-context.js";

const user = (text: string): AgentMessage => ({ role: "user", content: [{ type: "text", text }], timestamp: 0 }) as AgentMessage;
const assistant = (text: string): AgentMessage => ({ role: "assistant", content: [{ type: "text", text }], timestamp: 0 }) as AgentMessage;
const toolResult = (): AgentMessage => ({ role: "toolResult", content: [{ type: "text", text: "noise" }], timestamp: 0 }) as unknown as AgentMessage;

describe("messagesToContextText", () => {
  it("renders user/assistant turns in order, skipping tool noise and the /research invocation", () => {
    const ctx = messagesToContextText([
      user("tell me about library X"),
      assistant("library X is a parser combinator toolkit…"),
      toolResult(),
      user("/research how does library X handle left recursion"),
    ]);
    expect(ctx).toBe("User: tell me about library X\n\nAssistant: library X is a parser combinator toolkit…");
  });

  it("returns undefined when there is no usable prior conversation", () => {
    expect(messagesToContextText([user("/research why is the sky blue")])).toBeUndefined();
    expect(messagesToContextText([])).toBeUndefined();
  });

  it("drops oldest turns first when over budget", () => {
    const ctx = messagesToContextText([user("a".repeat(100)), assistant("b".repeat(100)), user("c".repeat(50))], 120);
    expect(ctx).toContain("c".repeat(50));
    expect(ctx).not.toContain("a".repeat(100));
    expect(ctx!.length).toBeLessThanOrEqual(120);
  });

  it("keeps the tail of the newest message even when it alone exceeds the budget", () => {
    const ctx = messagesToContextText([user("x".repeat(500))], 100);
    expect(ctx).toHaveLength(100);
    expect(ctx).toContain("…");
  });
});
