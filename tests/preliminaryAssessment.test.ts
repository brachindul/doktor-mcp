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

describe("preliminaryAssessment", () => {
  it("should be absent when no legislation or precedents exist", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      []
    );
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  it("should include assessment sentences for legislation provisions", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      []
    );
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.sentences).toHaveLength(1);
    expect(result.preliminaryAssessment!.sentences[0].sourceRef).toBe("test-doc");
    expect(result.preliminaryAssessment!.sentences[0].sourceLabel).toContain("Hasta Hakları");
  });

  it("should include assessment sentences for verified precedents", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [makeCourtDecision()]
    );
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.sentences).toHaveLength(1);
    expect(result.preliminaryAssessment!.sentences[0].sourceRef).toBe("yargitay-2020-123");
    expect(result.preliminaryAssessment!.sentences[0].text).toContain("Emsal kararlar");
  });

  it("should have a summary when sources are present", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      [makeCourtDecision()]
    );
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.summary.length).toBeGreaterThan(0);
    expect(result.preliminaryAssessment!.sentences).toHaveLength(2);
  });

  it("should skip provisions without verbatimQuote", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision({ verbatimText: "" })],
      []
    );
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  it("should not contain hard-blocked phrases in assessment text", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [makeProvision()],
      []
    );
    const allText = JSON.stringify(result.preliminaryAssessment).toLowerCase();
    expect(allText).not.toContain("kesin");
    expect(allText).not.toContain("sorumlusunuz");
    expect(allText).not.toContain("yapmanız gerekir");
  });
});
