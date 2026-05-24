/**
 * CLI: Resolve RG-only health legislation leads to sourceId candidates (v0.35.0)
 *
 * Takes inventory entries with expectedRgNumber but no confirmed
 * candidateLegacySourceId and attempts to discover official mevzuat.gov.tr
 * sourceId/PDF leads via RG-number-based and title-combined search variants.
 *
 * Found candidates are routed through the existing verifier. No automatic
 * active coverage promotion.
 *
 * Usage: npm run resolve:health-legislation-rg-leads
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HEALTH_LEGISLATION_INVENTORY } from "./healthLegislationInventory.js";
import { buildRgResolutionReport, filterRgOnlyLeads } from "./healthLegislationRgResolver.js";
import { LiveOfficialLegislationAdapter } from "./sources/legislation/liveOfficialLegislationAdapter.js";

const OUTPUT_DIR = join("exports", "health-legislation-rg-resolution");
const REPORT_PATH = join(OUTPUT_DIR, "report.json");

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const rgEntries = filterRgOnlyLeads(HEALTH_LEGISLATION_INVENTORY);
  const adapter = new LiveOfficialLegislationAdapter();

  console.log("=".repeat(52));
  console.log("RG Lead SourceId Resolver");
  console.log(`- RG-only entries: ${rgEntries.length}`);
  console.log("- Source: mevzuat.gov.tr live fetch + existing verifier");
  console.log("=".repeat(52));
  console.log("");

  console.log("RG-only entries to resolve:");
  for (const e of rgEntries) {
    console.log(`  ${e.key} — RG ${e.expectedRgNumber} (${e.expectedRgDate ?? "?"})`);
  }
  console.log("");

  const report = await buildRgResolutionReport(HEALTH_LEGISLATION_INVENTORY, adapter);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  console.log("=".repeat(52));
  console.log("RG Resolution Complete");
  console.log(`  Entries scanned:           ${report.entriesScanned}`);
  console.log(`  RG leads processed:        ${report.rgLeadsProcessed}`);
  console.log(`  SourceId candidates found:  ${report.sourceIdCandidatesFound}`);
  console.log(`  PDF candidates found:      ${report.officialPdfCandidatesFound}`);
  console.log(`  Sent to verifier:          ${report.candidatesSentToVerifier}`);
  console.log(`  Verified:                  ${report.verifiedCount}`);
  console.log(`  Rejected:                  ${report.rejectedCount}`);
  console.log(`  Needs manual review:       ${report.needsManualReviewCount}`);
  console.log(`  Non-gov.tr ignored:        ${report.nonGovIgnoredCount}`);
  console.log("=".repeat(52));
  console.log("");

  for (const r of report.entries) {
    if (r.verificationStatus === "verified") {
      console.log(`✅ ${r.entryKey}`);
      console.log(`   SourceId:     ${r.bestCandidate?.sourceId}`);
      console.log(`   URL:          ${r.bestCandidate?.officialUrl}`);
      console.log(`   Title score:  ${r.titleScore?.toFixed(3) ?? "—"}`);
      console.log(`   Marker score: ${r.markerScore?.toFixed(3) ?? "—"}`);
      console.log(`   PROMOTABLE to active coverage`);
    } else if (r.verificationStatus === "rejected") {
      console.log(`❌ ${r.entryKey}`);
      console.log(`   SourceId:     ${r.bestCandidate?.sourceId ?? "—"}`);
      console.log(`   Reason:       ${r.rejectReason}`);
    } else if (r.verificationStatus === "candidate_found") {
      console.log(`~  ${r.entryKey} (candidate found, no verifier)`);
      console.log(`   Best:         ${r.bestCandidate?.sourceId} (score ${r.bestCandidate?.matchScore.toFixed(3)})`);
    } else if (r.verificationStatus === "no_candidate_found") {
      console.log(`?  ${r.entryKey} — no candidate found`);
    } else {
      console.log(`?  ${r.entryKey} — ${r.verificationStatus}: ${r.recommendedNextAction}`);
    }
    console.log("");
  }

  console.log(`Report written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("RG lead resolver CLI failed:", err);
  process.exit(1);
});
