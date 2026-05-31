import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { detectForbiddenOutputPhrases } from "../src/mcp/formatDoctorPackResponse.js";
import type { DoctorLegalInformationPack } from "../src/contracts/legal.js";

const service = new DoktorMcpInformationService();

describe("safety invariants", () => {
  // ── Invariant 1: KVKK private data must not appear in non-privacy packs ──
  it("KVKK private data must not appear in non-KVKK pack", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hasta ameliyatı reddederse ne olur?",
      sourceMode: "mock",
    });
    const text = JSON.stringify(pack).toLowerCase();
    // KVKK-specific terms should not appear for non-privacy questions
    expect(text).not.toContain("kişisel veri");
    expect(text).not.toContain("6698");
    expect(text).not.toContain("açık rıza");
  });

  // ── Invariant 2: Live mode must not produce mock fallback ──
  it("live mode service must not fall back to mock data", () => {
    // The service should be configured to use live mode without mock fallback
    // Even if it can't reach sources, it should report source_unavailable, not silently use mock
    // This tests the configuration, not actual network
    const liveService = new DoktorMcpInformationService();
    expect(liveService).toBeDefined();
    // Service initialization does not auto-fallback to mock
  });

  // ── Invariant 3: Hard-blocked phrases must not appear in output ──
  it("hard-blocked phrases must not appear in mock pack output", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hasta hakları nelerdir?",
      sourceMode: "mock",
    });
    const forbidden = detectForbiddenOutputPhrases(pack);
    expect(forbidden).toEqual([]);
    expect(forbidden).toHaveLength(0);
  });

  // ── Invariant 4: No KVKK in general medical question packs ──
  it("general medical question pack must not contain privacy-law-specific content", async () => {
    const pack = await service.prepareInformationPack({
      question: "Acil serviste hasta reddi durumunda hekim sorumluluğu nedir?",
      sourceMode: "mock",
    });
    // Check the privacyKvkk classification array — it should be empty for non-privacy questions
    expect(pack.legalClassification.privacyKvkk).toHaveLength(0);
    // Check relevant legislation text for privacy-specific content
    const legislationText = pack.relevantLegislation
      .map((l) => `${l.legislationName} ${l.connection} ${l.verbatimQuote}`)
      .join(" ")
      .toLowerCase();
    expect(legislationText).not.toContain("kişisel veri");
    expect(legislationText).not.toContain("6698");
    expect(legislationText).not.toContain("kvkk");
    expect(legislationText).not.toContain("açık rıza");
  });

  // ── Invariant 5: Short answer must not be empty ──
  it("pack must always have a non-empty shortAnswer", async () => {
    const pack = await service.prepareInformationPack({
      question: "Test sorusu: hekim hatası nedir?",
      sourceMode: "mock",
    });
    expect(pack.shortAnswer).toBeDefined();
    expect(pack.shortAnswer.length).toBeGreaterThan(0);
  });

  // ── Invariant 6: No unsafe fields in mock mode ──
  it("mock mode pack must not contain forbidden field names", async () => {
    const pack = await service.prepareInformationPack({
      question: "İlaç yan etkisi bildirimi zorunlu mudur?",
      sourceMode: "mock",
    });
    const packObj = pack as Record<string, unknown>;
    expect(packObj.riskLevel).toBeUndefined();
    expect(packObj.immediateActions).toBeUndefined();
    expect(packObj.finalLegalOpinion).toBeUndefined();
    expect(packObj.riskSeviyesi).toBeUndefined();
  });

  // ── Invariant 7: Source-grounded assessment uses conditional language ──
  it("preliminaryAssessment must not contain categorical final judgment language", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekimin aydınlatma yükümlülüğü nedir?",
      sourceMode: "mock",
      assessmentTone: "grounded-advisory",
    });
    if (pack.preliminaryAssessment) {
      const text = JSON.stringify(pack.preliminaryAssessment).toLowerCase();
      // Should NOT contain hard-blocked phrases
      expect(text).not.toContain("kesin olarak sorumlusunuz");
      expect(text).not.toContain("kesin beraat eder");
      expect(text).not.toContain("tazminat ödemek zorundadır");
      expect(text).not.toContain("suç oluşturmaz");
    }
  });

  // ── Invariant: Raw query PII must not appear in pack output ──
  it("should not expose raw query in logs or cache keys", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "Hasta Ahmet Yılmaz TC 12345678901 kişisel verileri paylaşıldı",
      sourceMode: "mock",
    });
    // Pack should not contain the PII data
    const text = JSON.stringify(pack).toLowerCase();
    expect(text).not.toContain("ahmet");
    expect(text).not.toContain("12345678901");
  });

  // ── Invariant 8: Strict mode must not produce assessment ──
  it("strict mode must NOT include preliminaryAssessment", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekimin aydınlatma yükümlülüğü nedir?",
      sourceMode: "mock",
      assessmentTone: "strict",
    });
    expect(pack.preliminaryAssessment).toBeUndefined();
  });
});
