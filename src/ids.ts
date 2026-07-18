import { randomBytes } from "node:crypto";

export function newRunId(): string {
  // Sortable-ish: base36 time prefix + short random suffix.
  return `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function slugify(text: string, maxLen = 60): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return slug || "research";
}

export function angleId(index: number): string {
  return `a${index + 1}`;
}

export function claimId(index: number): string {
  return `c${index + 1}`;
}
