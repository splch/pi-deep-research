/**
 * Smoke test for pure helpers in index.ts. Run via:
 *   node scripts/smoke.mjs
 *
 * Re-imports the module via TypeScript loader-less by compiling the relevant
 * helpers inline. This avoids a full build step. The goal is to catch obvious
 * regressions in the pure-function paths: exfilCheck, hostMatches,
 * htmlToText, parsePlanner, parseWorkerOutput, dedupeSources, mergePresetIntoBrief,
 * serializeBrief, annotateDeadLinks.
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

// Compile index.ts to a tmp dir, then import.
const dir = mkdtempSync(join(tmpdir(), "pi-dr-smoke-"));

// Strip the parts that import workspace deps and re-export only pure helpers.
// This is purely a smoke harness; the production extension stays unchanged.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

// Stub out the imports we can't satisfy in a node-only smoke test.
const stubbed =
	src
		// Replace the workspace + typebox imports with no-op stubs.
		.replace(/^import type { ExtensionAPI } from "@mariozechner\/pi-coding-agent";$/m, "")
		.replace(/^import { Text } from "@mariozechner\/pi-tui";$/m, "const Text = class { constructor(){} };")
		.replace(/^import { Type } from "typebox";$/m, "const Type = new Proxy({}, { get: () => () => ({}) });") +
	`\nexport { exfilCheck, hostMatches, htmlToText, parsePlanner, parseWorkerOutput, dedupeSources, mergePresetIntoBrief, serializeBrief, annotateDeadLinks, PRESETS };\n`;

const tsSrc = join(dir, "src.ts");
writeFileSync(tsSrc, stubbed);
// Compile with the local tsc, emitting a sibling .js.
// --noCheck: just transpile; we already typecheck via `npm run check`.
execSync(
	`./node_modules/.bin/tsc --module esnext --target es2022 --moduleResolution bundler --types node --strict false --skipLibCheck --noCheck --outDir ${dir} ${tsSrc}`,
	{ stdio: "inherit" },
);
const out = join(dir, "src.js");

const m = await import(out);

// --- exfilCheck --------------------------------------------------------------
assert.equal(m.exfilCheck("https://example.com/page"), null, "plain URL");
assert.equal(m.exfilCheck("https://example.com/p?utm_source=foo"), null, "utm allowed");
assert.match(m.exfilCheck("https://example.com/p?api_key=xxx") ?? "", /api/i, "api_key blocked");
assert.match(m.exfilCheck("https://example.com/p?access_token=zzz") ?? "", /token/i, "access_token blocked");
assert.match(m.exfilCheck("https://example.com/p?password=hi") ?? "", /password/i, "password blocked");
assert.match(m.exfilCheck("https://example.com/p?bearer=tok") ?? "", /bearer/i, "bearer blocked");
assert.match(m.exfilCheck("ftp://example.com/x") ?? "", /protocol/i, "non-http blocked");
assert.match(m.exfilCheck("https://example.com/p?key=" + "a".repeat(400)) ?? "", /opaque/i, "long blob blocked");
assert.equal(m.exfilCheck("https://example.com/?author=Smith"), null, "author key NOT confused with auth");

// --- hostMatches -------------------------------------------------------------
assert.equal(m.hostMatches("example.com", []), true, "empty allowlist passes everything");
assert.equal(m.hostMatches("example.com", ["example.com"]), true, "exact match");
assert.equal(m.hostMatches("docs.example.com", ["example.com"]), true, "subdomain match");
assert.equal(m.hostMatches("evil.com", ["example.com"]), false, "non-match");
assert.equal(m.hostMatches("a.gov", ["*.gov"]), true, "*.gov pattern");

// --- htmlToText --------------------------------------------------------------
assert.equal(
	m.htmlToText("<p>Hello <b>world</b></p><script>x=1</script>").includes("Hello"),
	true,
	"htmlToText preserves text",
);
assert.equal(m.htmlToText("<script>bad</script>").trim(), "", "script tags stripped");

// --- parsePlanner ------------------------------------------------------------
const p = m.parsePlanner('Some prose\n{"effort_tier":"comparison","sub_questions":["a","b"]}\n');
assert.equal(p.effort_tier, "comparison", "tier parsed");
assert.deepEqual(p.sub_questions, ["a", "b"], "subqs parsed");
assert.deepEqual(m.parsePlanner("no json here").sub_questions, [], "no-json fallback");

// --- parseWorkerOutput -------------------------------------------------------
const w = m.parseWorkerOutput(
	'```json\n{"sub_question":"q","summary":"s","key_facts":[],"sources":[{"url":"https://x.com","title":"t"}],"disagreements":[]}\n```',
);
assert.equal(w.sub_question, "q");
assert.equal(w.sources.length, 1);

// --- dedupeSources -----------------------------------------------------------
const ds = m.dedupeSources([
	{ url: "https://a.com/x", title: "T1" },
	{ url: "https://a.com/x?ref=1", title: "T1-dup" },
	{ url: "https://a.com/x/", title: "T1-dup2" },
	{ url: "https://b.com/y", title: "T2" },
]);
assert.equal(ds.length, 2, "dedupe collapses query/trailing slash");

// --- mergePresetIntoBrief ----------------------------------------------------
const merged = m.mergePresetIntoBrief({ source_prefer: ["x"] }, "legal");
assert.equal(merged.overlay.name, "legal");
assert.ok(merged.brief.source_prefer.includes("x"));
assert.ok(merged.brief.must_address.length > 0, "preset adds must_address");

// --- serializeBrief ----------------------------------------------------------
const s = m.serializeBrief({ audience: "PMs", scope_in: ["a", "b"] }, null);
assert.match(s, /AUDIENCE: PMs/);
assert.match(s, /SCOPE \(in\)/);

// --- annotateDeadLinks -------------------------------------------------------
assert.equal(m.annotateDeadLinks("Hello [1] [2] [3].", new Set([2])), "Hello [1] [2]💀 [3].");
assert.equal(
	m.annotateDeadLinks("Hello [2]💀 [2] [2].", new Set([2])),
	"Hello [2]💀 [2]💀 [2]💀.",
	"already-annotated stays single-marked",
);

// --- PRESETS shape -----------------------------------------------------------
assert.ok(["legal", "medical", "academic", "financial"].every((k) => k in m.PRESETS));

console.log("✓ all smoke tests passed");
rmSync(dir, { recursive: true, force: true });
