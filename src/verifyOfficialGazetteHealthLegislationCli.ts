/**
 * CLI: Verify Official Gazette documents for RG-only health legislation leads (v0.36.0)
 *
 * Takes inventory entries with expectedRgNumber but no confirmed mevzuatSourceId
 * and attempts to verify their Resmî Gazete documents directly.
 *
 * RG-verified entries without a mevzuat.gov.tr sourceId are reported as
 * rg_verified_no_sourceId and are NOT promoted to active coverage.
 *
 * Usage: npm run verify:official-gazette-health-legislation
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HEALTH_LEGISLATION_INVENTORY } from "./healthLegislationInventory.js";
import {
  filterRgOnlyLeads,
  buildRgDocumentVerificationReport
} from "./officialGazetteDocumentVerifier.js";

const OUTPUT_DIR = join("exports", "official-gazette-verification");
const REPORT_PATH = join(OUTPUT_DIR, "report.json");

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const rgEntries = filterRgOnlyLeads(HEALTH_LEGISLATION_INVENTORY);

  console.log("=".repeat(52));
  console.log("Official Gazette Document Verifier");
  console.log(`- RG-only entries: ${rgEntries.length}`);
  console.log("- Source: resmigazete.gov.tr live fetch");
  console.log("- RG verified ≠ active coverage (needs mevzuat sourceId)");
  console.log("=".repeat(52));
  console.log("");

  console.log("RG-only entries to verify:");
  for (const e of rgEntries) {
    console.log(`  ${e.key} — RG ${e.expectedRgNumber} (${e.expectedRgDate ?? "?"})`);
  }
  console.log("");

  const liveFetcher = {
    fetchRgPage: async (url: string) => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15_000)
        });
        const content = await response.text();
        return {
          title: "",
          content,
          statusCode: response.status
        };
      } catch {
        return null;
      }
    }
  };

  const report = await buildRgDocumentVerificationReport(HEALTH_LEGISLATION_INVENTORY, liveFetcher);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  console.log("=".repeat(52));
  console.log("Verification Complete");
  console.log(`  Entries scanned:          ${report.entriesScanned}`);
  console.log(`  RG entries processed:     ${report.rgEntriesProcessed}`);
  console.log(`  RG verified:              ${report.rgVerifiedCount}`);
  console.log(`  RG verified (no sourceId): ${report.rgVerifiedNoSourceIdCount}`);
  console.log(`  RG not found:             ${report.rgNotFoundCount}`);
  console.log(`  RG wrong document:        ${report.rgWrongDocumentCount}`);
  console.log(`  RG unavailable:           ${report.rgUnavailableCount}`);
  console.log(`  RG errors:                ${report.rgErrorCount}`);
  console.log("=".repeat(52));
  console.log("");

  for (const r of report.entries) {
    if (r.status === "rg_verified") {
      console.log(`✅ ${r.entryKey}`);
      console.log(`   RG URL:       ${r.rgUrl}`);
      console.log(`   Title score:  ${r.titleScore.toFixed(3)}`);
      console.log(`   Marker score: ${r.markerScore.toFixed(3)}`);
      console.log(`   Fetched:      ${r.fetchedTitle?.slice(0, 80) ?? "—"}`);
      console.log(`   PROMOTABLE only if mevzuat sourceId also confirmed`);
    } else if (r.status === "rg_not_found") {
      console.log(`❌ ${r.entryKey} — RG page not found (HTTP 4xx)`);
      console.log(`   URL:  ${r.rgUrl}`);
      if (r.errorMessage) console.log(`   ${r.errorMessage}`);
    } else if (r.status === "rg_wrong_document") {
      console.log(`❌ ${r.entryKey} — content mismatch`);
      console.log(`   URL:          ${r.rgUrl}`);
      console.log(`   Title score:  ${r.titleScore.toFixed(3)}`);
      console.log(`   Marker score: ${r.markerScore.toFixed(3)}`);
      console.log(`   Fetched:      ${r.fetchedTitle?.slice(0, 80) ?? "—"}`);
      if (r.errorMessage) console.log(`   ${r.errorMessage}`);
    } else if (r.status === "rg_unavailable") {
      console.log(`⚠  ${r.entryKey} — RG page unavailable`);
      console.log(`   URL:  ${r.rgUrl}`);
      if (r.errorMessage) console.log(`   ${r.errorMessage}`);
    } else {
      console.log(`?  ${r.entryKey} — ${r.status}`);
      console.log(`   URL:  ${r.rgUrl}`);
      if (r.errorMessage) console.log(`   ${r.errorMessage}`);
    }
    console.log("");
  }

  console.log(`Report written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("Official Gazette verifier CLI failed:", err);
  process.exit(1);
});
