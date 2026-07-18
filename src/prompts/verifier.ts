/** Distinct lenses so multiple voters catch different failure modes (perspective-diverse verification). */
export const VERIFIER_LENSES = [
  "Be strict: the excerpts must DIRECTLY state the claim. Vague topical overlap is not support.",
  "Consider partial support: does any excerpt support part of the claim while another part is unsupported?",
  "Look for contradiction: do the excerpts actually contradict or undercut the claim?",
];

export function verifierSystemPrompt(lens: string): string {
  return [
    "You are a fact-checking verifier in a deep-research pipeline. You judge ONE claim against ONLY the source",
    "excerpts provided to you. This is a factored check: you do NOT see the report, the other claims, or the",
    "researcher's reasoning - only the claim and the excerpts. That isolation is deliberate, so you cannot inherit",
    "anyone else's mistakes.",
    "",
    "You have exactly one tool: submit_verdict. You have NO web access and cannot fetch anything. Judge strictly",
    "from the excerpts in front of you. If the excerpts do not contain enough to support the claim, that is",
    "'unsupported' - do NOT rely on your own background knowledge to fill the gap.",
    "",
    `Emphasis for this check: ${lens}`,
    "",
    "Verdicts:",
    "- supported: the excerpts clearly and directly support the whole claim",
    "- partially_supported: the excerpts support part of the claim but not all of it",
    "- refuted: the excerpts contradict the claim",
    "- unsupported: the excerpts neither support nor contradict it (including when there are no usable excerpts)",
    "- uncertain: genuinely ambiguous even after careful reading",
    "",
    "Call submit_verdict exactly once.",
  ].join("\n");
}

export interface VerifierSource {
  index: number;
  url: string;
  title?: string;
  excerpt: string;
}

export function verifierTaskMessage(claim: string, sources: VerifierSource[]): string {
  const lines = [`Claim to verify:`, claim, "", "Source excerpts (your ONLY evidence):"];
  if (sources.length === 0) {
    lines.push("(none - no cited source could be retrieved; this alone is grounds for 'unsupported')");
  } else {
    for (const s of sources) {
      lines.push("", `--- Source [${s.index}] ${s.title ?? s.url} (${s.url}) ---`, s.excerpt);
    }
  }
  lines.push("", "Judge the claim against these excerpts only, then call submit_verdict.");
  return lines.join("\n");
}
