import { describe, expect, it } from "vitest";
import { createMedicalLegalToolHandlers } from "../src/mcp/tools.js";
import type { DoctorLegalInformationPack, LegislationProvision, CourtDecision } from "../src/contracts/legal.js";

describe("T24.1 — Drill-down aracı", () => {
  const handlers = createMedicalLegalToolHandlers();

  function makePack(legislation: LegislationProvision[] = [], precedents: CourtDecision[] = []): DoctorLegalInformationPack {
    return {
      legalClassification: {
        criminal: "",
        civilCompensation: "",
        disciplinaryAdministrative: "",
        patientRights: "",
        privacyKvkk: "",
        professionalEthics: ""
      },
      relevantLegislation: legislation,
      verifiedHighCourtPrecedents: precedents,
      missingInformation: [],
      lawyerReviewPoints: [],
      sourceWarnings: [],
      coverageGaps: [],
      sourceUnavailable: [],
      shortAnswer: "Test pack"
    };
  }

  it("matches legislation by article number in follow-up question", async () => {
    const pack = makePack([
      { legislationName: "Türk Ceza Kanunu", articleNumber: "86", verbatimQuote: "Cinsel saldırı...", connection: "c", sourceDocumentId: "1" }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "86. madde tam olarak ne diyor?"
    });
    expect(result.matchedLegislation).toHaveLength(1);
    expect(result.matchedLegislation[0].articleNumber).toBe("86");
  });

  it("matches legislation by legislation name in follow-up question", async () => {
    const pack = makePack([
      { legislationName: "Hasta Hakları Yönetmeliği", articleNumber: "5", verbatimQuote: "Hasta bilgilendirilir.", connection: "c", sourceDocumentId: "2" }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Hasta Hakları Yönetmeliği'nin 5. maddesi ne diyor?"
    });
    expect(result.matchedLegislation).toHaveLength(1);
    expect(result.matchedLegislation[0].legislationName).toBe("Hasta Hakları Yönetmeliği");
  });

  it("matches precedent by chamber in follow-up question", async () => {
    const pack = makePack([], [
      { id: "yargitay:123", court: "yargitay", chamber: "Ceza Dairesi", decisionDate: "2023-01-01", factSummary: "Şiddet olayı", evidence: { source: "yargitay", documentId: "123", accessTimestamp: "2023-01-01", retrievalMethod: "api" } }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Ceza Dairesi'nin kararı neydi?"
    });
    expect(result.matchedPrecedents).toHaveLength(1);
    expect(result.matchedPrecedents[0].chamber).toBe("Ceza Dairesi");
  });

  it("returns empty matches when follow-up is unrelated", async () => {
    const pack = makePack([
      { legislationName: "Türk Ceza Kanunu", articleNumber: "86", verbatimQuote: "Cinsel saldırı...", connection: "c", sourceDocumentId: "1" }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Hava durumu nasıl?"
    });
    expect(result.matchedLegislation).toHaveLength(0);
    expect(result.matchedPrecedents).toHaveLength(0);
  });

  it("includes disclaimer and counts in response", async () => {
    const pack = makePack([
      { legislationName: "Kanun A", articleNumber: "1", verbatimQuote: "x", connection: "c", sourceDocumentId: "1" },
      { legislationName: "Kanun B", articleNumber: "2", verbatimQuote: "y", connection: "c", sourceDocumentId: "2" }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "1. madde"
    });
    expect(result.totalLegislationInPack).toBe(2);
    expect(result.totalPrecedentsInPack).toBe(0);
    expect(result.disclaimer).toContain("nihai hukuki yorum değildir");
  });
});
