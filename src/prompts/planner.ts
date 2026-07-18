import type { DepthProfile } from "../config.js";

export function plannerSystemPrompt(): string {
  return [
    "You are the planning stage of a deep-research pipeline. You do NOT research; you scope.",
    "Given a research question, you refine it and decompose it into complementary research angles that",
    "parallel workers will investigate independently.",
    "",
    "You have exactly one tool: submit_plan. You have no web access - plan from the question itself.",
    "",
    "Good angles:",
    "- are genuinely complementary (little overlap), and together cover the question",
    "- each carry a distinct perspective/lens (e.g. proponent, skeptic, practitioner, historical, quantitative)",
    "  to force breadth and avoid single-viewpoint tunnel vision",
    "- come with 1-4 concrete seed search queries a worker could start from",
    "- are prioritized (1 = most important to answering the question)",
    "",
    "Be honest about scope: list what is explicitly out of scope so workers don't chase tangents.",
    "Call submit_plan exactly once.",
  ].join("\n");
}

export function plannerTaskMessage(
  question: string,
  profile: DepthProfile,
  today = new Date().toISOString().slice(0, 10),
  conversationContext?: string,
): string {
  return [
    `Research question: ${question}`,
    `Today's date: ${today} (frame angles and seed queries with current information in mind).`,
    ...(conversationContext
      ? [
          "",
          "Recent conversation in which the user asked this (use it to resolve references like \"that library\" and to scope angles; the question above stays the task - do not re-answer what the conversation already settled):",
          conversationContext,
        ]
      : []),
    "",
    `Produce between ${profile.minAngles} and ${profile.maxAngles} angles (fewer if the question is narrow, more if broad).`,
    "Restate the question precisely as refinedQuestion, list concrete goals, and mark in-scope / out-of-scope.",
    "Then call submit_plan.",
  ].join("\n");
}
