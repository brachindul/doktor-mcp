import { describe, expect, it } from "vitest";
import { scoreBenchmarkItem } from "../src/benchmark/scoring.js";
import type { BenchmarkQuestion, DoctorLegalInformationPack, VerifiedPrecedentAuditEntry } from "../src/contracts/legal.js";

function makeQuestion(): BenchmarkQuestion {
  return {
    id: "test",
    category: "test",
    question: "test question",
    expectedTopicClusters: [],
    expectedPrimaryLegislationRoles: {},
    expectedPrimaryLegislationNames: ["Test Kanun"],
    shouldIncludeLegislation: ["Test Kanun"],
    shouldNotIncludeLegislation: [],
    expectedPrecedentSources: [],
    forbiddenFields: [],
    notes: ""
  };
}

function makePack(overrides: Partial<DoctorLegalInformationPack> = {}): DoctorLegalInformationPack {
  return {
    legalClassification: {
      criminal: "",
      civilCompensation: "",
      disciplinaryAdministrative: "",
      patientRights: "",
      privacyKvkk: "",
      professionalEthics: ""
    },
    relevantLegislation: [],
    verifiedHighCourtPrecedents: [],
    missingInformation: [],
    lawyerReviewPoints: [],
    sourceWarnings: [],
    coverageGaps: [],
    sourceUnavailable: [],
    ...overrides
  } as DoctorLegalInformationPack;
}

describe("T23.2 — çok-eksenli kalite skorlaması", () => {
  it("lawRegulationBalanceScore is 1 when both Kanun and Yönetmelik are present", () => {
    const pack = makePack({
      relevantLegislation: [
        { legislationName: "Test Kanun", articleNumber: "1", verbatimQuote: "x", connection: "c", sourceDocumentId: "1" },
        { legislationName: "Test Yönetmeliği", articleNumber: "1", verbatimQuote: "y", connection: "c", sourceDocumentId: "2" }
      ]
    });
    const result = scoreBenchmarkItem({
      question: makeQuestion(),
      pack,
      legislationOrder: ["Test Kanun", "Test Yönetmeliği"],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(result.lawRegulationBalanceScore).toBe(1);
  });

  it("lawRegulationBalanceScore is 0 when only one type is present", () => {
    const pack = makePack({
      relevantLegislation: [
        { legislationName: "Test Kanun", articleNumber: "1", verbatimQuote: "x", connection: "c", sourceDocumentId: "1" }
      ]
    });
    const result = scoreBenchmarkItem({
      question: makeQuestion(),
      pack,
      legislationOrder: ["Test Kanun"],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(result.lawRegulationBalanceScore).toBe(0);
  });

  it("axisCoverageScore is 2 when >=3 classification dimensions are populated", () => {
    const pack = makePack({
      legalClassification: {
        criminal: "Ceza boyutu.",
        civilCompensation: "Tazminat boyutu.",
        disciplinaryAdministrative: "Disiplin boyutu.",
        patientRights: "",
        privacyKvkk: "",
        professionalEthics: ""
      }
    });
    const result = scoreBenchmarkItem({
      question: makeQuestion(),
      pack,
      legislationOrder: [],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(result.axisCoverageScore).toBe(2);
  });

  it("axisCoverageScore is 1 when 1-2 classification dimensions are populated", () => {
    const pack = makePack({
      legalClassification: {
        criminal: "",
        civilCompensation: "",
        disciplinaryAdministrative: "Disiplin boyutu.",
        patientRights: "",
        privacyKvkk: "",
        professionalEthics: ""
      }
    });
    const result = scoreBenchmarkItem({
      question: makeQuestion(),
      pack,
      legislationOrder: [],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(result.axisCoverageScore).toBe(1);
  });

  it("precedentRelevanceScore reflects average verified precedent relevance", () => {
    const pack = makePack({
      verifiedHighCourtPrecedents: [{ id: "p1" } as any]
    });
    const audit: VerifiedPrecedentAuditEntry[] = [
      { decisionId: "p1", healthLawRelevanceScore: 3, errors: [], warnings: [] }
    ];
    const result = scoreBenchmarkItem({
      question: makeQuestion(),
      pack,
      legislationOrder: [],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      },
      verifiedPrecedentAudit: audit
    });
    expect(result.precedentRelevanceScore).toBe(2);
  });

  it("totalScore includes new dimensions and maxScore is 15", () => {
    const pack = makePack({
      relevantLegislation: [
        { legislationName: "Test Kanun", articleNumber: "1", verbatimQuote: "x", connection: "c", sourceDocumentId: "1", sourceTrace: { query: "q" } as any }
      ]
    });
    const result = scoreBenchmarkItem({
      question: makeQuestion(),
      pack,
      legislationOrder: ["Test Kanun"],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(result.maxScore).toBe(15);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(15);
  });
});
