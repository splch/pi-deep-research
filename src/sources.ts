import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceRecord } from "./types.js";

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|ref)$/i;

export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  const remove: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (TRACKING_PARAM.test(key)) remove.push(key);
  });
  for (const key of remove) url.searchParams.delete(key);
  url.searchParams.sort();
  let out = url.toString();
  if (out.endsWith("/") && url.pathname !== "/" && !url.search) out = out.slice(0, -1);
  return out;
}

export interface RegisterSourceInput {
  url: string;
  finalUrl: string;
  title?: string;
  httpStatus: number;
  contentType?: string;
  fullText: string;
  byAngle: string;
  truncated: boolean;
  excerptChars: number;
}

/**
 * Deduplicating registry of fetched sources. Full extracted text goes to an
 * artifact file; the in-memory record is what checkpoints and citation checks use.
 */
export class SourceStore {
  private readonly byNorm = new Map<string, SourceRecord>();
  private readonly byHash = new Map<string, SourceRecord>();
  /** Canonical records in registration order, keyed by id. */
  private readonly byId = new Map<string, SourceRecord>();
  private counter = 0;

  constructor(readonly artifactDir: string) {
    mkdirSync(join(artifactDir, "sources"), { recursive: true });
  }

  register(input: RegisterSourceInput): SourceRecord {
    const contentHash = createHash("sha256").update(input.fullText).digest("hex");
    const normFinal = safeNormalize(input.finalUrl) ?? input.finalUrl;
    const normRequested = safeNormalize(input.url) ?? input.url;
    const existing = this.byNorm.get(normFinal) ?? this.byNorm.get(normRequested) ?? this.byHash.get(contentHash);
    if (existing) {
      this.byNorm.set(normRequested, existing);
      this.byNorm.set(normFinal, existing);
      return existing;
    }
    this.counter++;
    const id = `s${this.counter}`;
    const rawPath = join(this.artifactDir, "sources", `${id}.txt`);
    writeFileSync(rawPath, input.fullText, "utf8");
    const record: SourceRecord = {
      id,
      url: input.url,
      finalUrl: input.finalUrl,
      domain: new URL(input.finalUrl).hostname.toLowerCase(),
      title: input.title,
      httpStatus: input.httpStatus,
      contentType: input.contentType,
      contentHash,
      rawPath,
      excerptChars: input.excerptChars,
      truncated: input.truncated,
      fetchedAt: new Date().toISOString(),
      byAngle: input.byAngle,
    };
    this.byNorm.set(normRequested, record);
    this.byNorm.set(normFinal, record);
    this.byHash.set(contentHash, record);
    this.byId.set(id, record);
    return record;
  }

  has(url: string): boolean {
    const norm = safeNormalize(url);
    return norm !== undefined && this.byNorm.has(norm);
  }

  get(url: string): SourceRecord | undefined {
    const norm = safeNormalize(url);
    return norm === undefined ? undefined : this.byNorm.get(norm);
  }

  getById(id: string): SourceRecord | undefined {
    return this.byId.get(id);
  }

  readFullText(record: SourceRecord): string {
    return readFileSync(record.rawPath, "utf8");
  }

  all(): SourceRecord[] {
    return [...this.byId.values()];
  }

  get size(): number {
    return this.byId.size;
  }

  persist(filePath: string): void {
    writeFileSync(filePath, JSON.stringify(this.all(), null, 2), "utf8");
  }

  /**
   * Merge records from another store's persisted sources.json (e.g. a subprocess
   * worker's). Dedups by content hash; keeps each record's absolute rawPath, which
   * still resolves because worker artifacts live under the same run directory.
   */
  absorb(sourcesJsonPath: string): number {
    let records: SourceRecord[];
    try {
      records = JSON.parse(readFileSync(sourcesJsonPath, "utf8")) as SourceRecord[];
    } catch {
      return 0;
    }
    let added = 0;
    for (const record of records) {
      if (this.byHash.has(record.contentHash)) continue;
      this.counter++;
      const local: SourceRecord = { ...record, id: `s${this.counter}` };
      this.byHash.set(local.contentHash, local);
      this.byId.set(local.id, local);
      const normFinal = safeNormalize(local.finalUrl);
      const normRequested = safeNormalize(local.url);
      if (normFinal) this.byNorm.set(normFinal, local);
      if (normRequested) this.byNorm.set(normRequested, local);
      added++;
    }
    return added;
  }

  static load(filePath: string, artifactDir: string): SourceStore {
    const store = new SourceStore(artifactDir);
    const records = JSON.parse(readFileSync(filePath, "utf8")) as SourceRecord[];
    for (const record of records) {
      store.byHash.set(record.contentHash, record);
      store.byId.set(record.id, record);
      const normFinal = safeNormalize(record.finalUrl);
      const normRequested = safeNormalize(record.url);
      if (normFinal) store.byNorm.set(normFinal, record);
      if (normRequested) store.byNorm.set(normRequested, record);
      const numeric = Number(record.id.replace(/^s/, ""));
      if (Number.isFinite(numeric)) store.counter = Math.max(store.counter, numeric);
    }
    return store;
  }
}

function safeNormalize(raw: string): string | undefined {
  try {
    return normalizeUrl(raw);
  } catch {
    return undefined;
  }
}
