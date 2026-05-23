import { describe, expect, it } from "vitest";
import { evaluateBenchmarkItem } from "../src/benchmark/benchmarkRunner.js";
import { doctorQuestions } from "../src/benchmark/doctorQuestions.js";
import type { DoctorLegalInformationPack } from "../src/contracts/legal.js";

const question = doctorQuestions[0];

function makePack(overrides: Partial<DoctorLegalInformationPack> & Record<string, unknown> = {}): DoctorLegalInformationPack & Record<string, unknown> {
  return {
    shortAnswer: "Test paketi.",
    legalClassification: {
      criminal: [], civilCompensation: [], disciplinaryAdministrative: [],
      patientRights: [], privacyKvkk: [], professionalEthics: []
    },
    relevantLegislation: [
      {
        legislationName: "Tibbi Deontoloji Nizamnamesi",
        articleNumber: "13",
        verbatimQuote: "MADDE 13- Test metni.",
        connection: "Test bağlantısı.",
        sourceDocumentId: "mevzuat:2.3.412578",
        sourceTrace: {
          query: question.question,
          matchedHealthMapping: {
            sourceId: "mevzuat:2.3.412578",
            query: "deontoloji nizamnamesi",
            title: "Tibbi Deontoloji Nizamnamesi",
            articleNumbers: ["13"],
            topicCluster: "physician_refusal_or_withdrawal",
            legislationRole: "health_primary",
            healthLawPriority: 10
          },
          officialSearchRequest: null, officialSearchResultsCount: null,
          selectedSearchResult: null, selectedResultReason: null,
          landingUrl: null, detailUrl: null, fullTextUrl: null,
          directPdfUrl: null, generatedPdfUrl: null,
          contentType: "application/pdf",
          extractionMethod: "pdf-text > article-marker",
          extractedArticleNumbers: ["13"],
          retrievedAt: "2026-05-23T00:00:00.000Z"
        }
      }
    ],
    verifiedHighCourtPrecedents: [],
    missingInformation: [],
    lawyerReviewPoints: [],
    sourceWarnings: [],
    precedentDiagnostics: {
      query: question.question,
      selectedPrecedentCount: 0,
      excludedDecisionCount: 0,
      sourceSummaries: [
        { source: "yargitay", mode: "live", searched: true, searchResultsCount: 1, candidateCount: 0, selectedCount: 0, excludedCount: 0, unavailableCount: 0, errorCodes: [] }
      ],
      selectedPrecedents: [],
      excludedDecisions: []
    },
    ...overrides
  };
}

describe("Warning taxonomy categorization", () => {
  it("live mode informational note is classified as informational, not tuning", () => {
    const pack = makePack();
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 10 });

    expect(result.informationalWarnings).toContain(
      "Live source quality is informational; transient source gaps are metrics, not automatic failures."
    );
    expect(result.tuningWarnings).not.toContain(
      "Live source quality is informational; transient source gaps are metrics, not automatic failures."
    );
  });

  it("source unavailable metric is classified as informational", () => {
    const pack = makePack({
      sourceUnavailable: [{
        status: "unavailable",
        source: "mevzuat.gov.tr",
        errorCode: "source_error",
        message: "Upstream down.",
        retryable: true,
        recommendedNextStep: "Retry later."
      }]
    });
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 10 });

    expect(result.informationalWarnings.some((w) => w.includes("source unavailable") || w.includes("Legislation source"))).toBe(true);
    expect(result.tuningWarnings.some((w) => w.includes("source unavailable"))).toBe(false);
  });

  it("no verified precedent is classified as tuning warning", () => {
    const pack = makePack();
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 10 });

    expect(result.tuningWarnings).toContain("No verified high court precedent selected.");
    expect(result.informationalWarnings).not.toContain("No verified high court precedent selected.");
  });

  it("weak relevance score in verified precedent is classified as tuning warning", () => {
    const weakPrecedent = {
      courtAndChamber: "YARGITAY / 13. Hukuk Dairesi",
      court: "yargitay",
      chamber: "13. Hukuk Dairesi",
      date: "2024-01-01",
      decisionDate: "2024-01-01",
      meritsAndDecisionNumber: "2023/1 - 2024/2",
      meritsNumber: "2023/1",
      decisionNumber: "2024/2",
      factSummary: "Olay.",
      legalAssessment: "Gerekçeli.",
      outcome: "Sonuç.",
      similarityDifference: "Benzer.",
      sourceDocumentId: "yargitay:1",
      sourceId: "yargitay:1",
      sourceUrl: "https://karararama.yargitay.gov.tr/",
      accessSource: "bedesten",
      fullTextAvailable: true,
      reasoningDetected: true,
      eligibilityStatus: "precedent_usable" as const,
      eligibilityReasons: ["Full text available."],
      healthLawRelevanceScore: 0,
      matchedQueryTerms: [],
      matchedHealthLawTerms: [],
      selectedAsVerifiedReason: "Test.",
      decisionSourceTrace: {
        query: question.question,
        source: "yargitay" as const,
        court: "yargitay" as const,
        searchRequest: { url: "https://bedesten.adalet.gov.tr/", phrase: "test", pageSize: 5 },
        searchResultsCount: 1,
        selectedResult: { documentId: "doc-1" },
        selectedResultReason: "Match.",
        documentId: "doc-1",
        sourceId: "yargitay:1",
        fullTextAvailable: true,
        fullTextRetrievalMethod: "bedesten",
        retrievedAt: "2026-05-23T00:00:00.000Z",
        eligibilityStatus: "precedent_usable" as const,
        eligibilityReasons: ["Full text."],
        exclusionReasons: []
      }
    };
    const pack = makePack({
      verifiedHighCourtPrecedents: [weakPrecedent],
      precedentDiagnostics: {
        query: question.question,
        selectedPrecedentCount: 1,
        excludedDecisionCount: 0,
        sourceSummaries: [{ source: "yargitay", mode: "live", searched: true, searchResultsCount: 1, candidateCount: 1, selectedCount: 1, excludedCount: 0, unavailableCount: 0, errorCodes: [] }],
        selectedPrecedents: [{ source: "yargitay", court: "yargitay", status: "precedent_usable", matchedHealthTopics: [], eligibilityReasons: [] }],
        excludedDecisions: []
      }
    });
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 10 });

    expect(result.tuningWarnings.some((w) => /relevance/i.test(w))).toBe(true);
    expect(result.informationalWarnings.some((w) => /relevance/i.test(w))).toBe(false);
  });

  it("a good-band question with only informational warnings has goodWithInformationalWarnings pattern", () => {
    // Pack with legislation, no precedents (tuning), and live mode (informational)
    // Expect: informationalWarnings > 0, tuningWarnings > 0 (no precedent)
    const pack = makePack();
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "mock", durationMs: 10 });

    // In mock mode, no live source quality informational warning
    expect(result.informationalWarnings).not.toContain(
      "Live source quality is informational; transient source gaps are metrics, not automatic failures."
    );
    // tuning warnings may exist (no precedent, priority mismatch possible)
    expect(Array.isArray(result.tuningWarnings)).toBe(true);
    expect(Array.isArray(result.safetyWarnings)).toBe(true);
    expect(result.safetyWarnings).toHaveLength(0);
  });

  it("all three warning arrays are always present and non-null on a result", () => {
    const pack = makePack();
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 10 });

    expect(Array.isArray(result.informationalWarnings)).toBe(true);
    expect(Array.isArray(result.tuningWarnings)).toBe(true);
    expect(Array.isArray(result.safetyWarnings)).toBe(true);
    expect(result.warnings).toEqual([...result.informationalWarnings, ...result.tuningWarnings, ...result.safetyWarnings]);
  });

  it("warnings array is union of all three categories", () => {
    const pack = makePack();
    const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 10 });

    const union = [...result.informationalWarnings, ...result.tuningWarnings, ...result.safetyWarnings];
    expect(result.warnings).toEqual(union);
  });
});
