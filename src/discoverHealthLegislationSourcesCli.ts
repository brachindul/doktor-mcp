/**
 * Health Legislation Source Discovery CLI (v0.33.0)
 *
 * Collects and classifies official source leads for remaining gap/candidate
 * health regulation entries. Produces a structured JSON report and a
 * human-readable console summary.
 *
 * Usage:
 *   npm run discover:health-legislation-sources
 *
 * Does NOT auto-verify — verification is deferred to
 * verify:health-legislation.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  HEALTH_LEGISLATION_INVENTORY
} from "./healthLegislationInventory.js";
import {
  buildSourceDiscoveryReport,
  filterDiscoveryCandidates
} from "./healthLegislationSourceDiscovery.js";

const OUTPUT_DIR = join("exports", "health-legislation-source-discovery");
const REPORT_PATH = join(OUTPUT_DIR, "report.json");

function main(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const candidates = filterDiscoveryCandidates(HEALTH_LEGISLATION_INVENTORY);
  const report = buildSourceDiscoveryReport(candidates);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  // ── Console summary ───────────────────────────────────────────
  console.log("=".repeat(52));
  console.log("Health Legislation Source Discovery Report");
  console.log("=".repeat(52));
  console.log(`  Entries scanned:       ${report.entriesScanned}`);
  console.log(`  Total leads found:     ${report.leadsFound}`);
  console.log(`  Official (.gov.tr):    ${report.officialLeadsFound}`);
  console.log(`  Non-official ignored:  ${report.nonOfficialLeadsIgnored}`);
  console.log(`  Needs manual review:   ${report.needsManualReviewCount}`);
  console.log(`  Sent to verifier:      ${report.leadsSentToVerifier}`);
  console.log("=".repeat(52));
  console.log("");

  for (const entry of report.entries) {
    const sourceIdLead = entry.leads.find(
      (l) => l.leadKind === "mevzuat_source_id" || l.leadKind === "mevzuat_pdf_url"
    );
    const rgLead = entry.leads.find((l) => l.leadKind === "resmi_gazete_url");
    const titleLead = entry.leads.find((l) => l.leadKind === "candidate_title_match");
    const saglikLead = entry.leads.find((l) => l.leadKind === "saglik_gov_tr_page");

    const statusIcon = sourceIdLead
      ? sourceIdLead.confidence === "high"
        ? "✓"
        : "?"
      : "✗";

    console.log(`${statusIcon} ${entry.entryKey}`);
    console.log(`   Title: ${entry.entryTitle.slice(0, 80)}...`);

    if (sourceIdLead) {
      console.log(`   SourceId lead:    ${sourceIdLead.sourceId ?? "—"} (${sourceIdLead.confidence})`);
      console.log(`   PDF URL:          ${sourceIdLead.officialUrl ?? "—"}`);
    }

    if (rgLead) {
      console.log(`   RG lead:          ${rgLead.rgDate ?? "—"} / ${rgLead.rgNumber ?? "—"} (${rgLead.confidence})`);
    }

    if (saglikLead) {
      console.log(`   Sağlık Gov lead:  ${saglikLead.officialUrl ?? "—"} (${saglikLead.confidence})`);
    }

    if (titleLead) {
      console.log(`   Title match:      ${titleLead.confidence} — ${titleLead.reasons.length} search signals`);
    }

    if (entry.ignoredNonOfficialLeads.length > 0) {
      for (const ignored of entry.ignoredNonOfficialLeads) {
        console.log(`   [IGNORED] Non-gov.tr lead: ${ignored.officialUrl}`);
      }
    }

    console.log(`   Next action:      ${entry.recommendedNextAction}`);
    console.log("");
  }

  console.log(`Report written to: ${REPORT_PATH}`);
}

main();
