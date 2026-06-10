import { describe, expect, it } from "vitest";
import { createMedicalLegalToolHandlers } from "../src/mcp/tools.js";
import type { DoctorLegalInformationPack, LegislationProvision, CourtDecision } from "../src/contracts/legal.js";

describe("E0.1 — drill_down_pack_item includes('') bug fix", () => {
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

  it("precedent with all undefined fields does NOT match an unrelated follow-up question", async () => {
    const pack = makePack([], [
      {
        id: "yargitay:001",
        court: "yargitay",
        // chamber, sourceDocumentId, sourceId are all undefined
        decisionDate: "2023-01-01",
        factSummary: "Test precedent",
        topicTags: [],
        evidence: { source: "yargitay", documentId: "001", accessTimestamp: "2023-01-01", retrievalMethod: "api" }
      }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "Hava durumu nasıl bugün?"
    });
    // Bug: before the fix, every precedent with undefined fields matched every question
    expect(result.matchedPrecedents).toHaveLength(0);
  });

  it("precedent with chamber matches follow-up question mentioning that chamber", async () => {
    const pack = makePack([], [
      {
        id: "yargitay:100",
        court: "yargitay",
        chamber: "13. Hukuk Dairesi",
        decisionDate: "2023-06-15",
        factSummary: "Hekim sorumluluk davası",
        topicTags: [],
        evidence: { source: "yargitay", documentId: "100", accessTimestamp: "2023-06-15", retrievalMethod: "api" }
      }
    ]);
    const result = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "13. hukuk dairesi kararını açar mısın"
    });
    expect(result.matchedPrecedents).toHaveLength(1);
    expect(result.matchedPrecedents[0].chamber).toBe("13. Hukuk Dairesi");
  });

  it("legislation with articleNumber 24 matches 'madde 24' but not 'madde 26'", async () => {
    const pack = makePack([
      {
        legislationName: "Türk Ticaret Kanunu",
        articleNumber: "24",
        verbatimQuote: "Ticari defterlerin tutulması...",
        connection: "c",
        sourceDocumentId: "ttk-24"
      }
    ]);

    const matchResult = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "madde 24 ne diyor"
    });
    expect(matchResult.matchedLegislation).toHaveLength(1);
    expect(matchResult.matchedLegislation[0].articleNumber).toBe("24");

    const noMatchResult = await handlers.drill_down_pack_item({
      pack,
      followUpQuestion: "madde 26 ne diyor"
    });
    expect(noMatchResult.matchedLegislation).toHaveLength(0);
  });
});
