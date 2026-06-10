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

  it("E0.1: does NOT match precedent with undefined chamber/sourceDocumentId/sourceId (includes-empty-string bug)", async () => {
    // Precedent with all optional fields undefined. Before E0.1 fix,
    // `q.includes(undefined ?? "")` === `q.includes("")` === true for EVERY question.
    const pack = makePack([], [
      { id: "prec:1", court: "yargitay", chamber: undefined, decisionDate: "2023-01-01", factSummary: "x",
        evidence: { source: "yargitay", documentId: "prec:1", accessTimestamp: "2023-01-01", retrievalMethod: "api" } }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Tamamen alakasız bir soru bu, hiçbir terim içermiyor."
    });
    expect(result.matchedPrecedents).toHaveLength(0);
  });

  it("E0.1: DOES match precedent by chamber when chamber is mentioned in follow-up", async () => {
    const pack = makePack([], [
      { id: "prec:2", court: "yargitay", chamber: "13. Hukuk Dairesi", decisionDate: "2023-01-01", factSummary: "x",
        evidence: { source: "yargitay", documentId: "prec:2", accessTimestamp: "2023-01-01", retrievalMethod: "api" } }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "13. Hukuk Dairesi kararını açar mısınız?"
    });
    expect(result.matchedPrecedents).toHaveLength(1);
    expect(result.matchedPrecedents[0].chamber).toBe("13. Hukuk Dairesi");
  });

  it("E0.1: matches legislation by article number, does NOT match different article number", async () => {
    const pack = makePack([
      { legislationName: "Kanun X", articleNumber: "24", verbatimQuote: "Madde 24 metni...", connection: "c", sourceDocumentId: "3" }
    ]);
    const match24 = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Madde 24 ne diyor?"
    });
    expect(match24.matchedLegislation).toHaveLength(1);
    expect(match24.matchedLegislation[0].articleNumber).toBe("24");

    const match26 = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Madde 26 ne diyor?"
    });
    expect(match26.matchedLegislation).toHaveLength(0);
  });

  describe("E0.2: Zod validation gap", () => {
    it("filter_reasoned_precedents returns structured error for invalid decisions input", async () => {
      const result = await handlers.filter_reasoned_precedents({
        decisions: [{ foo: "bar" }],
        query: "malpraktis"
      });
      expect(result).toHaveProperty("ok", false);
      expect(result).toHaveProperty("errorCode", "invalid_input");
      expect(result).toHaveProperty("issues");
    });

    it("filter_reasoned_precedents accepts valid CourtDecision array", async () => {
      const result = await handlers.filter_reasoned_precedents({
        decisions: [{
          id: "valid-1",
          court: "yargitay",
          evidence: { fullText: true, documentId: "doc-1" }
        }],
        query: "malpraktis"
      });
      expect(result).toHaveProperty("filtered");
      expect(result).toHaveProperty("diagnostics");
      expect(Array.isArray(result.filtered)).toBe(true);
    });

    it("drill_down_pack_item returns structured error for invalid pack input", async () => {
      const result = await handlers.drill_down_pack_item({
        pack: { notRelevantLegislation: "wrong" },
        followUpQuestion: "bir soru"
      });
      expect(result).toHaveProperty("ok", false);
      expect(result).toHaveProperty("errorCode", "invalid_input");
    });

    it("drill_down_pack_item works with valid pack", async () => {
      const pack = makePack([
        { legislationName: "Test Kanunu", articleNumber: "1", verbatimQuote: "Test", connection: "c", sourceDocumentId: "1" }
      ]);
      const result = await handlers.drill_down_pack_item({
        pack,
        followUpQuestion: "1. madde ne diyor?"
      });
      expect(result).toHaveProperty("matchedLegislation");
      expect(result.matchedLegislation).toHaveLength(1);
      expect(result).not.toHaveProperty("ok", false);
    });
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
