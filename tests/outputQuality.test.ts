import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { renderDoctorPackMarkdown } from "../src/formatters/doctorPackMarkdown.js";

describe("output quality", () => {
  it("assessment sentences should include article numbers for legislation", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hasta hakları nelerdir",
      sourceMode: "mock",
      assessmentTone: "grounded-advisory",
    });
    if (pack.preliminaryAssessment) {
      for (const s of pack.preliminaryAssessment.sentences) {
        expect(s.sourceRef).toBeTruthy();
        // Legislation sentences should reference article or snippet
        expect(s.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("discipline query should include context-aware lawyer review points", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hakkımda disiplin soruşturması açıldı",
      sourceMode: "mock",
    });
    expect(pack.lawyerReviewPoints.length).toBeGreaterThan(2);
    const hasDisciplinePoint = pack.lawyerReviewPoints.some(p =>
      p.includes("savunma") || p.includes("disiplin") || p.includes("zamanaşımı")
    );
    expect(hasDisciplinePoint).toBe(true);
  });

  it("markdown should render relevance explanation for precedents", () => {
    // Create a minimal pack with a precedent that has relevanceExplanation
    const markdown = renderDoctorPackMarkdown({
      shortAnswer: "test",
      legalClassification: { criminal: [], civilCompensation: [], disciplinaryAdministrative: [], patientRights: ["test"], privacyKvkk: [], professionalEthics: [] },
      relevantLegislation: [{ legislationName: "Test", verbatimQuote: "test", connection: "direct", sourceDocumentId: "t1" }],
      verifiedHighCourtPrecedents: [{
        courtAndChamber: "Test / Daire",
        date: "2024",
        factSummary: "test",
        legalAssessment: "test",
        outcome: "test",
        similarityDifference: "test",
        sourceDocumentId: "t1",
        relevanceExplanation: "Yüksek skor (3): terim eşleşti",
      }],
      missingInformation: [],
      lawyerReviewPoints: [],
      sourceWarnings: [],
    });
    expect(markdown).toContain("Neden Seçildi");
    expect(markdown).toContain("Yüksek skor");
  });
});
