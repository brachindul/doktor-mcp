import { describe, it, expect } from "vitest";
import { realWorldPhysicianLiveSmokeQuestions } from "../src/benchmark/realWorldPhysicianQuestions.js";
import { evaluateBetaReadiness } from "../src/physicianPackBetaGate.js";
import type { BenchmarkReport, BenchmarkItemResult } from "../src/benchmark/benchmarkRunner.js";

// Helper to create a mock item result
function createMockItem(id: string, overrides: Partial<BenchmarkItemResult> = {}): BenchmarkItemResult {
  return {
    id,
    category: "test category",
    question: "test question",
    sourceMode: "live",
    durationMs: 120,
    passed: true,
    regressionStatus: "passed",
    auditStatus: "clean",
    legislationOrder: ["Hasta Haklari Yonetmeligi"],
    topicClusters: ["informed_consent"],
    kvkkIncluded: false,
    hhyRole: "health_primary",
    selectedPrecedentCount: 1,
    excludedPrecedentCount: 0,
    usedMockSourceInLiveMode: false,
    audit: { ok: true, errors: [], warnings: [] },
    legislation: {
      selectedCount: 1,
      expectedPrimaryMatched: true,
      expectedPrimaryLegislation: ["Hasta Haklari Yonetmeligi"],
      firstLegislationName: "Hasta Haklari Yonetmeligi",
      firstArticleNo: "24",
      priorityMatch: true,
      quotePresent: true,
      sourceTracePresent: true,
      sourceUnavailable: []
    },
    precedents: {
      searchedSources: ["yargitay:live"],
      selectedUsableCount: 1,
      excludedCount: 0,
      exclusionReasonsBreakdown: {},
      sourceUnavailableBreakdown: [],
      verifiedHighCourtPrecedentsCount: 1,
      metadataOnlyUsedAsPrecedent: false,
      proceduralOnlyUsedAsPrecedent: false,
      noReasoningUsedAsPrecedent: false,
      verifiedPrecedentAudit: [
        {
          court: "Yargitay",
          chamber: "13. Hukuk Dairesi",
          decisionDate: "2026-05-22",
          esasNo: "2025/100",
          kararNo: "2026/200",
          accessSource: "yargitay",
          sourceId: "yargitay::123",
          documentId: "yargitay::123",
          sourceUrl: "https://yargitay.gov.tr/123",
          fullTextAvailable: true,
          reasoningDetected: true,
          eligibilityStatus: "precedent_usable",
          eligibilityReasons: [],
          healthLawRelevanceScore: 1.0,
          matchedQueryTerms: [],
          matchedHealthLawTerms: [],
          issueProfile: "informed_consent",
          missingExpectedIssueTerms: [],
          whyWeak: null,
          suggestedQueryTerms: [],
          decisionSourceTracePresent: true,
          sourceTraceFullTextUrl: "https://yargitay.gov.tr/123",
          selectedAsVerifiedReason: "usable",
          exclusionReason: null,
          contentStatus: "full_text",
          quoteUsable: true,
          adapterNativeContentStatus: true,
          errors: [],
          warnings: []
        }
      ]
    },
    safety: {
      forbiddenFieldsAbsent: true,
      noUrgentAction: true,
      noRiskLevel: true,
      noDefinitiveLegalOpinion: true,
      noPetitionDraft: true,
      noUnsafePrecedent: true,
      noMockFallbackInLive: true
    },
    scores: {
      legislationMatchScore: 2,
      priorityScore: 2,
      precedentSafetyScore: 2,
      sourceAvailabilityScore: 2,
      auditScore: 2,
      forbiddenFieldsScore: 2,
      totalScore: 12,
      maxScore: 12,
      scorePercent: 100,
      qualityBand: "good"
    },
    failureReasons: [],
    warnings: [],
    informationalWarnings: [],
    tuningWarnings: [],
    safetyWarnings: [],
    queryTelemetry: [],
    issueProfile: "informed_consent",
    fallbackUsed: false,
    fallbackAttemptCount: 0,
    firstSuccessfulQueryText: "consent",
    wastedQueryCount: 0,
    noResultQueryCount: 0,
    preRerankTopDecisionId: "yargitay::123",
    postRerankTopDecisionId: "yargitay::123",
    rerankChangedSelection: false,
    contractPassed: true,
    missingSections: [],
    missingLegislationFieldCount: 0,
    missingPrecedentFieldCount: 0,
    unofficialSourceDetected: false,
    unsafeAdviceDetected: false,
    routedIssueIds: ["informed_consent"],
    primaryIssueId: "informed_consent",
    routerConfidence: "high",
    routerMissingInfoHintCount: 0,
    sourceSufficiencyLevel: "sufficient",
    missingAuthorityTypes: [],
    sourceSufficiencyReasonCount: 0,
    canComposeResearchPack: true,
    notes: "",
    ...overrides
  };
}

// Helper to create a mock report
function createMockReport(results: BenchmarkItemResult[]): BenchmarkReport {
  return {
    timestamp: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 500,
    sourceMode: "live",
    totalQuestions: results.length,
    passedCount: results.filter(r => r.passed).length,
    failedCount: results.filter(r => !r.passed).length,
    passedRegressionCount: results.filter(r => r.regressionStatus === "passed").length,
    failedRegressionCount: results.filter(r => r.regressionStatus === "failed").length,
    liveSourceUnavailableCount: 0,
    auditOkCount: results.filter(r => r.audit.ok).length,
    auditWarningCount: 0,
    auditErrorCount: 0,
    questionsWithVerifiedPrecedents: results.filter(r => r.precedents.verifiedHighCourtPrecedentsCount > 0).length,
    questionsWithoutVerifiedPrecedents: results.filter(r => r.precedents.verifiedHighCourtPrecedentsCount === 0).length,
    questionsWithLegislation: results.filter(r => r.legislation.selectedCount > 0).length,
    questionsWithoutLegislation: results.filter(r => r.legislation.selectedCount === 0).length,
    mockFallbackDetected: false,
    goodCleanCount: results.length,
    goodWithWarningsCount: 0,
    goodWithInformationalWarningsCount: 0,
    goodWithTuningWarningsCount: 0,
    acceptableCount: 0,
    needsTuningCount: 0,
    unsafeCount: 0,
    informationalWarningCount: 0,
    tuningWarningCount: 0,
    safetyWarningCount: 0,
    questionsWithInformationalWarnings: 0,
    questionsWithTuningWarnings: 0,
    questionsWithSafetyWarnings: 0,
    weakRelevanceWarningCount: 0,
    questionsWithWeakRelevance: 0,
    averageHealthLawRelevanceScore: 1.0,
    medianHealthLawRelevanceScore: 1.0,
    weakRelevanceByQuestion: {},
    weakRelevanceBySource: {},
    weakRelevanceExamples: [],
    verifiedPrecedentAudit: {
      totalVerifiedPrecedents: results.length,
      auditErrorCount: 0,
      auditWarningCount: 0,
      missingMetadataCount: 0,
      weakRelevanceCount: 0,
      missingTraceCount: 0
    },
    sourceSufficiencyMetrics: {
      sourceSufficiencyDistribution: { sufficient: results.length, partial: 0, insufficient: 0 },
      insufficientSourceCount: 0,
      partialSourceCount: 0,
      sufficientSourceCount: results.length,
      missingAuthorityTypeDistribution: {},
      cannotComposeResearchPackCount: 0
    },
    routerMetrics: {
      routedIssueCoverage: { informed_consent: results.length },
      lowConfidenceRouteCount: 0,
      unclearOrMixedCount: 0,
      multiIssueQuestionCount: 0,
      primaryIssueDistribution: { informed_consent: results.length }
    },
    officialLegislationCoverage: {
      coveredOfficialLegislationCount: 11,
      coveredLegislationTitles: ["Hasta Haklari Yonetmeligi"],
      knownUncoveredLegislation: [],
      missingKnownHealthLegislationCount: 0,
      topicClustersRegistered: ["informed_consent"],
      topicClusterCount: 1,
      unofficialLegislationSourceCount: 0,
      coverageWarnings: [],
      inventoryTotalCount: 21,
      coreInventoryCount: 11,
      verifiedOfficialSourceCount: 11,
      candidateOfficialSourceCount: 6,
      gapCount: 4,
      deferredCount: 4,
      coveredByActiveHintsCount: 11,
      uncoveredCoreCount: 0,
      inventoryByCategory: {},
      inventoryByAccessStatus: { verified: 11, candidate: 6, gap: 4, deferred: 4 }
    },
    contractPassedCount: results.filter(r => r.contractPassed).length,
    contractFailedCount: results.filter(r => !r.contractPassed).length,
    contractMissingSectionTotal: 0,
    contractMissingLegislationFieldTotal: 0,
    contractMissingPrecedentFieldTotal: 0,
    contractUnofficialSourceCount: 0,
    contractUnsafeAdviceCount: 0,
    totalQueryAttempts: results.length,
    successfulQueryAttempts: results.length,
    failedQueryAttempts: 0,
    sourceUnavailableAttempts: 0,
    averageQueryDurationMs: 100,
    p50QueryDurationMs: 100,
    p95QueryDurationMs: 100,
    p99QueryDurationMs: 100,
    fallbackUsedCount: 0,
    rerankChangedSelectionCount: 0,
    sourceReliability: [],
    issueProfileReliability: [],
    liveTimeoutMetrics: {
      timeoutCount: 0,
      rateLimitCount: 0,
      transientFailureCount: 0,
      totalRetries: 0,
      totalBackoffMs: 0,
      timedOutSources: []
    },
    liveReliabilityGate: {
      gatePassed: true,
      gateFailures: [],
      gateObservations: [],
      scalerMetrics: {
        totalQuestions: results.length,
        mockFallbackCount: 0,
        contractFailedCount: 0,
        unofficialSourceCount: 0,
        ineligiblePrecedentCount: 0,
        timeoutCount: 0,
        rateLimitCount: 0,
        insufficientSufficiencyCount: 0
      }
    },
    provenanceMetrics: {
      totalDecisions: results.length,
      uniqueDecisions: results.length,
      duplicateDecisionCount: 0,
      mergedDecisionCount: 0,
      provenanceSourceDistribution: { yargitay: results.length },
      contentStatusDistribution: { full_text: results.length },
      fetchStatusDistribution: { full_text_fetched: results.length },
      quoteUsableCount: results.length,
      quoteUnusableCount: 0,
      metadataOnlyDecisionCount: 0,
      pdfLinkOnlyDecisionCount: 0,
      unavailableDecisionCount: 0,
      perSourceFetchStatusDistribution: {}
    },
    results
  };
}

describe("Live Real-World Beta Smoke & Hardening Tests", () => {
  it("should have a deterministic subset of 6 questions", () => {
    expect(realWorldPhysicianLiveSmokeQuestions.length).toBe(6);
    const ids = realWorldPhysicianLiveSmokeQuestions.map(q => q.id);
    expect(ids).toContain("real-consent-lack");
    expect(ids).toContain("real-emergency-no-consent");
    expect(ids).toContain("real-privacy-share");
    expect(ids).toContain("real-scope-violation");
    expect(ids).toContain("real-private-hospital-liability");
    expect(ids).toContain("real-disciplinary-investigation");
  });

  it("should treat timeout questions as soft observations and not hard contract failures", () => {
    const results = [
      createMockItem("q1", { contractPassed: true }),
      createMockItem("q2", {
        contractPassed: false, // timeout empty pack contract fail
        legislation: {
          selectedCount: 0,
          expectedPrimaryMatched: false,
          expectedPrimaryLegislation: [],
          firstLegislationName: null,
          firstArticleNo: null,
          priorityMatch: false,
          quotePresent: false,
          sourceTracePresent: false,
          sourceUnavailable: [{ source: "benchmark", errorCode: "pack_generation_failed", message: "timed out after 30000ms" }]
        }
      })
    ];

    const report = createMockReport(results);
    const betaReport = evaluateBetaReadiness(report);

    // Hard failures should be empty (no contract check failure because q2 has errorCode pack_generation_failed)
    expect(betaReport.failures.length).toBe(0);
    expect(betaReport.gatePassed).toBe(true);

    // Timeout should be captured in soft observations and metrics
    expect(betaReport.observations).toContain("1 question(s) encountered a retrieval timeout.");
    expect(betaReport.metrics.timeoutQuestionCount).toBe(1);
    expect(betaReport.metrics.timeoutQuestionIds).toContain("q2");
    expect(betaReport.metrics.contractFailedCount).toBe(0);
  });

  it("should still trigger hard failure when an actual generated pack fails contract checks", () => {
    const results = [
      createMockItem("q1", { contractPassed: true }),
      createMockItem("q2", {
        contractPassed: false, // contract failed but NO timeout error code
        legislation: {
          selectedCount: 1,
          expectedPrimaryMatched: true,
          expectedPrimaryLegislation: [],
          firstLegislationName: null,
          firstArticleNo: null,
          priorityMatch: false,
          quotePresent: false,
          sourceTracePresent: false,
          sourceUnavailable: []
        }
      })
    ];

    const report = createMockReport(results);
    const betaReport = evaluateBetaReadiness(report);

    expect(betaReport.gatePassed).toBe(false);
    expect(betaReport.failures).toContain("Contract check failed for 1 question(s). Mandatory fields or sections are missing.");
    expect(betaReport.metrics.contractFailedCount).toBe(1);
  });
});
