/**
 * Smoke test for pure helpers + extension entry. Run via: `node scripts/smoke.mjs`.
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "pi-dr-smoke-"));
copyFileSync(new URL("../package.json", import.meta.url), join(dir, "package.json"));
const src = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

const stubbed =
	src
		.replace(/^import type { ExtensionAPI } from "@mariozechner\/pi-coding-agent";$/m, "")
		.replace(/^import { Text } from "@mariozechner\/pi-tui";$/m, "const Text = class { constructor(){} };")
		.replace(/^import { Type } from "typebox";$/m, "const Type = new Proxy({}, { get: () => () => ({}) });") +
	`\nexport { exfilCheck, hostMatches, htmlToText, parsePlan, parseWorker, dedupeSources, mergePreset, briefBlock, slugify, hashFinding, canonicalUrl, PRESETS };\n`;

const tsSrc = join(dir, "src.ts");
writeFileSync(tsSrc, stubbed);
execSync(
	`./node_modules/.bin/tsc --module esnext --target es2022 --moduleResolution bundler --types node --strict false --skipLibCheck --noCheck --outDir ${dir} ${tsSrc}`,
	{ stdio: "inherit" },
);
const m = await import(join(dir, "src.js"));

// exfilCheck (throws on refusal, returns URL on success)
const exfilOk = (u) => {
	try { m.exfilCheck(u); return true; } catch { return false; }
};
const exfilReason = (u) => {
	try { m.exfilCheck(u); return null; } catch (e) { return e.message; }
};
assert.equal(exfilOk("https://example.com/page"), true, "plain URL");
assert.equal(exfilOk("https://example.com/p?utm_source=foo"), true, "utm allowed");
assert.match(exfilReason("https://example.com/p?api_key=xxx") ?? "", /api/i, "api_key blocked");
assert.match(exfilReason("https://example.com/p?access_token=zzz") ?? "", /token/i, "access_token blocked");
assert.match(exfilReason("https://example.com/p?password=hi") ?? "", /password/i, "password blocked");
assert.match(exfilReason("https://example.com/p?bearer=tok") ?? "", /bearer/i, "bearer blocked");
assert.match(exfilReason("ftp://example.com/x") ?? "", /protocol/i, "non-http blocked");
assert.match(exfilReason("https://example.com/p?key=" + "a".repeat(400)) ?? "", /opaque/i, "long blob blocked");
assert.equal(exfilOk("https://example.com/?author=Smith"), true, "author NOT confused with auth");

// hostMatches
assert.equal(m.hostMatches("example.com", []), true, "empty allowlist passes everything");
assert.equal(m.hostMatches("example.com", ["example.com"]), true, "exact match");
assert.equal(m.hostMatches("docs.example.com", ["example.com"]), true, "subdomain match");
assert.equal(m.hostMatches("evil.com", ["example.com"]), false, "non-match");
assert.equal(m.hostMatches("a.gov", ["*.gov"]), true, "*.gov pattern");

// htmlToText
assert.equal(m.htmlToText("<p>Hello <b>world</b></p><script>x=1</script>").includes("Hello"), true, "preserves text");
assert.equal(m.htmlToText("<script>bad</script>").trim(), "", "script tags stripped");

// parsePlan
const p = m.parsePlan('Some prose\n{"effort_tier":"comparison","sub_questions":["a","b"]}\n');
assert.equal(p.tier, "comparison", "tier parsed");
assert.deepEqual(p.subs, ["a", "b"], "subs parsed");
assert.deepEqual(m.parsePlan("no json here").subs, [], "no-json fallback");

// parseWorker
const w = m.parseWorker(
	'```json\n{"sub_question":"q","summary":"s","key_facts":[],"sources":[{"url":"https://x.com","title":"t"}],"disagreements":[]}\n```',
);
assert.equal(w.sub_question, "q");
assert.equal(w.sources.length, 1);

// dedupeSources
const ds = m.dedupeSources([
	{ url: "https://a.com/x", title: "T1" },
	{ url: "https://a.com/x?ref=1", title: "T1-dup" },
	{ url: "https://a.com/x/", title: "T1-dup2" },
	{ url: "https://b.com/y", title: "T2" },
]);
assert.equal(ds.length, 2, "dedupe collapses query/trailing slash");

const dsCap = m.dedupeSources(
	[
		{ url: "https://a.com/1", title: "T1" },
		{ url: "https://a.com/2", title: "T2" },
		{ url: "https://a.com/3", title: "T3" },
		{ url: "https://b.com/y", title: "T4" },
	],
	2,
);
assert.equal(dsCap.length, 3, "max_per_host caps a.com to 2 + 1 from b.com");

// mergePreset
const merged = m.mergePreset({ source_prefer: ["x"] }, "legal");
assert.equal(merged.preset.name, "legal");
assert.ok(merged.brief.source_prefer.includes("x"));
assert.ok(merged.brief.must_address.length > 0, "preset adds must_address");

// briefBlock
const s = m.briefBlock({ audience: "PMs", scope_in: ["a", "b"], notes: "freeform addendum" }, null, "日本語");
assert.match(s, /AUDIENCE: PMs/);
assert.match(s, /SCOPE \(in\)/);
assert.match(s, /LANGUAGE: search and report primarily in 日本語/);
assert.match(s, /NOTES \(free-form addendum\):\nfreeform addendum/);
const sLegal = m.briefBlock({ audience: "counsel" }, m.PRESETS.legal);
assert.match(sLegal, /DOMAIN PRESET: legal/);
assert.match(sLegal, /Require ≥1 source\(s\)/);

// slugify
assert.equal(m.slugify("How does X compare to Y?"), "how-does-x-compare-to-y");
assert.equal(m.slugify("   ---trim me---  ").length > 0, true);
assert.equal(m.slugify(""), "query");
assert.equal(m.slugify("a".repeat(200)).length, 40);

// hashFinding
const h1 = m.hashFinding({ sub_question: "q", summary: "s", key_facts: [], sources: [], disagreements: [] });
const h2 = m.hashFinding({ sub_question: "q", summary: "s", key_facts: [], sources: [], disagreements: [], _failed: true });
assert.equal(h1, h2, "hash ignores transient _failed flag");
assert.equal(h1.length, 64, "sha256 hex length");
const h3 = m.hashFinding({ sub_question: "different", summary: "s", key_facts: [], sources: [], disagreements: [] });
assert.notEqual(h1, h3, "hash differs on content change");

// dead-link annotation regex (inlined in orchestrator)
const annotate = (report, dead) => report.replace(/\[(\d+)\](?!💀)/g, (mm, n) => (dead.has(+n) ? `${mm}💀` : mm));
assert.equal(annotate("Hello [1] [2] [3].", new Set([2])), "Hello [1] [2]💀 [3].");
assert.equal(annotate("Hello [2]💀 [2] [2].", new Set([2])), "Hello [2]💀 [2]💀 [2]💀.", "already-marked stays single");

// canonicalUrl
assert.equal(m.canonicalUrl("https://a.com/path?x=1"), "https://a.com/path");
assert.equal(m.canonicalUrl("https://a.com/path/"), "https://a.com/path");
assert.equal(m.canonicalUrl("https://a.com/path/#section"), "https://a.com/path");

// PRESETS shape
for (const k of ["legal", "medical", "academic", "financial", "regulatory"]) {
	assert.ok(k in m.PRESETS, `preset ${k} present`);
	const pp = m.PRESETS[k];
	assert.equal(pp.name, k);
	assert.ok(pp.warn.length > 20, "warn text present");
	assert.ok(Array.isArray(pp.must) && pp.must.length > 0);
	assert.ok(typeof pp.minSrc === "number");
}

const regMerged = m.mergePreset({ source_prefer: ["x"] }, "regulatory");
assert.equal(regMerged.preset.name, "regulatory");
assert.ok(regMerged.brief.source_prefer.some((s) => /NIST|ISO/i.test(s)));

// Tool registration: ours must override pi's builtins (Tavily-shadowing regression).
{
	const builtinTools = [
		{ name: "web_search", description: "(builtin) ollama-backed search" },
		{ name: "web_fetch", description: "(builtin) ollama-backed fetch" },
	];
	const registered = new Map();
	const handlers = new Map();
	const piMock = {
		on(event, handler) { handlers.set(event, handler); },
		registerTool(t) { registered.set(t.name, t); },
		registerCommand() {},
		getAllTools() {
			return [...builtinTools, ...[...registered.values()].map((t) => ({ name: t.name }))];
		},
	};
	assert.equal(typeof m.default, "function", "default export is the extension entry function");
	m.default(piMock);
	assert.ok(registered.has("deep_research"), "deep_research registered immediately");
	assert.ok(!registered.has("web_search"), "web_search is deferred to session_start");
	assert.equal(typeof handlers.get("session_start"), "function", "session_start handler installed");
	handlers.get("session_start")();
	assert.ok(registered.has("web_search"), "web_search registered on session_start (overrides pi builtin)");
	assert.ok(registered.has("web_fetch"), "web_fetch registered on session_start (overrides pi builtin)");
	assert.match(
		registered.get("web_search").description,
		/TAVILY_API_KEY/,
		"registered web_search is the extension's Tavily-aware version, not the ollama builtin",
	);
	// web_fetch must advertise a fetch-bytes cap. Without one, a worker doing 3-4
	// big fetches stacks past 1M tokens on the next turn and the model API rejects
	// the prompt. Empirically observed at 2.9M tokens; do not regress.
	const fetchDesc = registered.get("web_fetch").description;
	assert.match(fetchDesc, /Truncated to \d+ bytes/, "web_fetch advertises a byte cap");
	const capBytes = Number(fetchDesc.match(/Truncated to (\d+) bytes/)[1]);
	assert.ok(capBytes >= 100_000, `fetch cap >= 100 KB (got ${capBytes})`);
	assert.ok(capBytes <= 1_000_000, `fetch cap <= 1 MB to keep 6-fetch worker under 1M-token context (got ${capBytes})`);
	assert.match(fetchDesc, /PI_DR_MAX_FETCH_BYTES/, "env-var override is documented");
}

// Stateful-regex guard for scripts/eval.mjs: g-flag regex with .test() in .filter() undercounts.
const gRe = /\[(\d+)\]/g;
const nonGRe = /\[(\d+)\]/;
const sentsCite = [
	"First sentence has citation [1] here in the middle of the text body.",
	"Second sentence with citation [2] also here in the body of the text.",
	"Third sentence has [3] cited too in the right area of the body text.",
	"Fourth sentence with citation [4] near end of line of body text.",
	"Fifth sentence cite [5] at this position in the long-enough body text.",
];
gRe.lastIndex = 0;
const buggy = sentsCite.filter((s) => gRe.test(s)).length;
const correct = sentsCite.filter((s) => nonGRe.test(s)).length;
assert.equal(correct, 5, "non-global regex counts all five");
assert.ok(buggy < correct, `g-flag .test() must undercount (got buggy=${buggy}, correct=${correct})`);

console.log("✓ all smoke tests passed");
rmSync(dir, { recursive: true, force: true });
