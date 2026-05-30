import { describe, it, expect } from "vitest";
import { composeDoctorLegalInformationPack } from "../src/health/answerComposer.js";
import type {
  ClassifiedMedicalLegalQuestion,
  LegislationProvision,
  CourtDecision,
  SourceEvidence
} from "../src/contracts/legal.js";

function makeEvidence(): SourceEvidence {
  return {
    source: "legislation",
    documentId: "test-doc",
    retrievedAt: new Date().toISOString(),
    official: true,
    fullText: true,
  };
}

function makeClassification(overrides: Partial<ClassifiedMedicalLegalQuestion> = {}): ClassifiedMedicalLegalQuestion {
  return {
    question: "test question",
    dimensions: ["patient_rights"],
    searchTerms: ["test"],
    missingInformation: [],
    ...overrides,
  };
}

function makeProvision(overrides: Partial<LegislationProvision> = {}): LegislationProvision {
  return {
    documentId: "hasta-haklari-md-5",
    legislationName: "Hasta Hakları Yönetmeliği",
    articleNumber: "md. 5",
    verbatimText: "Hasta, sağlık hizmetlerinden faydalanma hakkına sahiptir.",
    connection: "Hasta hakları boyutu ile ilgili",
    dimensions: ["patient_rights"],
    evidence: makeEvidence(),
    sourceTrace: {
      query: "hasta hakları",
      matchedHealthMapping: {
        sourceId: "hasta-haklari",
        query: "hasta hakları",
        title: "Hasta Hakları Yönetmeliği",
        articleNumbers: ["5"],
      },
      officialSearchRequest: null,
      officialSearchResultsCount: 0,
      selectedSearchResult: null,
      selectedResultReason: null,
      landingUrl: null,
      detailUrl: null,
      fullTextUrl: null,
      directPdfUrl: null,
      generatedPdfUrl: null,
      contentType: null,
      extractionMethod: null,
      extractedArticleNumbers: [],
      retrievedAt: null,
    },
    ...overrides,
  };
}

function makeCourtDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "yargitay-2020-123",
    court: "yargitay",
    chamber: "12. Ceza Dairesi",
    decisionDate: "2020-01-15",
    meritsNumber: "2019/1234",
    decisionNumber: "2020/567",
    factSummary: "Benzer bir vaka",
    legalReasoning: "Mahkeme değerlendirmesi",
    outcome: "Kabul",
    relevanceNote: "Benzer dava",
    topicTags: ["patient_rights"],
    evidence: {
      source: "yargitay",
      documentId: "yargitay-2020-123",
      retrievedAt: new Date().toISOString(),
      official: true,
      fullText: true,
    },
    ...overrides,
  };
}

describe("assessmentTone", () => {
  it("should include preliminaryAssessment in grounded-advisory mode (default)", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()]
    );
    expect(result.preliminaryAssessment).toBeDefined();
  });

  it("should include preliminaryAssessment when tone is explicitly grounded-advisory", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    expect(result.preliminaryAssessment).toBeDefined();
  });

  it("should NOT include preliminaryAssessment in strict mode", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()],
      [],
      undefined,
      undefined,
      "strict"
    );
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  it("should default to grounded-advisory when no tone specified", () => {
    const result1 = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()]
    );
    const result2 = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    expect(result1.preliminaryAssessment).toBeDefined();
    expect(result2.preliminaryAssessment).toBeDefined();
  });

  it("should still include sources in strict mode (just no assessment)", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()],
      [],
      undefined,
      undefined,
      "strict"
    );
    expect(result.relevantLegislation).toHaveLength(1);
    expect(result.verifiedHighCourtPrecedents).toHaveLength(1);
    expect(result.preliminaryAssessment).toBeUndefined();
    expect(result.shortAnswer.length).toBeGreaterThan(0);
  });

  it("should not include preliminaryAssessment in strict mode with no sources either", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [],
      [],
      undefined,
      undefined,
      "strict"
    );
    expect(result.preliminaryAssessment).toBeUndefined();
    expect(result.relevantLegislation).toHaveLength(0);
    expect(result.verifiedHighCourtPrecedents).toHaveLength(0);
  });
});
