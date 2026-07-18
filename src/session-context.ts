import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { buildSessionContext, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

/** Cap on injected conversation text so the planner prompt stays small. */
export const MAX_CONTEXT_CHARS = 6000;

function messageText(message: AgentMessage): string | undefined {
  if (message.role !== "user" && message.role !== "assistant") return undefined;
  const content = message.content;
  const text = (typeof content === "string" ? content : content.filter((p) => p.type === "text").map((p) => p.text).join("\n")).trim();
  return text || undefined;
}

/**
 * Render recent conversation as labeled "User:"/"Assistant:" blocks, newest messages
 * prioritized, dropping tool noise and the /research invocation itself. Returns
 * undefined when the session has no usable prior conversation.
 */
export function messagesToContextText(messages: AgentMessage[], maxChars = MAX_CONTEXT_CHARS): string | undefined {
  const blocks: string[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    const text = messageText(message);
    if (!text) continue;
    if (message.role === "user" && text.startsWith("/research")) continue; // the invocation adds no information
    const block = `${message.role === "user" ? "User" : "Assistant"}: ${text}`;
    if (total + block.length > maxChars) {
      // Always keep at least the tail of the newest usable message.
      if (blocks.length === 0) blocks.push(`…${block.slice(-(maxChars - 1))}`);
      break;
    }
    blocks.push(block);
    total += block.length;
  }
  return blocks.length > 0 ? blocks.reverse().join("\n\n") : undefined;
}

/** Recent conversation from the live pi session, for grounding the planner. */
export function recentConversationContext(sessionManager: ExtensionCommandContext["sessionManager"], maxChars = MAX_CONTEXT_CHARS): string | undefined {
  const { messages } = buildSessionContext(sessionManager.getEntries());
  return messagesToContextText(messages, maxChars);
}
