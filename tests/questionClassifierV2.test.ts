import { describe, it, expect } from "vitest";
import { classifyMedicalLegalQuestion } from "../src/health/questionClassifier.js";

/**
 * E4.2: Regression tests for the token-based question classifier.
 *
 * Critical behavioral differences from the old String.includes() approach:
 * - "verildi" no longer matches "veri" (was a false positive before)
 * - Token mode is suffix-aware (e.g. "aydınlatılmış" matches "aydinlat" prefix)
 * - Substring mode uses full folded text for multi-word terms
 */

describe("E4.2: token-based question classifier", () => {
  // ── Critical regression: "verildi" should NOT match "veri" ────────────

  it('"verildi" does NOT trigger privacy_kvkk dimension', () => {
    const result = classifyMedicalLegalQuestion("Hastaya ilaç verildi");
    expect(result.dimensions).not.toContain("privacy_kvkk");
  });

  it('"verilen" does NOT trigger privacy_kvkk dimension', () => {
    const result = classifyMedicalLegalQuestion("Verilen bilgiler gizlidir");
    expect(result.dimensions).not.toContain("privacy_kvkk");
  });

  // ── "sağlık verisi" SHOULD match via substring ────────────────────────

  it('"sağlık verisi" triggers privacy_kvkk dimension', () => {
    const result = classifyMedicalLegalQuestion("Kişisel sağlık verisi paylaşımı");
    expect(result.dimensions).toContain("privacy_kvkk");
  });

  it('"saglik verisi" (ASCII) triggers privacy_kvkk dimension', () => {
    const result = classifyMedicalLegalQuestion("Kisisel saglik verisi paylasimi");
    expect(result.dimensions).toContain("privacy_kvkk");
  });

  // ── "verisi" should still match via allowedTokens ─────────────────────

  it('"verisi" matches privacy_kvkk via allowedTokens', () => {
    const result = classifyMedicalLegalQuestion("Hastanın verisi gizlidir");
    expect(result.dimensions).toContain("privacy_kvkk");
  });

  it('"verileri" matches privacy_kvkk via allowedTokens', () => {
    const result = classifyMedicalLegalQuestion("Hasta verileri kimlerle paylaşılabilir");
    expect(result.dimensions).toContain("privacy_kvkk");
  });

  // ── Fallback behavior ─────────────────────────────────────────────────

  it("completely unrelated question gets fallback dimensions", () => {
    const result = classifyMedicalLegalQuestion("Bugün hava çok güzel");
    expect(result.dimensions).toContain("professional_ethics");
    expect(result.dimensions).toContain("patient_rights");
    expect(result.classificationConfidence).toBe("fallback");
  });

  it("matched question gets confidence 'matched'", () => {
    const result = classifyMedicalLegalQuestion("Hasta rıza verdi mi?");
    expect(result.classificationConfidence).toBe("matched");
  });

  // ── Substring mode for multi-word terms ───────────────────────────────

  it('"mecburi hizmet" matches via substring', () => {
    const result = classifyMedicalLegalQuestion("Mecburi hizmet ataması yapıldı");
    expect(result.dimensions).toContain("disciplinary_administrative");
  });

  it('"sosyal medya" matches via substring', () => {
    const result = classifyMedicalLegalQuestion("Sosyal medyada hasta fotoğrafı paylaşımı");
    expect(result.dimensions).toContain("privacy_kvkk");
  });

  // ── Prefix mode for derived words ────────────────────────────────────

  it('"aydınlatılmış" matches "aydinlat" prefix', () => {
    const result = classifyMedicalLegalQuestion("Aydınlatılmış rıza formu imzalanmadı");
    expect(result.dimensions).toContain("patient_rights");
  });

  it('"reddederse" matches "reddet" prefix', () => {
    const result = classifyMedicalLegalQuestion("Hasta tedaviyi reddederse ne olur?");
    expect(result.dimensions).toContain("professional_ethics");
  });

  // ── Token mode with suffix ───────────────────────────────────────────

  it('"hekimler" matches "hekim" token with valid suffix', () => {
    const result = classifyMedicalLegalQuestion("Hekimlerin görevi nedir?");
    expect(result.dimensions).toContain("patient_rights");
  });

  // ── Diacritic folding ────────────────────────────────────────────────

  it('"rıza" and "riza" both match via foldTr', () => {
    const r1 = classifyMedicalLegalQuestion("Rıza verildi mi?");
    const r2 = classifyMedicalLegalQuestion("Riza verildi mi?");
    expect(r1.dimensions).toContain("patient_rights");
    expect(r2.dimensions).toContain("patient_rights");
  });

  // ── Branch-specific terms ────────────────────────────────────────────

  it('"acil servis" maps to emergency_services', () => {
    const result = classifyMedicalLegalQuestion("Acil serviste hekim görevi");
    expect(result.dimensions).toContain("emergency_services");
  });

  it('"anestezi" maps to professional_ethics', () => {
    const result = classifyMedicalLegalQuestion("Anestezi öncesi hasta");
    expect(result.dimensions).toContain("professional_ethics");
  });

  // ── classificationConfidence field ────────────────────────────────────

  it("returns classificationConfidence field", () => {
    const result = classifyMedicalLegalQuestion("Hasta rızası");
    expect(result).toHaveProperty("classificationConfidence");
    expect(typeof result.classificationConfidence).toBe("string");
  });

  it("fallback returns classificationConfidence 'fallback'", () => {
    const result = classifyMedicalLegalQuestion("Random gibberish xyz");
    expect(result.classificationConfidence).toBe("fallback");
  });
});
