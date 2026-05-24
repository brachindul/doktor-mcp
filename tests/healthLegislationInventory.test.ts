import { describe, it, expect } from "vitest";
import {
  HEALTH_LEGISLATION_INVENTORY,
  VERIFIED_MEVZUAT_SOURCE_IDS,
  buildInventoryReport
} from "../src/healthLegislationInventory.js";

// ─── Inventory structure ────────────────────────────────────────────────────

describe("HEALTH_LEGISLATION_INVENTORY entries", () => {
  it("has entries", () => {
    expect(HEALTH_LEGISLATION_INVENTORY.length).toBeGreaterThan(0);
  });

  it("every entry has required fields: key, title, titleNormalized, category, relevanceLevel, officialSourceStatus, coverageStatus", () => {
    for (const entry of HEALTH_LEGISLATION_INVENTORY) {
      expect(entry.key, `key missing on ${entry.title}`).toBeTruthy();
      expect(entry.title, `title missing on ${entry.key}`).toBeTruthy();
      expect(entry.titleNormalized, `titleNormalized missing on ${entry.key}`).toBeTruthy();
      expect(entry.category, `category missing on ${entry.key}`).toBeTruthy();
      expect(entry.relevanceLevel, `relevanceLevel missing on ${entry.key}`).toBeTruthy();
      expect(entry.officialSourceStatus, `officialSourceStatus missing on ${entry.key}`).toBeTruthy();
      expect(entry.coverageStatus, `coverageStatus missing on ${entry.key}`).toBeTruthy();
    }
  });

  it("all keys are unique", () => {
    const keys = HEALTH_LEGISLATION_INVENTORY.map((e) => e.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("has core mevzuat entries (tababet, deontoloji, hasta haklari)", () => {
    const keys = new Set(HEALTH_LEGISLATION_INVENTORY.map((e) => e.key));
    expect(keys.has("tababet-kanunu")).toBe(true);
    expect(keys.has("tibbi-deontoloji-nizamnamesi")).toBe(true);
    expect(keys.has("hasta-haklari-yonetmeligi")).toBe(true);
  });

  it("verified entries have mevzuatSourceId set", () => {
    const verified = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "verified");
    expect(verified.length).toBeGreaterThan(0);
    for (const entry of verified) {
      expect(entry.mevzuatSourceId, `mevzuatSourceId missing on verified ${entry.key}`).toBeTruthy();
    }
  });

  it("verified entries have officialUrl set and it is on mevzuat.gov.tr", () => {
    const verified = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "verified");
    for (const entry of verified) {
      expect(entry.officialUrl, `officialUrl missing on verified ${entry.key}`).toBeTruthy();
      expect(
        entry.officialUrl!.includes("mevzuat.gov.tr"),
        `verified entry ${entry.key} has non-gov.tr URL: ${entry.officialUrl}`
      ).toBe(true);
    }
  });

  it("unverified entries do NOT have officialUrl set", () => {
    const nonVerified = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus !== "verified");
    for (const entry of nonVerified) {
      expect(
        entry.officialUrl,
        `non-verified entry ${entry.key} unexpectedly has officialUrl set`
      ).toBeUndefined();
    }
  });

  it("gap entries do NOT have mevzuatSourceId", () => {
    const gaps = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "gap");
    expect(gaps.length).toBeGreaterThan(0);
    for (const entry of gaps) {
      expect(
        entry.mevzuatSourceId,
        `gap entry ${entry.key} unexpectedly has mevzuatSourceId`
      ).toBeUndefined();
    }
  });

  it("v0.22 known gap entries are present as gap status", () => {
    const gapKeys = new Set(
      HEALTH_LEGISLATION_INVENTORY
        .filter((e) => e.officialSourceStatus === "gap")
        .map((e) => e.key)
    );
    expect(gapKeys.has("ozel-hastaneler-yonetmeligi")).toBe(true);
    expect(gapKeys.has("ayakta-teshis-ozel-saglik")).toBe(true);
    expect(gapKeys.has("saglik-meslek-is-gorev-tanimlari")).toBe(true);
  });

  it("covered entries have coverageStatus=covered and are verified", () => {
    const covered = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.coverageStatus === "covered");
    expect(covered.length).toBeGreaterThan(0);
    for (const entry of covered) {
      expect(entry.officialSourceStatus).toBe("verified");
    }
  });

  it("no candidate or gap entry has coverageStatus=covered", () => {
    const unexpected = HEALTH_LEGISLATION_INVENTORY.filter(
      (e) => (e.officialSourceStatus === "candidate" || e.officialSourceStatus === "gap") &&
              e.coverageStatus === "covered"
    );
    expect(unexpected).toHaveLength(0);
  });
});

// ─── VERIFIED_MEVZUAT_SOURCE_IDS ────────────────────────────────────────────

describe("VERIFIED_MEVZUAT_SOURCE_IDS", () => {
  it("contains known verified sourceIds", () => {
    expect(VERIFIED_MEVZUAT_SOURCE_IDS.has("mevzuat:7.5.4847")).toBe(true); // Hasta Hakları
    expect(VERIFIED_MEVZUAT_SOURCE_IDS.has("mevzuat:1.3.1219")).toBe(true); // Tababet
    expect(VERIFIED_MEVZUAT_SOURCE_IDS.has("mevzuat:1.5.6698")).toBe(true); // KVKK
  });

  it("does not contain unverified sourceIds", () => {
    // Candidate/gap entries have no mevzuatSourceId, so none should leak in
    const candidateIds = HEALTH_LEGISLATION_INVENTORY
      .filter((e) => e.officialSourceStatus !== "verified")
      .map((e) => e.mevzuatSourceId)
      .filter(Boolean);
    for (const id of candidateIds) {
      expect(VERIFIED_MEVZUAT_SOURCE_IDS.has(id!)).toBe(false);
    }
  });
});

// ─── buildInventoryReport ───────────────────────────────────────────────────

describe("buildInventoryReport", () => {
  const report = buildInventoryReport();

  it("inventoryTotalCount matches HEALTH_LEGISLATION_INVENTORY.length", () => {
    expect(report.inventoryTotalCount).toBe(HEALTH_LEGISLATION_INVENTORY.length);
  });

  it("has at least 5 verified entries", () => {
    expect(report.verifiedOfficialSourceCount).toBeGreaterThanOrEqual(5);
  });

  it("has at least 3 gap entries (v0.22 known gaps)", () => {
    expect(report.gapCount).toBeGreaterThanOrEqual(3);
  });

  it("has candidate entries", () => {
    expect(report.candidateOfficialSourceCount).toBeGreaterThan(0);
  });

  it("coveredByActiveHintsCount equals verified count (all verified are covered)", () => {
    // All verified entries have coverageStatus=covered
    expect(report.coveredByActiveHintsCount).toBe(report.verifiedOfficialSourceCount);
  });

  it("uncoveredCoreCount counts core entries not covered", () => {
    const expectedUncoveredCore = HEALTH_LEGISLATION_INVENTORY.filter(
      (e) => e.relevanceLevel === "core" && e.coverageStatus !== "covered"
    ).length;
    expect(report.uncoveredCoreCount).toBe(expectedUncoveredCore);
  });

  it("inventory counts sum to inventoryTotalCount", () => {
    const total = report.verifiedOfficialSourceCount + report.candidateOfficialSourceCount +
                  report.gapCount + report.deferredCount;
    expect(total).toBe(report.inventoryTotalCount);
  });

  it("inventoryByAccessStatus sums to total", () => {
    const s = report.inventoryByAccessStatus;
    expect(s.verified + s.candidate + s.gap + s.deferred).toBe(report.inventoryTotalCount);
  });

  it("inventoryByCategory covers all entries", () => {
    const categorySum = Object.values(report.inventoryByCategory).reduce((a, b) => a + b, 0);
    expect(categorySum).toBe(report.inventoryTotalCount);
  });

  it("coverageWarnings mentions gap entries", () => {
    // At least one warning about gap entries
    const gapWarning = report.coverageWarnings.find((w) => w.includes("gap"));
    expect(gapWarning).toBeTruthy();
  });

  it("coverageWarnings does NOT contain INTEGRITY ERROR (no non-gov.tr URLs on verified entries)", () => {
    const integrityError = report.coverageWarnings.find((w) => w.includes("INTEGRITY ERROR"));
    expect(integrityError).toBeUndefined();
  });

  it("verifiedEntries array contains expected titles", () => {
    const titles = report.verifiedEntries.map((e) => e.key);
    expect(titles).toContain("hasta-haklari-yonetmeligi");
    expect(titles).toContain("tibbi-deontoloji-nizamnamesi");
    expect(titles).toContain("tababet-kanunu");
    expect(titles).toContain("saglik-hizmetleri-temel-kanunu");
    expect(titles).toContain("kvkk");
  });

  it("gapEntries array contains expected gaps", () => {
    const keys = report.gapEntries.map((e) => e.key);
    expect(keys).toContain("ozel-hastaneler-yonetmeligi");
    expect(keys).toContain("ayakta-teshis-ozel-saglik");
    expect(keys).toContain("saglik-meslek-is-gorev-tanimlari");
  });

  it("core+supporting+specialized sums to total", () => {
    expect(report.coreInventoryCount + report.supportingInventoryCount + report.specializedInventoryCount)
      .toBe(report.inventoryTotalCount);
  });
});
