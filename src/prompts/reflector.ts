import type { AngleOutcome, Finding, ResearchPlan } from "../types.js";

export function reflectorSystemPrompt(): string {
  return [
    "You are the reflection stage of a deep-research pipeline. Research workers have finished a first",
    "pass over the planned angles; you judge whether their combined findings actually answer the question.",
    "You do NOT research: you have no web access and no tools other than submit_reflection.",
    "",
    "Assess three things:",
    "- Coverage: which goals or sub-questions are NOT adequately answered by the findings (thin angles,",
    "  dead ends, missing perspectives). List each as a concrete gap.",
    "- Conflicts: findings that contradict each other and remain unresolved. State both sides briefly.",
    "- Follow-ups: when gaps exist, propose up to 4 NEW research angles that would close them. Each needs",
    "  a distinct perspective and concrete seed queries, and must NOT duplicate angles already investigated.",
    "",
    "Be strict but economical: a full-coverage pass returns empty gaps and empty followUpAngles.",
    "Only propose follow-up angles for gaps that materially affect answering the question.",
    "Call submit_reflection exactly once.",
  ].join("\n");
}

export interface ReflectorInputs {
  plan: ResearchPlan;
  outcomes: AngleOutcome[];
  findings: Finding[];
  /** Iteration about to run (1-based) and the hard cap, so the reflector spends its proposals wisely. */
  iteration: number;
  maxIters: number;
}

const CLAIM_CHARS = 240;

/** Compact reflector task: goals + per-angle outcomes + claim texts only (no excerpts, no citations). */
export function reflectorTaskMessage(inputs: ReflectorInputs): string {
  const { plan, outcomes, findings, iteration, maxIters } = inputs;
  const outcomeByAngle = new Map(outcomes.map((o) => [o.angleId, o]));

  const lines: string[] = [
    `Research question: ${plan.brief.refinedQuestion}`,
    "",
    ...(plan.brief.goals.length > 0 ? [`Goals: ${plan.brief.goals.join("; ")}`, ""] : []),
    "## Angles investigated",
  ];

  for (const angle of plan.angles) {
    const outcome = outcomeByAngle.get(angle.id);
    const status = outcome ? `${outcome.status}, ${outcome.findingCount} finding(s)` : "no outcome recorded";
    lines.push(`- ${angle.title} (${status})${outcome?.notes ? ` — worker notes: ${outcome.notes.slice(0, 200)}` : ""}`);
  }

  lines.push("", "## Findings gathered");
  if (findings.length === 0) {
    lines.push("(none)");
  }
  for (const f of findings) {
    lines.push(`- [${f.angleId}] ${f.claim.slice(0, CLAIM_CHARS)}`);
  }

  lines.push(
    "",
    `This is reflection pass ${iteration} of at most ${maxIters}.`,
    "Call submit_reflection now with gaps, conflicts, and any follow-up angles worth one more bounded research fan-out.",
  );
  return lines.join("\n");
}
