#!/usr/bin/env node
/**
 * ALCE-style citation precision/recall + dead-link rate + confidence-marker
 * hygiene + cost-Pareto reporter for pi-deep-research runs.
 *
 *   node scripts/eval.mjs <dir-or-manifest> [<dir-or-manifest> ...]
 *
 * If a directory is given, every manifest.json under .deep-research/<run>/ is
 * evaluated. Each row reports the run id and metrics; a final summary line
 * gives the macro-averages and a cost-Pareto frontier.
 *
 * Inputs (per run):  manifest.json + report.md
 * Outputs:           stdout TSV; stderr for warnings.
 *
 * Definitions
 * -----------
 * Citation precision = (citations whose [N] is valid AND lands inside one of
 *   the cited finding's sources_used) / total citations.
 * Citation recall    = (non-trivial declarative sentences that carry ≥1 [N])
 *   / total non-trivial declarative sentences. "Non-trivial" = ≥12 words,
 *   not a heading/bullet/quote/code-fence line.
 * Dead-link rate     = manifest.url_checks failures / total cited sources.
 * Confidence hygiene = (✓ + ◐ + ?) / non-trivial sentences (closer to 1.0
 *   means the writer attached a confidence marker to most claims).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";

const args = process.argv.slice(2);
if (!args.length) {
	console.error("usage: eval.mjs <dir-or-manifest> [...]");
	process.exit(2);
}

function findManifests(p) {
	const st = statSync(p);
	if (st.isFile()) return p.endsWith("manifest.json") ? [p] : [];
	const out = [];
	for (const e of readdirSync(p, { withFileTypes: true })) {
		const f = join(p, e.name);
		if (e.isDirectory()) out.push(...findManifests(f));
		else if (e.name === "manifest.json") out.push(f);
	}
	return out;
}

const CITE_RE = /\[(\d+)\](?:💀)?/g;
const STRIP = (s) => s.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
const isContent = (line) => {
	const t = line.trim();
	if (!t) return false;
	if (/^#{1,6}\s/.test(t)) return false;
	if (/^[-*+]\s|^>\s|^\|/.test(t)) return false;
	if (/^---+$|^===+$/.test(t)) return false;
	return true;
};
const sentences = (md) =>
	STRIP(md)
		.split("\n")
		.filter(isContent)
		.flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z0-9"])/))
		.map((s) => s.trim())
		.filter((s) => s.split(/\s+/).length >= 12);

function evalRun(manifestPath) {
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	const reportPath = m.run?.report_path || join(dirname(manifestPath), "report.md");
	let md;
	try { md = readFileSync(reportPath, "utf8"); } catch (e) { console.error(`skip ${manifestPath}: ${e.message}`); return null; }

	// Strip the disclosure frontmatter + blockquote — we score the body.
	const body = md.replace(/^---[\s\S]*?\n---\n/, "").replace(/^> .*$/gm, "");

	const sourcesN = (m.sources ?? []).length;
	const supportingForCite = new Map(); // N -> Set of sub_questions whose sources_used include N
	for (const f of m.findings ?? []) {
		const used = new Set((f.sources ?? []).map((s) => {
			const i = (m.sources ?? []).findIndex((x) => x.url?.replace(/[#?].*$/, "").replace(/\/$/, "") === s.url?.replace(/[#?].*$/, "").replace(/\/$/, ""));
			return i >= 0 ? i + 1 : null;
		}).filter((x) => x));
		for (const u of used) {
			if (!supportingForCite.has(u)) supportingForCite.set(u, new Set());
			supportingForCite.get(u).add(f.sub_question);
		}
	}

	let citeTotal = 0, citeValid = 0, citeSupported = 0;
	for (const match of body.matchAll(CITE_RE)) {
		citeTotal++;
		const n = +match[1];
		if (n >= 1 && n <= sourcesN) citeValid++;
		if (supportingForCite.has(n)) citeSupported++;
	}

	const sents = sentences(body);
	const sentsCited = sents.filter((s) => CITE_RE.test(s)).length;
	const conf = (body.match(/[✓◐?](?=\s)/g) ?? []).length;

	const deadTotal = (m.url_checks ?? []).length || sourcesN;
	const deadFail = (m.url_checks ?? []).filter((c) => !c.ok).length;

	const wordCount = body.split(/\s+/).filter(Boolean).length;
	const cost = m.usage?.cost ?? 0;
	const dur = m.run?.duration_ms ?? 0;

	return {
		id: m.run?.id ?? basename(dirname(manifestPath)),
		precision: citeTotal ? citeSupported / citeTotal : 0,
		validity: citeTotal ? citeValid / citeTotal : 0,
		recall: sents.length ? sentsCited / sents.length : 0,
		conf_hygiene: sents.length ? Math.min(1, conf / sents.length) : 0,
		dead_rate: deadTotal ? deadFail / deadTotal : 0,
		citations: citeTotal,
		sentences: sents.length,
		sources: sourcesN,
		words: wordCount,
		cost_usd: cost,
		duration_s: dur / 1000,
		cap_hit: !!m.run?.cost_cap_hit,
		preset: m.request?.preset ?? "",
	};
}

const rows = [];
for (const a of args) for (const p of findManifests(a)) {
	const r = evalRun(p);
	if (r) rows.push(r);
}
if (!rows.length) { console.error("no runs evaluated"); process.exit(1); }

const cols = ["id", "precision", "validity", "recall", "conf_hygiene", "dead_rate", "citations", "sentences", "sources", "words", "cost_usd", "duration_s", "cap_hit", "preset"];
const fmt = (k, v) => typeof v === "number" ? (k.endsWith("_rate") || ["precision", "validity", "recall", "conf_hygiene"].includes(k) ? v.toFixed(3) : k === "cost_usd" ? v.toFixed(4) : k === "duration_s" ? v.toFixed(1) : `${v}`) : `${v}`;
console.log(cols.join("\t"));
for (const r of rows) console.log(cols.map((c) => fmt(c, r[c])).join("\t"));

const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
console.log(`\n# macro-avg over ${rows.length} run(s):`);
console.log(`  precision:     ${mean("precision").toFixed(3)}    (cited [N] resolves to a finding whose sources_used contains N)`);
console.log(`  validity:      ${mean("validity").toFixed(3)}    (cited [N] is in [1, |sources|])`);
console.log(`  recall:        ${mean("recall").toFixed(3)}    (non-trivial sentences with ≥1 citation)`);
console.log(`  conf_hygiene:  ${mean("conf_hygiene").toFixed(3)}    (✓/◐/? marker per sentence, capped at 1)`);
console.log(`  dead_rate:     ${mean("dead_rate").toFixed(3)}    (HEAD-failed cited URLs / total)`);
console.log(`  cost_usd:      ${mean("cost_usd").toFixed(4)}`);
console.log(`  duration_s:    ${mean("duration_s").toFixed(1)}`);

// Cost-Pareto frontier (HAL-style): runs that are not dominated on (cost, -precision, -recall).
const dominated = new Set();
for (let i = 0; i < rows.length; i++) for (let j = 0; j < rows.length; j++) {
	if (i === j) continue;
	const a = rows[i], b = rows[j];
	if (b.cost_usd <= a.cost_usd && b.precision >= a.precision && b.recall >= a.recall && (b.cost_usd < a.cost_usd || b.precision > a.precision || b.recall > a.recall))
		dominated.add(i);
}
const frontier = rows.filter((_, i) => !dominated.has(i)).sort((a, b) => a.cost_usd - b.cost_usd);
if (frontier.length < rows.length) {
	console.log(`\n# cost-Pareto frontier (${frontier.length}/${rows.length}, sorted by cost):`);
	for (const r of frontier) console.log(`  $${r.cost_usd.toFixed(4)}  P=${r.precision.toFixed(3)}  R=${r.recall.toFixed(3)}  ${r.id}`);
}
