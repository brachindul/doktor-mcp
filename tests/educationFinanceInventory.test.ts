import { describe, it, expect } from "vitest";
import {
  HEALTH_LEGISLATION_INVENTORY,
  buildInventoryReport
} from "../src/healthLegislationInventory.js";
import { healthLegislationHints } from "../src/sources/legislation/healthMappings.js";

describe("T8.3: education / service quality / financial / clinical-forensic inventory", () => {

  // ── Inventory entries ──────────────────────────────────────────────────────

  it("should include TUEY (Tıpta Uzmanlık Eğitimi) entry with mevzuat:7.5.39700", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "tuey-uzmanlik-egitimi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Uzmanlık Eğitimi");
    expect(entry!.mevzuatSourceId).toBe("mevzuat:7.5.39700");
    expect(entry!.officialSourceStatus).toBe("verified");
    expect(entry!.coverageStatus).toBe("covered");
    expect(entry!.category).toBe("medical_education");
    expect(entry!.relatedTopicClusters).toContain("medical_education");
  });

  it("should include Sağlık Uzmanlığı Yönetmeliği entry", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "saglik-uzmanligi-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Sağlık Uzmanlığı");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.category).toBe("medical_education");
  });

  it("should include Hasta ve Çalışan Güvenliği entry", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "hasta-calisan-guvenligi-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Hasta ve Çalışan Güvenliği");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.category).toBe("service_quality");
    expect(entry!.relatedTopicClusters).toContain("patient_safety");
  });

  it("should include Sağlık Hizmeti Kalitesi entry", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "saglik-hizmeti-kalitesi-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Sağlık Hizmeti Kalitesinin Geliştirilmesi");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.category).toBe("service_quality");
  });

  it("should include Ek Ödeme Yönetmeliği entry", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "saglik-tesisleri-ek-odeme-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Ek Ödeme");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.relatedTopicClusters).toContain("financial_liability");
  });

  it("should include Aile Hekimliği Uygulama Yönetmeliği entry", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "aile-hekimligi-uygulama-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Aile Hekimliği Uygulama");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.relatedTopicClusters).toContain("primary_care");
  });

  it("should include Cenaze Nakil ve Defin entry", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "cenaze-nakil-defin-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Cenaze Nakil ve Defin");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.category).toBe("forensic_administrative");
    expect(entry!.relatedTopicClusters).toContain("death_procedures");
  });

  it("should include Umumi Hıfzıssıhha Kanunu entry (law layer)", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "umumi-hifzissihha-kanunu");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Umumi Hıfzıssıhha");
    expect(entry!.mevzuatSourceId).toBe("mevzuat:1.3.1593");
    expect(entry!.officialSourceStatus).toBe("verified");
    expect(entry!.coverageStatus).toBe("covered");
    expect(entry!.relatedTopicClusters).toContain("public_health");
  });

  it("should include DHY (Devlet Hizmeti Yükümlülüğü) entry (law layer)", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "devlet-hizmeti-yukumlulugu-dhy");
    expect(entry).toBeDefined();
    expect(entry!.title).toContain("Devlet Hizmeti Yükümlülüğü");
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.relatedTopicClusters).toContain("public_employment");
    // sourceId not set because it shares mevzuat:1.5.3359 with the verified saglik-hizmetleri-temel-kanunu entry
    expect(entry!.mevzuatSourceId).toBeUndefined();
  });

  // ── Activated deferred entries ─────────────────────────────────────────────

  it("Yataklı Tedavi entry should now be candidate (activated from deferred)", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "yatakli-tedavi-isletme-yonetmeligi");
    expect(entry).toBeDefined();
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.relatedTopicClusters).toContain("hospital_management");
  });

  it("Mali Sorumluluk Sigortası entry should now be candidate (activated from deferred)", () => {
    const entry = HEALTH_LEGISLATION_INVENTORY.find((e) => e.key === "hekim-mesleki-sorumluluk-sigortasi");
    expect(entry).toBeDefined();
    expect(entry!.officialSourceStatus).toBe("candidate");
    expect(entry!.title).toContain("Tıbbi Kötü Uygulama");
    expect(entry!.relatedTopicClusters).toContain("financial_liability");
  });

  // ── Health mapping hints ───────────────────────────────────────────────────

  it("should have medical_education health mapping hints", () => {
    const hints = healthLegislationHints.filter((h: any) =>
      h.topicCluster === "medical_education"
    );
    expect(hints.length).toBeGreaterThanOrEqual(2);
    // TUEY hint should now have verified sourceId
    const tueyHint = hints.find((h: any) => h.sourceId === "mevzuat:7.5.39700");
    expect(tueyHint).toBeDefined();
    expect(tueyHint!.terms).toContain("tuey");
  });

  it("should have patient_safety health mapping hints", () => {
    const hints = healthLegislationHints.filter((h: any) =>
      h.topicCluster === "patient_safety"
    );
    expect(hints.length).toBeGreaterThanOrEqual(1);
  });

  it("should have healthcare_quality health mapping hints", () => {
    const hints = healthLegislationHints.filter((h: any) =>
      h.topicCluster === "healthcare_quality"
    );
    expect(hints.length).toBeGreaterThanOrEqual(1);
  });

  it("should have public_health health mapping hints", () => {
    const hints = healthLegislationHints.filter((h: any) =>
      h.topicCluster === "public_health"
    );
    expect(hints.length).toBeGreaterThanOrEqual(1);
    const hifzHint = hints.find((h: any) => h.sourceId === "mevzuat:1.3.1593");
    expect(hifzHint).toBeDefined();
  });

  it("ek-odeme hint should exist with proper terms", () => {
    const hint = healthLegislationHints.find((h: any) =>
      h.sourceId === "needs_manual_review:ek-odeme"
    );
    expect(hint).toBeDefined();
    expect(hint!.terms).toContain("ek ödeme");
    expect(hint!.terms).toContain("döner sermaye");
  });

  // ── Inventory totals ───────────────────────────────────────────────────────

  it("inventory total count should include all new entries", () => {
    const report = buildInventoryReport();
    // Should be at least 30 entries now (25 before + 11 new + 2 activated deferred = 38)
    expect(report.inventoryTotalCount).toBeGreaterThanOrEqual(35);
  });

  it("candidate count should increase significantly", () => {
    const report = buildInventoryReport();
    // Previous candidates were ~10, now should be much more
    expect(report.candidateOfficialSourceCount).toBeGreaterThanOrEqual(15);
  });

  it("deferred count should decrease (2 entries activated)", () => {
    const report = buildInventoryReport();
    // Previously had 4 deferred (ambulans, yatakli, hekim sigorta, radyoloji)
    // Activated 2 (yatakli, hekim sigorta) → should be 2 remaining
    expect(report.deferredCount).toBeLessThanOrEqual(2);
  });

  it("should have entries in new categories", () => {
    const report = buildInventoryReport();
    expect(report.inventoryByCategory["medical_education"]).toBeGreaterThanOrEqual(2);
    expect(report.inventoryByCategory["service_quality"]).toBeGreaterThanOrEqual(2);
    expect(report.inventoryByCategory["forensic_administrative"]).toBeGreaterThanOrEqual(1);
  });
});
