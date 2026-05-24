/**
 * CLI: Verify official health legislation access (v0.30.0)
 *
 * Searches mevzuat.gov.tr for each candidate/gap inventory entry and attempts
 * to confirm an official sourceId. Writes a JSON report to
 * exports/health-legislation-verification/report.json.
 *
 * Usage: npm run verify:health-legislation
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  HEALTH_LEGISLATION_INVENTORY
} from "./healthLegislationInventory.js";
import { buildAccessVerificationReport } from "./healthLegislationAccessVerifier.js";
import { LiveOfficialLegislationAdapter } from "./sources/legislation/liveOfficialLegislationAdapter.js";

async function main(): Promise<void> {
  const entriesToVerify = HEALTH_LEGISLATION_INVENTORY.filter(
    (e) => e.officialSourceStatus === "candidate" || e.officialSourceStatus === "gap"
  );

  console.log("====================================================");
  console.log("Health Legislation Access Verifier");
  console.log(`- Entries to verify: ${entriesToVerify.length} (candidate + gap)`);
  console.log("- Source: mevzuat.gov.tr live search");
  console.log("- Output: exports/health-legislation-verification/report.json");
  console.log("====================================================\n");

  for (const entry of entriesToVerify) {
    console.log(`  Queued: [${entry.officialSourceStatus}] ${entry.key}`);
  }
  console.log();

  const adapter = new LiveOfficialLegislationAdapter();
  const report = await buildAccessVerificationReport(entriesToVerify, adapter, 500);

  const outputDir = "exports/health-legislation-verification";
  mkdirSync(outputDir, { recursive: true });
  const reportPath = join(outputDir, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log("====================================================");
  console.log("Verification Complete");
  console.log(`  Attempted:     ${report.attemptedCount}`);
  console.log(`  Verified:      ${report.verifiedCount}`);
  console.log(`  Rejected:      ${report.rejectedCount}`);
  console.log(`  Search errors: ${report.searchErrorCount}`);
  console.log("====================================================\n");

  if (report.verifiedEntries.length > 0) {
    console.log("✅ VERIFIED:");
    for (const a of report.verifiedEntries) {
      console.log(`  ${a.entryKey} [${a.status}]`);
      console.log(`    sourceId:    ${a.mevzuatSourceId}`);
      console.log(`    title:       ${a.bestMatch?.title}`);
      console.log(`    titleScore:  ${a.titleScore?.toFixed(3) ?? "—"}`);
      console.log(`    aliasScore:  ${a.aliasScore?.toFixed(3) ?? "—"}`);
      console.log(`    queryKind:   ${a.bestQueryKind ?? "—"}`);
      console.log(`    probeUsed:   ${a.sourceIdProbeUsed}`);
      console.log(`    officialUrl: ${a.officialUrl}`);
      console.log(`    queries:     ${a.searchTermsAttempted.length} attempted`);
      if (a.directFetchStatus) {
        console.log(`    directFetch: ${a.directFetchStatus} (markerScore: ${a.directFetchMarkerScore?.toFixed(3) ?? "—"})`);
      }
    }
    console.log();
  }

  if (report.rejectedEntries.length > 0) {
    console.log("❌ REJECTED:");
    for (const a of report.rejectedEntries) {
      console.log(`  ${a.entryKey} [${a.status}]`);
      console.log(`    reason:     ${a.rejectReason}`);
      console.log(`    queries:    ${a.searchTermsAttempted.length} attempted`);
      if (a.bestMatch) {
        console.log(`    best:       "${a.bestMatch.title}" (score: ${a.bestMatch.titleMatchScore.toFixed(3)})`);
      }
      if (a.topCandidates.length > 0) {
        console.log("    top candidates:");
        for (const c of a.topCandidates) {
          console.log(`      - ${c.sourceId} "${c.title}" (${c.score.toFixed(3)})`);
        }
      }
      if (a.directFetchAttempted) {
        console.log(`    directFetch: ${a.directFetchStatus} (markerScore: ${a.directFetchMarkerScore?.toFixed(3) ?? "—"}, title: "${(a.directFetchTitle ?? "").slice(0, 100)}")`);
      }
    }
    console.log();
  }

  if (report.searchErrorEntries.length > 0) {
    console.log("⚠️  SEARCH ERRORS:");
    for (const a of report.searchErrorEntries) {
      console.log(`  ${a.entryKey}: ${a.rejectReason}`);
      if (a.directFetchAttempted) {
        console.log(`    directFetch: ${a.directFetchStatus} (markerScore: ${a.directFetchMarkerScore?.toFixed(3) ?? "—"}, title: "${(a.directFetchTitle ?? "").slice(0, 100)}")`);
      }
    }
    console.log();
  }

  console.log(`Report written to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Verification CLI failed:", err);
  process.exit(1);
});
