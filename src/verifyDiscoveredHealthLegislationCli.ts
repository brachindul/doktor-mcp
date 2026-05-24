/**
 * CLI: Verify discovered official health legislation leads (v0.34.0)
 *
 * Takes discovery leads from v0.33 and routes them through the existing
 * direct sourceId verifier. Produces a structured verification report.
 *
 * Does NOT auto-promote to active coverage — the report guides manual
 * inventory/mapping updates if verification succeeds.
 *
 * Usage: npm run verify:discovered-health-legislation
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  HEALTH_LEGISLATION_INVENTORY
} from "./healthLegislationInventory.js";
import {
  buildSourceDiscoveryReport,
  filterDiscoveryCandidates,
  verifyDiscoveredOfficialLeads
} from "./healthLegislationSourceDiscovery.js";
import { LiveOfficialLegislationAdapter } from "./sources/legislation/liveOfficialLegislationAdapter.js";

const OUTPUT_DIR = join("exports", "health-legislation-source-discovery");
const REPORT_PATH = join(OUTPUT_DIR, "verification-report.json");

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const candidates = filterDiscoveryCandidates(HEALTH_LEGISLATION_INVENTORY);
  const discoveryReport = buildSourceDiscoveryReport(candidates);
  const adapter = new LiveOfficialLegislationAdapter();

  console.log("=".repeat(52));
  console.log("Discovered Lead Verification");
  console.log(`- Entries: ${candidates.length} (gap + candidate)`);
  console.log("- Source: mevzuat.gov.tr live fetch");
  console.log("=".repeat(52));
  console.log("");

  const report = await verifyDiscoveredOfficialLeads(discoveryReport, HEALTH_LEGISLATION_INVENTORY, adapter);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  console.log("=".repeat(52));
  console.log("Lead Verification Complete");
  console.log(`  Leads attempted:    ${report.leadsAttempted}`);
  console.log(`  Leads verified:     ${report.leadsVerified}`);
  console.log(`  Leads rejected:     ${report.leadsRejected}`);
  console.log(`  Needs manual review: ${report.needsManualReviewCount}`);
  console.log(`  Promotable:         ${report.promotedToActiveCoverageCount}`);
  console.log("=".repeat(52));
  console.log("");

  for (const r of report.results) {
    if (r.verificationStatus === "verified") {
      console.log(`✅ ${r.entryKey}`);
      console.log(`   SourceId:     ${r.sourceId}`);
      console.log(`   Title score:  ${r.titleScore?.toFixed(3) ?? "—"}`);
      console.log(`   Marker score: ${r.markerScore?.toFixed(3) ?? "—"}`);
      console.log(`   PROMOTABLE to active coverage`);
    } else if (r.verificationStatus === "not_verified") {
      console.log(`❌ ${r.entryKey}`);
      console.log(`   SourceId:     ${r.sourceId ?? "—"}`);
      console.log(`   Verifier:     ${r.verifierStatus}`);
      console.log(`   Reason:       ${r.rejectReason}`);
    } else if (r.verificationStatus === "needs_manual_review") {
      console.log(`?  ${r.entryKey}`);
      console.log(`   Reason:       ${r.rejectReason}`);
    } else {
      console.log(`⚠  ${r.entryKey}`);
      console.log(`   Status:       ${r.verificationStatus}`);
    }
    console.log("");
  }

  console.log(`Report written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("Lead verification CLI failed:", err);
  process.exit(1);
});
