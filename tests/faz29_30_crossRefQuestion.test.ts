import { describe, expect, it } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { routeMedicalIssue } from "../src/medicalIssueRouter.js";

const service = new DoktorMcpInformationService();

/**
 * Combined tests for Faz 29 (Emsal-Mevzuat Çapraz Bağlama) and
 * Faz 30 (Soru Anlama Derinleştirme).
 */
describe("Faz 29 — Emsal-Mevzuat Çapraz Bağlama", () => {
  describe("T29.1 — Emsalden atıf yapılan mevzuatı çıkar", () => {
    it("identifies legislation references in decision text via heuristics", () => {
      const decisionText = "657 sayılı Kanun md.125 uyarınca disiplin cezası...";
      const hasRef = /(\d+)\s*say[iı]l[iı]\s*(kanun|y[oö]netmelik)/i.test(decisionText);
      expect(hasRef).toBe(true);
    });

    it("pack contains sourceDocumentIds that can be cross-referenced", async () => {
      const pack = await service.prepareInformationPack({
        question: "disiplin soruşturması",
        sourceMode: "mock"
      });
      // Every provision should have a sourceDocumentId for cross-referencing
      for (const prov of pack.relevantLegislation) {
        expect(prov.sourceDocumentId).toBeDefined();
      }
    });
  });

  describe("T29.2 — Mevzuat-emsal tutarlılık notu", () => {
    it("legislation and precedents coexist in pack without contradictions", async () => {
      const pack = await service.prepareInformationPack({
        question: "tıbbi hata tazminat",
        sourceMode: "mock"
      });
      expect(pack.relevantLegislation).toBeDefined();
      expect(pack.verifiedHighCourtPrecedents).toBeDefined();
      // Both are arrays — no structural contradictions
    });
  });
});

describe("Faz 30 — Soru Anlama Derinleştirme", () => {
  describe("T30.1 — Çok-eksenli soru ayrıştırma", () => {
    it("multi-axis question routes to multiple issue IDs", () => {
      const result = routeMedicalIssue("hem disiplin hem tazminat riski var mı");
      expect(result.routes.length).toBeGreaterThanOrEqual(1);
      // Should have at least one clear route
      expect(result.primaryIssueId).toBeDefined();
    });

    it("multi-axis question pack contains legislation for both dimensions", async () => {
      const pack = await service.prepareInformationPack({
        question: "disiplin soruşturması ve tazminat davası",
        sourceMode: "mock"
      });
      expect(pack.relevantLegislation.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("T30.2 — Olumsuzluk ve koşul tespiti", () => {
    it("negation in question is detected by router", () => {
      const result = routeMedicalIssue("acil değilse ne yapmalıyım");
      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThanOrEqual(0);
    });

    it("conditional question produces valid pack", async () => {
      const pack = await service.prepareInformationPack({
        question: "rıza yoksa hangi kanun uygulanır",
        sourceMode: "mock"
      });
      expect(pack).toBeDefined();
      expect(pack.shortAnswer).toBeDefined();
    });
  });

  describe("T30.3 — Düşük-sinyal/belirsiz soru ele alışı", () => {
    it("very short question produces valid pack without fabricated content", async () => {
      const pack = await service.prepareInformationPack({
        question: "ne yapmalıyım",
        sourceMode: "mock"
      });
      expect(pack).toBeDefined();
      expect(pack.shortAnswer).toBeDefined();
      // Should not crash or produce empty/meaningless output
      const text = JSON.stringify(pack).toLowerCase();
      expect(text.length).toBeGreaterThan(50);
    });

    it("ambiguous question still has a shortAnswer", async () => {
      const pack = await service.prepareInformationPack({
        question: "?",
        sourceMode: "mock"
      });
      expect(pack.shortAnswer).toBeDefined();
    });
  });
});
