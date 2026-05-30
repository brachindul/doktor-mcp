import { describe, it, expect } from "vitest";
import {
  HEALTH_LEGISLATION_INVENTORY,
  buildInventoryReport
} from "../src/healthLegislationInventory.js";
import { healthLegislationHints } from "../src/sources/legislation/healthMappings.js";

describe("public employment legislation inventory", () => {
  it("should include at least 6 new public employment entries", () => {
    const pubEntries = HEALTH_LEGISLATION_INVENTORY.filter((item) =>
      item.relatedTopicClusters?.includes("public_employment") ||
      item.relatedTopicClusters?.includes("transfer_assignment") ||
      item.relatedTopicClusters?.includes("disciplinary_administrative") ||
      (item.title && (
        item.title.includes("Atama ve Yer Değiştirme") ||
        item.title.includes("Disiplin Amirleri Yönetmeliği") ||
        item.title.includes("4924") ||
        item.title.includes("Görevde Yükselme") ||
        item.title.includes("Sözleşmeli Sağlık Personeli Disiplin") ||
        item.title.includes("Açıktan Kura")
      ))
    );
    expect(pubEntries.length).toBeGreaterThanOrEqual(6);
  });

  it("Atama ve Yer Değiştirme entry should have sourceId mevzuat:7.5.17232", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((item) =>
      item.title?.includes("Atama ve Yer Değiştirme") && item.title?.includes("Sağlık Bakanlığı")
    );
    expect(entry).toBeDefined();
    expect(entry!.mevzuatSourceId).toBe("mevzuat:7.5.17232");
  });

  it("should have at least 3 new health mapping hints for public_employment or transfer_assignment", () => {
    const pubHints = healthLegislationHints.filter((h: any) =>
      h.topicCluster === "public_employment" || h.topicCluster === "transfer_assignment"
    );
    expect(pubHints.length).toBeGreaterThanOrEqual(3);
  });

  it("should have at least 2 disciplinary_administrative health mapping hints", () => {
    const discHints = healthLegislationHints.filter((h: any) =>
      h.topicCluster === "disciplinary_administrative"
    );
    expect(discHints.length).toBeGreaterThanOrEqual(2);
  });

  it("all 6 new entries should have candidate status", () => {
    const newKeys = [
      "saglik-bakanligi-atama-yer-degistirme-yonetmeligi",
      "saglik-bakanligi-gorevde-yukselme-unvan-degisikligi",
      "saglik-bakanligi-disiplin-amirleri-yonetmeligi",
      "sozlesmeli-saglik-personeli-disiplin",
      "4924-sozlesmeli-saglik-atama-yer-degistirme",
      "aciktan-kura-ile-atanacak-saglik-personeli"
    ];
    for (const key of newKeys) {
      const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === key);
      expect(entry, `Entry ${key} should exist`).toBeDefined();
      expect(entry!.officialSourceStatus, `Entry ${key} should be candidate`).toBe("candidate");
    }
  });

  it("inventory report total count should include new entries", () => {
    const report = buildInventoryReport();
    // Original count was around 19-20 entries; now should be at least 25
    expect(report.inventoryTotalCount).toBeGreaterThanOrEqual(25);
  });

  it("candidate count should increase by at least 6", () => {
    const report = buildInventoryReport();
    // Original candidates were 4 (acil, isyeri hekimi, kisisel saglik, disiplin yonetmeligi)
    // + 6 new = at least 10
    expect(report.candidateOfficialSourceCount).toBeGreaterThanOrEqual(10);
  });
});
