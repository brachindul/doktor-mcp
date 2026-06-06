#!/usr/bin/env node
/**
 * T45.3 — Mutation-Sanity Check Script
 *
 * Runs targeted mutation checks: temporarily breaks code, runs tests,
 * verifies tests catch the breakage, then restores code.
 *
 * Usage: node scripts/mutation-check.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";

function run(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 30000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function mutate(file, find, replace) {
  const path = join(ROOT, file);
  const original = readFileSync(path, "utf-8");
  writeFileSync(path, original.replace(find, replace));
  return () => writeFileSync(path, original); // restore function
}

const results = [];

// ── Invariant 1: cache.set removal breaks malpraktis test ──
console.log("\n[1/6] Mutation: remove cache.set in legislationDocCache");
let restore = mutate("src/sources/legislationDocCache.ts",
  /await writeFile\(this\.filePath\(sourceId\),/g,
  "// await writeFile(this.filePath(sourceId),");
const r1 = run("npx vitest run tests/faz46_cache_and_placeholder_tests.test.ts -t getOrFetch");
restore();
results.push({ invariant: "cache.set kaldır (T35.2)", broken: !r1.ok, expected: "test kırılmalı" });
console.log(r1.ok ? `  ${FAIL} Mutation FARK EDILMEDI` : `  ${PASS} Test kırıldı (beklendiği gibi)`);

// ── Invariant 2: placeholder filter disabled ──
console.log("\n[2/6] Mutation: break hintHasDirectSourceId (always return true)");
restore = mutate("src/sources/legislation/liveOfficialLegislationAdapter.ts",
  /return Boolean\(hint\.legislationNumber && hint\.legislationType && hint\.legislationArrangement\);/g,
  "return true; // mutation: always pass");
const r2 = run("npx vitest run tests/faz46_cache_and_placeholder_tests.test.ts -t hintHasDirectSourceId");
restore();
results.push({ invariant: "placeholder hint filtresi kaldır (T35.5)", broken: !r2.ok, expected: "test kırılmalı" });
console.log(r2.ok ? `  ${FAIL} Mutation FARK EDILMEDI` : `  ${PASS} Test kırıldı (beklendiği gibi)`);

// ── Invariant 3: graceful degradation disabled ──
console.log("\n[3/6] Mutation: break graceful degradation in article parser");
restore = mutate("src/sources/legislation/articleParser.ts",
  /a\.text\.length >= MIN_ARTICLE_LENGTH/g,
  "true // mutation: all articles pass filter");
const r3 = run("npx vitest run tests/gracefulDegradation.test.ts -t empty");
restore();
results.push({ invariant: "graceful degradation kapat (T27.3)", broken: !r3.ok, expected: "test kırılmalı" });
console.log(r3.ok ? `  ${FAIL} Mutation FARK EDILMEDI` : `  ${PASS} Test kırıldı (beklendiği gibi)`);

// ── Invariant 4: malpraktis term mapping removed ──
console.log("\n[4/6] Mutation: remove malpraktis from deontology hint terms");
restore = mutate("src/sources/legislation/healthMappings.ts",
  /"malpraktis", "malpractice",/g,
  "// \"malpraktis\", \"malpractice\",");
const r4 = run("npx vitest run tests/faz46_cache_and_placeholder_tests.test.ts -t malpraktis");
restore();
results.push({ invariant: "malpraktis terim eşlemesi kaldır (T45.1)", broken: !r4.ok, expected: "test kırılmalı" });
console.log(r4.ok ? `  ${FAIL} Mutation FARK EDILMEDI` : `  ${PASS} Test kırıldı (beklendiği gibi)`);

// ── Invariant 5: RRF fusion downgraded to relevance-only ──
console.log("\n[5/6] Mutation: collapse RRF fusion to relevance-only in rerank");
restore = mutate("src/health/precedentRerank.ts",
  /const fusedOrder = rrfFuse\(\[relevanceRanked, recencyRanked, lexicalRanked\]\);/g,
  "const fusedOrder = relevanceRanked; // mutation: drop recency+lexical signals");
const r5 = run("npx vitest run tests/faz49_rrf_chamber_wiring.test.ts -t \"recency\"");
restore();
results.push({ invariant: "RRF füzyonu rerank'e bağlı (T48.1)", broken: !r5.ok, expected: "test kırılmalı" });
console.log(r5.ok ? `  ${FAIL} Mutation FARK EDILMEDI` : `  ${PASS} Test kırıldı (beklendiği gibi)`);

// ── Invariant 6: chamber exact-match guard removed ──
console.log("\n[6/6] Mutation: drop exact-chamber guard in buildBedestenSearchBody");
restore = mutate("src/sources/bedesten/bedestenApi.ts",
  /if \(chamber && isExactChamberName\(chamber\)\) \{/g,
  "if (chamber) { // mutation: apply coarse keywords too");
const r6 = run("npx vitest run tests/faz49_rrf_chamber_wiring.test.ts -t \"chamber filtresi\"");
restore();
results.push({ invariant: "chamber exact-match guard (T49.1)", broken: !r6.ok, expected: "test kırılmalı" });
console.log(r6.ok ? `  ${FAIL} Mutation FARK EDILMEDI` : `  ${PASS} Test kırıldı (beklendiği gibi)`);

// ── Summary ──
console.log("\n=== Mutation Check Summary ===");
let passed = 0;
for (const r of results) {
  const icon = r.broken === true ? PASS : FAIL;
  console.log(`  ${icon} ${r.invariant}: ${r.broken ? "test kırılıyor (KORUNUYOR)" : "test kırılmadı (AÇIK!)"}`);
  if (r.broken) passed++;
}
console.log(`\n${passed}/${results.length} invariyant testlerle korunuyor.`);
console.log(results.every(r => r.broken) ? "Tüm invariyantlar korunuyor ✓" : "Bazı invariyantlar açıkta!");
