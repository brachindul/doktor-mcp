import { describe, it, expect } from "vitest";
import {
  HEALTH_LEGISLATION_INVENTORY,
  buildInventoryReport
} from "../src/healthLegislationInventory.js";

/**
 * Health Legislation Coverage Gap Tests (T6.3)
 *
 * These tests track the verification status of unverified inventory entries
 * (gap + candidate). As of v0.44.0 verification attempt (2026-05-30), all
 * 6 unverified entries remain unverified due to mevzuat.gov.tr Cloudflare
 * anti-bot blocking direct PDF downloads and search API returning irrelevant
 * results for these specific legislation titles.
 *
 * Verification CLIs attempted:
 * - verify:health-legislation — 0 verified / 6 rejected
 * - verify:discovered-health-legislation — 0 verified / 5 needs_manual_review
 * - verify:official-gazette-health-legislation — 0 RG verified / 6 wrong document
 * - resolve:health-legislation-rg-leads — 0 verified / 6 rejected
 */
describe("health legislation coverage", () => {
  const report = buildInventoryReport();

  it("should have at least 11 verified entries (existing baseline)", () => {
    expect(report.verifiedOfficialSourceCount).toBeGreaterThanOrEqual(11);
  });

  it("all verified entries should be marked as covered", () => {
    expect(report.coveredByActiveHintsCount).toBe(report.verifiedOfficialSourceCount);
  });

  it("each verified entry should have a valid mevzuatSourceId", () => {
    for (const entry of report.verifiedEntries) {
      if (entry.mevzuatSourceId) {
        expect(typeof entry.mevzuatSourceId).toBe("string");
        expect(entry.mevzuatSourceId.length).toBeGreaterThan(0);
        expect(entry.mevzuatSourceId).toMatch(/^mevzuat:\d+\.\d+\.\d+$/);
      }
    }
  });

  it("each verified entry should have a mevzuat.gov.tr officialUrl", () => {
    for (const entry of report.verifiedEntries) {
      expect(entry.officialUrl).toBeTruthy();
      expect(entry.officialUrl).toContain("mevzuat.gov.tr");
    }
  });

  it("unverified (gap + candidate) count should be tracked correctly", () => {
    // 2 gap + 4 candidate = 6 unverified entries
    const unverifiedCount = report.gapCount + report.candidateOfficialSourceCount;
    expect(unverifiedCount).toBe(6);
  });

  it("gap entries should remain documented as unverifiable (network issues)", () => {
    // As of v0.44.0, gap entries could not be verified due to mevzuat.gov.tr
    // Cloudflare anti-bot blocking direct PDF downloads.
    expect(report.gapCount).toBeGreaterThanOrEqual(2);

    for (const entry of report.gapEntries) {
      // Each gap entry should have notes documenting verification attempts
      expect(entry.notes.length).toBeGreaterThan(0);
      const hasVerificationNote = entry.notes.some(
        (n) => n.includes("verification attempt") || n.includes("Known gap")
      );
      expect(hasVerificationNote).toBe(true);
    }
  });

  it("candidate entries should have verification attempt notes", () => {
    for (const entry of report.candidateEntries) {
      const hasVerificationNote = entry.notes.some(
        (n) => n.includes("verification attempt") || n.includes("Candidate for active coverage")
      );
      expect(hasVerificationNote).toBe(true);
    }
  });

  it("coverageWarnings should mention gap and candidate entries", () => {
    const warnings = report.coverageWarnings;
    expect(warnings.length).toBeGreaterThan(0);

    const gapWarning = warnings.find((w) => w.includes("gap"));
    expect(gapWarning).toBeTruthy();

    const candidateWarning = warnings.find((w) => w.includes("candidate"));
    expect(candidateWarning).toBeTruthy();
  });

  it("no verified entry should have non-gov.tr URL (integrity check)", () => {
    const violations = report.verifiedEntries.filter(
      (e) => e.officialUrl && !e.officialUrl.includes("mevzuat.gov.tr")
    );
    expect(violations).toHaveLength(0);
  });

  it("inventory counts should be consistent", () => {
    const total = report.verifiedOfficialSourceCount +
                  report.candidateOfficialSourceCount +
                  report.gapCount +
                  report.deferredCount;
    expect(total).toBe(report.inventoryTotalCount);
  });

  it("core+supporting+specialized should sum to total", () => {
    const sum = report.coreInventoryCount +
                report.supportingInventoryCount +
                report.specializedInventoryCount;
    expect(sum).toBe(report.inventoryTotalCount);
  });
});
