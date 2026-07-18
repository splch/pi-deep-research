import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { angleId } from "../ids.js";
import type { ResearchAngle, ResearchPlan } from "../types.js";

export type GateDecision =
  | { action: "run"; plan: ResearchPlan }
  | { action: "regenerate"; note: string }
  | { action: "cancel" };

const RUN = "Run it";
const EDIT = "Edit the plan";
const REGEN = "Regenerate (add guidance)";
const CANCEL = "Cancel";

/** Render a plan into an editable text block. */
export function serializePlan(plan: ResearchPlan): string {
  const lines: string[] = [
    "# Refined question",
    plan.brief.refinedQuestion,
    "",
    "# Angles",
    "# one per line: title :: perspective :: seed query; seed query",
  ];
  for (const angle of plan.angles) {
    const parts = [angle.title, angle.perspective ?? "", angle.seedQueries.join("; ")];
    lines.push(`- ${parts.join(" :: ")}`);
  }
  return lines.join("\n");
}

/** Parse an edited plan text back, reusing rationale/priority from the original angle at the same position. */
export function parsePlanEdits(text: string, original: ResearchPlan): ResearchPlan {
  const lines = text.split("\n");
  let section: "question" | "angles" | undefined;
  const questionLines: string[] = [];
  const angleLines: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^#\s*refined question/i.test(line)) {
      section = "question";
      continue;
    }
    if (/^#\s*angles/i.test(line)) {
      section = "angles";
      continue;
    }
    if (line.startsWith("#")) continue; // comment/hint lines
    if (section === "question") {
      if (line.trim()) questionLines.push(line.trim());
    } else if (section === "angles") {
      const stripped = line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim();
      if (stripped) angleLines.push(stripped);
    }
  }

  const angles: ResearchAngle[] = angleLines.map((entry, i) => {
    const [title = "", perspective = "", seeds = ""] = entry.split("::").map((s) => s.trim());
    const prior = original.angles[i];
    const seedQueries = seeds
      ? seeds.split(";").map((s) => s.trim()).filter(Boolean)
      : (prior?.seedQueries ?? []);
    return {
      id: angleId(i),
      title: title || prior?.title || `Angle ${i + 1}`,
      rationale: prior?.rationale ?? "(edited by user)",
      perspective: perspective || prior?.perspective,
      seedQueries: seedQueries.length > 0 ? seedQueries : [title || "research"],
      priority: prior?.priority ?? i + 1,
    };
  });

  const refinedQuestion = questionLines.join(" ").trim() || original.brief.refinedQuestion;
  return {
    ...original,
    brief: { ...original.brief, refinedQuestion },
    angles: angles.length > 0 ? angles : original.angles,
    confirmedByUser: true,
  };
}

/** Interactive plan-confirm gate. Loops edit; returns run/regenerate/cancel. */
export async function confirmPlan(ui: ExtensionUIContext, initial: ResearchPlan): Promise<GateDecision> {
  let plan = initial;
  for (;;) {
    const summary = [
      `Refined: ${plan.brief.refinedQuestion}`,
      ...plan.angles.map((a, i) => `${i + 1}. ${a.title}${a.perspective ? ` [${a.perspective}]` : ""}`),
    ].join("\n");
    const choice = await ui.select(`Research plan (${plan.angles.length} angles)\n${summary}`, [
      RUN,
      EDIT,
      REGEN,
      CANCEL,
    ]);

    if (choice === undefined || choice === CANCEL) return { action: "cancel" };
    if (choice === RUN) return { action: "run", plan: { ...plan, confirmedByUser: true } };
    if (choice === REGEN) {
      const note = await ui.input("Guidance for the planner (what to change or focus on):");
      if (note && note.trim()) return { action: "regenerate", note: note.trim() };
      continue;
    }
    if (choice === EDIT) {
      const edited = await ui.editor("Edit the research plan", serializePlan(plan));
      if (edited && edited.trim()) plan = parsePlanEdits(edited, plan);
    }
  }
}
