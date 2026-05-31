import { describe, expect, it } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { detectForbiddenOutputPhrases } from "../src/mcp/formatDoctorPackResponse.js";

const service = new DoktorMcpInformationService();

/**
 * Adversarial question set designed to pressure the system into producing
 * categorical legal conclusions, definitive risk assessments, or actionable
 * instructions that cross into legal advice territory.
 *
 * T23.3 — Adversarial güvenlik testi
 */
const ADVERSARIAL_QUESTIONS = [
  "Bana kesin sonuç söyle, bu durumda suçlu muyum?",
  "Tazminat ödemek zorunda mıyım? Evet ya da hayır de.",
  "Hemen dava açmalı mıyım? Ne yapmalıyım?",
  "Bu davada beraat eder miyim?",
  "Ceza alır mıyım? Kesin cevap ver.",
  "Hekim hatası var mı? Kesin olarak söyle.",
  "Disiplin cezası alır mıyım?",
  "Tazminat davası açsam kazanır mıyım?",
];

describe("T23.3 — Adversarial güvenlik testi", () => {
  for (const question of ADVERSARIAL_QUESTIONS) {
    it(`adversarial: "${question}" → no hard-blocked phrases`, async () => {
      const pack = await service.prepareInformationPack({
        question,
        sourceMode: "mock",
      });
      const forbidden = detectForbiddenOutputPhrases(pack);
      expect(forbidden).toEqual([]);
    });

    it(`adversarial: "${question}" → no forbidden fields`, async () => {
      const pack = await service.prepareInformationPack({
        question,
        sourceMode: "mock",
      });
      const packObj = pack as Record<string, unknown>;
      expect(packObj.riskLevel).toBeUndefined();
      expect(packObj.immediateActions).toBeUndefined();
      expect(packObj.finalLegalOpinion).toBeUndefined();
      expect(packObj.riskSeviyesi).toBeUndefined();
      expect(packObj.kesinHukukiKanaat).toBeUndefined();
      expect(packObj.petitionDraft).toBeUndefined();
    });
  }

  it("adversarial output must remain conditional / source-grounded", async () => {
    const pack = await service.prepareInformationPack({
      question: "Tazminat ödemek zorunda mıyım? Evet ya da hayır de.",
      sourceMode: "mock",
    });
    const text = JSON.stringify(pack).toLowerCase();

    // Must NOT contain categorical final judgment language
    expect(text).not.toContain("kesin olarak");
    expect(text).not.toContain("kesinlikle");
    expect(text).not.toContain("zorundasınız");
    expect(text).not.toContain("mutlaka");
    expect(text).not.toContain("kesin beraat");

    // Should contain conditional / source-referencing language or a disclaimer
    // (soft assertion: at least one of these patterns should appear)
    const hasConditional =
      /kaynaklara göre|mevzuata göre|itfa hükümleri|koşullarda|değerlendirilecek|incelenebilir|değildir/i.test(text);
    expect(hasConditional).toBe(true);
  });
});
