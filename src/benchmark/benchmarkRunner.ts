import { DoktorMcpInformationService } from "../app/service.js";
import type { TimeBudgetTelemetry, MinimalPackRescueContext } from "../app/service.js";
import { ResearchTimeBudget } from "../live/timeBudget.js";
import { composeDoctorLegalInformationPack } from "../health/answerComposer.js";
import { selectVerifiedPrecedents } from "../health/precedentFilter.js";
import type { DoctorLegalInformationPack, PrecedentStatus, ContentStatus } from "../contracts/legal.js";
import type { QueryAttemptTelemetry, SourceReliabilityMetrics, IssueProfileReliabilityMetrics } from "../contracts/queryTelemetry.js";
import type { LiveReliabilityGate } from "../live/reliabilityGate.js";
import { buildSessionSummary } from "../contracts/queryTelemetry.js";
import type { RerankResult } from "../health/precedentRerank.js";
import { inferIssueProfileFromQuestion } from "../health/precedentRelevance.js";
import { auditPack } from "../packAudit.js";
import type { HealthLegislationCategory, HealthLegislationAccessStatus } from "../healthLegislationInventory.js";
import { routeMedicalIssue } from "../medicalIssueRouter.js";
import type { MedicalIssueId, MedicalIssueRouterResult } from "../medicalIssueRouter.js";
import { evaluateSourceSufficiency } from "../sourceSufficiency.js";
import type { SourceSufficiencyLevel, MissingAuthorityType } from "../sourceSufficiency.js";
import { doctorQuestions, type BenchmarkQuestion } from "./doctorQuestions.js";
import { scoreBenchmarkItem, includesLegislationName, isPriorityMatch } from "./scoring.js";
import {
  collectTopicClusters,
  findHhyRole,
  collectLegislationUnavailable,
  collectPrecedentUnavailable,
  buildVerifiedPrecedentAudit,
  findForbiddenFields,
  detectMockFallback,
  buildSafety,
  buildCategorizedWarnings,
  buildRegressionFailures,
  countExclusionReasons
} from "./warningTaxonomy.js";
import { buildBenchmarkReport, generateMarkdownReport } from "./reportWriter.js";
import * as fs from "fs";
import * as path from "path";
export { scoreBenchmarkItem } from "./scoring.js";
export { generateMarkdownReport } from "./reportWriter.js";

export type QualityBand = "good" | "acceptable" | "needs_tuning" | "unsafe";
export type RegressionStatus = "passed" | "failed";
export type AuditStatus = "clean" | "warning" | "error";
export type PackFailureKind =
  | "none"
  | "generated_pack_contract_fail"
  | "pack_generation_failed_timeout"
  | "pack_generation_failed_source_unavailable"
  | "pack_generation_failed_budget_exhausted"
  | "pack_generation_failed_unknown"
  | "generated_pack_unsafe"
  | "generated_pack_unofficial_source"
  | "mock_fallback_in_live";
export interface BenchmarkScores {
  legislationMatchScore: number;
  priorityScore: number;
  precedentSafetyScore: number;
  sourceAvailabilityScore: number;
  auditScore: number;
  forbiddenFieldsScore: number;
  /** 1 if both law (Kanun) and regulation (Yönetmelik/Nizamname) present, 0 otherwise. */
  lawRegulationBalanceScore: number;
  /** 2 if >=3 classification dimensions populated, 1 if 1-2, 0 if none. */
  axisCoverageScore: number;
  /** Average verified precedent health-law relevance (2=high, 1=moderate, 0=low/none). */
  precedentRelevanceScore: number;
  totalScore: number;
  maxScore: number;
  scorePercent: number;
  qualityBand: QualityBand;
}
export interface BenchmarkItemResult {
  id: string;
  category: string;
  question: string;
  sourceMode: "live" | "mock";
  durationMs: number;
  passed: boolean;
  regressionStatus: RegressionStatus;
  auditStatus: AuditStatus;
  legislationOrder: string[];
  topicClusters: string[];
  kvkkIncluded: boolean;
  hhyRole: string | null;
  selectedPrecedentCount: number;
  excludedPrecedentCount: number;
  usedMockSourceInLiveMode: boolean;
  audit: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  legislation: {
    selectedCount: number;
    expectedPrimaryMatched: boolean;
    expectedPrimaryLegislation: string[];
    firstLegislationName: string | null;
    firstArticleNo: string | null;
    priorityMatch: boolean;
    quotePresent: boolean;
    sourceTracePresent: boolean;
    sourceUnavailable: SourceUnavailableMetric[];
  };
  precedents: {
    searchedSources: string[];
    selectedUsableCount: number;
    excludedCount: number;
    exclusionReasonsBreakdown: Record<string, number>;
    sourceUnavailableBreakdown: SourceUnavailableMetric[];
    verifiedHighCourtPrecedentsCount: number;
    metadataOnlyUsedAsPrecedent: boolean;
    proceduralOnlyUsedAsPrecedent: boolean;
    noReasoningUsedAsPrecedent: boolean;
    verifiedPrecedentAudit: VerifiedPrecedentAuditEntry[];
  };
  safety: {
    forbiddenFieldsAbsent: boolean;
    noUrgentAction: boolean;
    noRiskLevel: boolean;
    noDefinitiveLegalOpinion: boolean;
    noPetitionDraft: boolean;
    noUnsafePrecedent: boolean;
    noMockFallbackInLive: boolean;
  };
  scores: BenchmarkScores;
  failureReasons: string[];
  warnings: string[];
  informationalWarnings: string[];
  tuningWarnings: string[];
  safetyWarnings: string[];
  // Query telemetry (live mode only)
  queryTelemetry: QueryAttemptTelemetry[];
  issueProfile: string;
  fallbackUsed: boolean;
  fallbackAttemptCount: number;
  firstSuccessfulQueryText: string | null;
  wastedQueryCount: number;
  noResultQueryCount: number;
  // Rerank metrics
  preRerankTopDecisionId: string | null;
  postRerankTopDecisionId: string | null;
  rerankChangedSelection: boolean;
  // Contract check metrics (v0.21.0)
  contractPassed: boolean;
  missingSections: string[];
  missingLegislationFieldCount: number;
  missingPrecedentFieldCount: number;
  unofficialSourceDetected: boolean;
  unsafeAdviceDetected: boolean;
  // Medical issue router summary (v0.23.0)
  routedIssueIds: MedicalIssueId[];
  primaryIssueId: MedicalIssueId | null;
  routerConfidence: string | null;
  routerMissingInfoHintCount: number;
  // Source sufficiency gate (v0.24.0)
  sourceSufficiencyLevel: SourceSufficiencyLevel;
  missingAuthorityTypes: MissingAuthorityType[];
  sourceSufficiencyReasonCount: number;
  canComposeResearchPack: boolean;
  packGenerated: boolean;
  packFailureKind: PackFailureKind;
  packGenerationFailureReason: string | null;
  failedPhase: "legislation" | "precedent" | "pack_generation" | "unknown" | null;
  packGeneratedFromPartialState: boolean;
  minimalPackRescueReason: string | null;
  noPackDiagnostic?: {
    canComposeResearchPack: false;
    packGenerationFailureReason: string;
    failedPhase: "legislation" | "precedent" | "pack_generation" | "unknown";
    elapsedMs: number;
    sourceSufficiencyLevel: SourceSufficiencyLevel;
    missingAuthorityTypes: MissingAuthorityType[];
    coverageGaps: string[];
    recommendedNextDiagnostic: string;
    partialLegislationCount: number;
    partialVerifiedPrecedentCount: number;
    lastCompletedPhase: string;
    retrievalTimeoutSources: string[];
    canRetryWithLongerBudget: boolean;
    canRetryWithNarrowerIssue: boolean;
    partialStateAvailable: boolean;
  };
  partialPackGenerated: boolean;
  notes: string;
  // Time budget telemetry (live mode only, v0.39.0)
  timeBudgetTelemetry?: TimeBudgetTelemetry;
}
export interface SourceUnavailableMetric {
  source: string;
  errorCode: string;
  message: string;
  retryable?: boolean;
}
export interface VerifiedPrecedentAuditEntry {
  court: string | null;
  chamber: string | null;
  decisionDate: string | null;
  esasNo: string | null;
  kararNo: string | null;
  accessSource: string | null;
  sourceId: string | null;
  documentId: string | null;
  sourceUrl: string | null;
  fullTextAvailable: boolean;
  reasoningDetected: boolean;
  eligibilityStatus: string | null;
  eligibilityReasons: string[];
  healthLawRelevanceScore: number | null;
  matchedQueryTerms: string[];
  matchedHealthLawTerms: string[];
  issueProfile: string | null;
  missingExpectedIssueTerms: string[];
  whyWeak: string | null;
  suggestedQueryTerms: string[];
  decisionSourceTracePresent: boolean;
  sourceTraceFullTextUrl: string | null;
  selectedAsVerifiedReason: string | null;
  exclusionReason: string | null;
  contentStatus: ContentStatus | null;
  quoteUsable: boolean;
  /** True if contentStatus was set natively by a live adapter (v0.27.0). */
  adapterNativeContentStatus: boolean;
  errors: string[];
  warnings: string[];
}
export interface BenchmarkReport {
  timestamp: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sourceMode: "live" | "mock";
  totalQuestions: number;
  passedCount: number;
  failedCount: number;
  passedRegressionCount: number;
  failedRegressionCount: number;
  liveSourceUnavailableCount: number;
  auditOkCount: number;
  auditWarningCount: number;
  auditErrorCount: number;
  questionsWithVerifiedPrecedents: number;
  questionsWithoutVerifiedPrecedents: number;
  questionsWithLegislation: number;
  questionsWithoutLegislation: number;
  mockFallbackDetected: boolean;
  goodCleanCount: number;
  goodWithWarningsCount: number;
  goodWithInformationalWarningsCount: number;
  goodWithTuningWarningsCount: number;
  acceptableCount: number;
  needsTuningCount: number;
  unsafeCount: number;
  informationalWarningCount: number;
  tuningWarningCount: number;
  safetyWarningCount: number;
  questionsWithInformationalWarnings: number;
  questionsWithTuningWarnings: number;
  questionsWithSafetyWarnings: number;
  weakRelevanceWarningCount: number;
  questionsWithWeakRelevance: number;
  averageHealthLawRelevanceScore: number | null;
  medianHealthLawRelevanceScore: number | null;
  weakRelevanceByQuestion: Record<string, number>;
  weakRelevanceBySource: Record<string, number>;
  weakRelevanceExamples: Array<{
    questionId: string;
    decisionId: string | null;
    court: string | null;
    chamber: string | null;
    matchedTerms: string[];
    missingExpectedIssueTerms: string[];
    whyWeak: string | null;
    suggestedQueryTerms: string[];
  }>;
  verifiedPrecedentAudit: {
    totalVerifiedPrecedents: number;
    auditErrorCount: number;
    auditWarningCount: number;
    missingMetadataCount: number;
    weakRelevanceCount: number;
    missingTraceCount: number;
  };
  // Source sufficiency aggregate metrics (v0.24.0)
  sourceSufficiencyMetrics: {
    sourceSufficiencyDistribution: Record<SourceSufficiencyLevel, number>;
    insufficientSourceCount: number;
    partialSourceCount: number;
    sufficientSourceCount: number;
    missingAuthorityTypeDistribution: Record<string, number>;
    cannotComposeResearchPackCount: number;
  };
  // Medical issue router aggregate metrics (v0.23.0)
  routerMetrics: {
    routedIssueCoverage: Record<string, number>;
    lowConfidenceRouteCount: number;
    unclearOrMixedCount: number;
    multiIssueQuestionCount: number;
    primaryIssueDistribution: Record<string, number>;
  };
  // Official legislation coverage summary (v0.22.0, extended v0.28.0)
  officialLegislationCoverage: {
    // ── v0.22.0 fields (preserved, backward-compatible) ──
    coveredOfficialLegislationCount: number;
    coveredLegislationTitles: string[];
    knownUncoveredLegislation: string[];
    missingKnownHealthLegislationCount: number;
    topicClustersRegistered: string[];
    topicClusterCount: number;
    unofficialLegislationSourceCount: number;
    coverageWarnings: string[];
    // ── v0.28.0 inventory fields ──
    inventoryTotalCount: number;
    coreInventoryCount: number;
    verifiedOfficialSourceCount: number;
    candidateOfficialSourceCount: number;
    gapCount: number;
    deferredCount: number;
    coveredByActiveHintsCount: number;
    uncoveredCoreCount: number;
    inventoryByCategory: Partial<Record<HealthLegislationCategory, number>>;
    inventoryByAccessStatus: Record<HealthLegislationAccessStatus, number>;
  };
  // Contract check aggregate (v0.21.0)
  contractPassedCount: number;
  contractFailedCount: number;
  contractMissingSectionTotal: number;
  contractMissingLegislationFieldTotal: number;
  contractMissingPrecedentFieldTotal: number;
  contractUnofficialSourceCount: number;
  contractUnsafeAdviceCount: number;
  // Query telemetry aggregate (live mode only)
  totalQueryAttempts: number;
  successfulQueryAttempts: number;
  failedQueryAttempts: number;
  sourceUnavailableAttempts: number;
  averageQueryDurationMs: number | null;
  p50QueryDurationMs: number | null;
  p95QueryDurationMs: number | null;
  p99QueryDurationMs: number | null;
  fallbackUsedCount: number;
  rerankChangedSelectionCount: number;
  sourceReliability: SourceReliabilityMetrics[];
  issueProfileReliability: IssueProfileReliabilityMetrics[];
  // Live request timeout / retry aggregate (v0.25.0)
  liveTimeoutMetrics: {
    timeoutCount: number;
    rateLimitCount: number;
    transientFailureCount: number;
    totalRetries: number;
    totalBackoffMs: number;
    timedOutSources: string[];
  };
  // Live reliability gate (v0.26.0)
  liveReliabilityGate: LiveReliabilityGate;
  // Time budget aggregate metrics (v0.39.0)
  timeBudgetMetrics: {
    questionsWithBudget: number;
    averageLegislationPhaseMs: number | null;
    averagePrecedentPhaseMs: number | null;
    averageTotalElapsedMs: number | null;
    budgetExhaustedCount: number;
    sourcePriorityDistribution: Record<string, number>;
    // v0.40.0 legislation phase diagnostics
    legislationPhaseTimeoutCount: number;
    legislationPhaseBudgetExhaustedCount: number;
    knownHintFastPathCount: number;
    coverageGapCount: number;
    legislationPhaseFailedBeforePrecedentCount: number;
    packGeneratedAfterLegislationTimeoutCount: number;
  };
  // Cross-source provenance metrics (v0.27.0)
  provenanceMetrics: {
    totalDecisions: number;
    uniqueDecisions: number;
    duplicateDecisionCount: number;
    mergedDecisionCount: number;
    provenanceSourceDistribution: Record<string, number>;
    contentStatusDistribution: Record<string, number>;
    fetchStatusDistribution: Record<string, number>;
    quoteUsableCount: number;
    quoteUnusableCount: number;
    metadataOnlyDecisionCount: number;
    pdfLinkOnlyDecisionCount: number;
    unavailableDecisionCount: number;
    perSourceFetchStatusDistribution: Record<string, Record<string, number>>;
  };
  packGenerationFailureDistribution: Record<PackFailureKind, number>;
  timeoutNoPackCount: number;
  sourceUnavailableNoPackCount: number;
  budgetExhaustedNoPackCount: number;
  generatedPackContractFailCount: number;
  generatedPackUnsafeCount: number;
  generatedPackUnofficialCount: number;
  liveReliabilityGateTimeoutObservationCount: number;
  noPackDiagnosticCount: number;
  noPackDiagnosticEnhancedCount: number;
  partialPackGeneratedCount: number;
  partialStateAvailableCount: number;
  generatedFromPartialStateCount: number;
  minimalPackRescueAttemptCount: number;
  minimalPackRescueSuccessCount: number;
  minimalPackRescueFailureCount: number;
  results: BenchmarkItemResult[];
}
export async function runBenchmark(options: {
  sourceMode: "live" | "mock";
  limit?: number;
  outDir: string;
  service?: DoktorMcpInformationService;
  questions?: BenchmarkQuestion[];
}): Promise<BenchmarkReport> {
  const { sourceMode, limit, outDir, questions } = options;
  const service = options.service ?? new DoktorMcpInformationService();
  const dataset = questions ?? doctorQuestions;
  const questionsToRun = typeof limit === "number" ? dataset.slice(0, limit) : dataset;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const results: BenchmarkItemResult[] = [];
  const PER_QUESTION_TIMEOUT_MS = sourceMode === "live" ? 30_000 : 15_000;
  for (const question of questionsToRun) {
    const itemStartedAt = Date.now();
    let enrichedPack: Awaited<ReturnType<DoktorMcpInformationService["prepareInformationPack"]>>;
    try {
      const timeBudget = sourceMode === "live" ? new ResearchTimeBudget() : undefined;
      enrichedPack = await Promise.race([
        service.prepareInformationPack({ question: question.question, sourceMode, timeBudget }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Question timed out after ${PER_QUESTION_TIMEOUT_MS}ms`)), PER_QUESTION_TIMEOUT_MS)
        )
      ]);
      results.push(evaluateBenchmarkItem({
        question,
        pack: enrichedPack as unknown as DoctorLegalInformationPack & Record<string, unknown>,
        sourceMode,
        durationMs: Date.now() - itemStartedAt,
        queryTelemetry: enrichedPack.queryTelemetry,
        rerankResult: enrichedPack.rerankResult,
        timeBudgetTelemetry: enrichedPack.timeBudgetTelemetry
      }));
    } catch (error) {
      // v0.42.0: Try minimal pack rescue from partial state
      let partialState: MinimalPackRescueContext | null = null;
      try {
        partialState = service.getLastPartialState();
      } catch {
        // ignore - partial state not available
      }
      if (partialState && (partialState.provisionsAvailable > 0 || partialState.precedentsAvailable > 0)) {
        // Attempt minimal pack rescue
        try {
          const rescuedPack = buildMinimalRescuePack(partialState, question);
          const rescueResult = evaluateBenchmarkItem({
            question,
            pack: rescuedPack as unknown as DoctorLegalInformationPack & Record<string, unknown>,
            sourceMode,
            durationMs: Date.now() - itemStartedAt,
            queryTelemetry: partialState.queryTelemetry,
            rerankResult: partialState.rerankResult,
            timeBudgetTelemetry: partialState.timeBudgetTelemetry ?? undefined
          });
          // Mark as rescued from timeout
          rescueResult.packGenerated = true;
          rescueResult.packGeneratedFromPartialState = true;
          rescueResult.packFailureKind = rescueResult.contractPassed ? "none" : "generated_pack_contract_fail";
          rescueResult.minimalPackRescueReason = deriveRescueReason(partialState);
          rescueResult.partialPackGenerated = true;
          rescueResult.noPackDiagnostic = undefined;
          rescueResult.packGenerationFailureReason = null;
          rescueResult.failedPhase = null;
          results.push(rescueResult);
        } catch {
          // Rescue pack failed to build — enhanced no-pack diagnostic
          results.push(evaluateThrownBenchmarkItem({
            question,
            sourceMode,
            durationMs: Date.now() - itemStartedAt,
            error,
            partialState
          }));
        }
      } else {
        results.push(evaluateThrownBenchmarkItem({
          question,
          sourceMode,
          durationMs: Date.now() - itemStartedAt,
          error,
          partialState
        }));
      }
    }
  }
  const completedAtMs = Date.now();
  const report = buildBenchmarkReport({
    startedAt,
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: completedAtMs - startedAtMs,
    sourceMode,
    results
  });
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = sourceMode === "live" ? "live-benchmark-report" : "doctor-benchmark-report";
  fs.writeFileSync(path.join(outDir, `${baseName}.json`), JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, `${baseName}.md`), generateMarkdownReport(report), "utf8");
  return report;
}
export function evaluateBenchmarkItem(input: {
  question: BenchmarkQuestion;
  pack: DoctorLegalInformationPack & Record<string, unknown>;
  sourceMode: "live" | "mock";
  durationMs: number;
  queryTelemetry?: QueryAttemptTelemetry[];
  rerankResult?: RerankResult;
  timeBudgetTelemetry?: TimeBudgetTelemetry;
}): BenchmarkItemResult {
  const { question, pack, sourceMode, durationMs } = input;
  const queryTelemetry = input.queryTelemetry ?? [];
  const rerankResult = input.rerankResult ?? { preRerankTopId: null, postRerankTopId: null, rerankChangedSelection: false, usableCount: 0 };
  const issueProfile = inferIssueProfileFromQuestion(question.question);
  const auditRes = auditPack(pack);
  const legislationItems = Array.isArray(pack.relevantLegislation) ? pack.relevantLegislation : [];
  const legislationOrder = legislationItems.map((item) => item.legislationName);
  const firstLegislation = legislationItems[0] ?? null;
  const kvkkIncluded = legislationOrder.some((name) => includesLegislationName(name, "Kisisel Verilerin Korunmasi Kanunu") || /KVKK/i.test(name));
  const topicClusters = collectTopicClusters(pack);
  const hhyRole = findHhyRole(pack, legislationOrder, question);
  const sourceUnavailable = collectLegislationUnavailable(pack);
  const precedentUnavailable = collectPrecedentUnavailable(pack);
  const selectedStatuses = pack.precedentDiagnostics?.selectedPrecedents?.map((entry) => entry.status) ?? [];
  const selectedPrecedentCount = pack.verifiedHighCourtPrecedents?.length ?? 0;
  const excludedPrecedentCount = pack.precedentDiagnostics?.excludedDecisions?.length ?? 0;
  const verifiedPrecedentAudit = buildVerifiedPrecedentAudit(pack, sourceMode);
  const verifiedAuditErrors = verifiedPrecedentAudit.flatMap((entry, index) =>
    entry.errors.map((error) => `Verified precedent ${index + 1}: ${error}`)
  );
  const verifiedAuditWarnings = verifiedPrecedentAudit.flatMap((entry, index) =>
    entry.warnings.map((warning) => `Verified precedent ${index + 1}: ${warning}`)
  );
  const forbiddenFieldMatches = findForbiddenFields(pack);
  const usedMockSourceInLiveMode = detectMockFallback(pack, sourceMode, verifiedPrecedentAudit);
  const safety = buildSafety(pack, sourceMode, selectedStatuses, forbiddenFieldMatches, verifiedPrecedentAudit, usedMockSourceInLiveMode);
  // Compute query session summary for this item (all sources combined)
  const sourcesQueried = [...new Set(queryTelemetry.map((t) => t.source))];
  const sessionSummaries = sourcesQueried.map((src) =>
    buildSessionSummary(src, issueProfile, queryTelemetry.filter((t) => t.source === src))
  );
  const fallbackUsed = sessionSummaries.some((s) => s.fallbackUsed);
  const fallbackAttemptCount = sessionSummaries.reduce((sum, s) => sum + s.fallbackAttemptCount, 0);
  const firstSuccessfulQueryText = sessionSummaries.find((s) => s.firstSuccessfulQueryText)?.firstSuccessfulQueryText ?? null;
  const wastedQueryCount = sessionSummaries.reduce((sum, s) => sum + s.wastedQueryCount, 0);
  const noResultQueryCount = sessionSummaries.reduce((sum, s) => sum + s.noResultQueryCount, 0);

  const categorized = buildCategorizedWarnings({
    sourceMode,
    question,
    legislationOrder,
    sourceUnavailable,
    precedentUnavailable,
    selectedPrecedentCount,
    packAuditWarnings: auditRes.warnings,
    verifiedAuditWarnings,
    fallbackUsed,
    hasVerifiedPrecedents: selectedPrecedentCount > 0
  });
  const warnings = [...categorized.informational, ...categorized.tuning, ...categorized.safety];
  const regressionFailures = buildRegressionFailures({
    sourceMode,
    question,
    pack,
    legislationOrder,
    kvkkIncluded,
    auditErrors: [...auditRes.errors, ...verifiedAuditErrors],
    forbiddenFieldMatches,
    safety
  });
  const scores = scoreBenchmarkItem({
    question,
    pack,
    legislationOrder,
    auditErrors: [...auditRes.errors, ...verifiedAuditErrors],
    auditWarnings: [...auditRes.warnings, ...verifiedAuditWarnings],
    sourceUnavailableCount: sourceUnavailable.length + precedentUnavailable.length,
    safety,
    verifiedPrecedentAudit
  });
  const auditStatus: AuditStatus = auditRes.errors.length + verifiedAuditErrors.length > 0 ? "error" :
    auditRes.warnings.length + verifiedAuditWarnings.length > 0 ? "warning" : "clean";

  const routerResult: MedicalIssueRouterResult = routeMedicalIssue(question.question);

  const sufficiencyResult = evaluateSourceSufficiency({
    routedIssueIds: routerResult.routes.map((r) => r.issueId),
    primaryIssueId: routerResult.primaryIssueId,
    relevantLegislation: (Array.isArray(pack.relevantLegislation) ? pack.relevantLegislation : []) as Array<Record<string, unknown>>,
    verifiedPrecedents: (Array.isArray(pack.verifiedHighCourtPrecedents) ? pack.verifiedHighCourtPrecedents : []) as unknown as Array<Record<string, unknown>>,
    contractPassed: auditRes.contractCheck.passed,
    unofficialSourceDetected: auditRes.contractCheck.unofficialSourceDetected,
    usedMockSourceInLiveMode,
    sourceMode,
    auditOk: auditRes.ok,
    // v0.40.0 legislation phase diagnostics from timeBudgetTelemetry
    legislationPhaseBudgetExhausted: input.timeBudgetTelemetry?.legislationPhaseBudgetExhausted,
    legislationPhaseTimedOut: input.timeBudgetTelemetry?.legislationPhaseTimedOut,
    legislationCoverageGaps: input.timeBudgetTelemetry?.legislationCoverageGaps
  });

  return {
    id: question.id,
    category: question.category,
    question: question.question,
    sourceMode,
    durationMs,
    passed: regressionFailures.length === 0,
    regressionStatus: regressionFailures.length === 0 ? "passed" : "failed",
    auditStatus,
    legislationOrder,
    topicClusters,
    kvkkIncluded,
    hhyRole,
    selectedPrecedentCount,
    excludedPrecedentCount,
    usedMockSourceInLiveMode,
    audit: {
      ok: auditRes.ok && verifiedAuditErrors.length === 0,
      errors: [...auditRes.errors, ...verifiedAuditErrors],
      warnings: [...auditRes.warnings, ...verifiedAuditWarnings]
    },
    legislation: {
      selectedCount: legislationItems.length,
      expectedPrimaryMatched: question.expectedPrimaryLegislationNames.some((name) =>
        legislationOrder.some((selected) => includesLegislationName(selected, name))
      ),
      expectedPrimaryLegislation: question.expectedPrimaryLegislationNames,
      firstLegislationName: firstLegislation?.legislationName ?? null,
      firstArticleNo: firstLegislation?.articleNumber ?? null,
      priorityMatch: isPriorityMatch(question, legislationOrder),
      quotePresent: legislationItems.some((item) => Boolean(item.verbatimQuote?.trim())),
      sourceTracePresent: legislationItems.some((item) => Boolean(item.sourceTrace)),
      sourceUnavailable
    },
    precedents: {
      searchedSources: pack.precedentDiagnostics?.sourceSummaries?.map((summary) => `${summary.source}:${summary.mode}`) ?? [],
      selectedUsableCount: pack.precedentDiagnostics?.selectedPrecedentCount ?? selectedPrecedentCount,
      excludedCount: excludedPrecedentCount,
      exclusionReasonsBreakdown: countExclusionReasons(pack),
      sourceUnavailableBreakdown: precedentUnavailable,
      verifiedHighCourtPrecedentsCount: selectedPrecedentCount,
      metadataOnlyUsedAsPrecedent: selectedStatuses.includes("metadata_only" as PrecedentStatus),
      proceduralOnlyUsedAsPrecedent: selectedStatuses.includes("procedural_only" as PrecedentStatus),
      noReasoningUsedAsPrecedent: selectedStatuses.includes("no_reasoning" as PrecedentStatus),
      verifiedPrecedentAudit
    },
    safety,
    scores,
    failureReasons: regressionFailures,
    warnings,
    informationalWarnings: categorized.informational,
    tuningWarnings: categorized.tuning,
    safetyWarnings: categorized.safety,
    queryTelemetry,
    issueProfile,
    fallbackUsed,
    fallbackAttemptCount,
    firstSuccessfulQueryText,
    wastedQueryCount,
    noResultQueryCount,
    preRerankTopDecisionId: rerankResult.preRerankTopId,
    postRerankTopDecisionId: rerankResult.postRerankTopId,
    rerankChangedSelection: rerankResult.rerankChangedSelection,
    contractPassed: auditRes.contractCheck.passed,
    missingSections: auditRes.contractCheck.missingSections,
    missingLegislationFieldCount: auditRes.contractCheck.missingLegislationFields.reduce((sum, e) => sum + e.fields.length, 0),
    missingPrecedentFieldCount: auditRes.contractCheck.missingPrecedentFields.reduce((sum, e) => sum + e.fields.length, 0),
    unofficialSourceDetected: auditRes.contractCheck.unofficialSourceDetected,
    unsafeAdviceDetected: auditRes.contractCheck.unsafeAdviceDetected,
    routedIssueIds: routerResult.routes.map((r) => r.issueId),
    primaryIssueId: routerResult.primaryIssueId,
    routerConfidence: routerResult.routes[0]?.confidence ?? null,
    routerMissingInfoHintCount: routerResult.missingInfoHints.length,
    sourceSufficiencyLevel: sufficiencyResult.level,
    missingAuthorityTypes: sufficiencyResult.missingAuthorityTypes,
    sourceSufficiencyReasonCount: sufficiencyResult.reasons.length,
    canComposeResearchPack: sufficiencyResult.canComposeResearchPack,
    packGenerated: true,
    packFailureKind: !auditRes.contractCheck.passed
      ? "generated_pack_contract_fail"
      : auditRes.contractCheck.unsafeAdviceDetected
        ? "generated_pack_unsafe"
        : auditRes.contractCheck.unofficialSourceDetected
          ? "generated_pack_unofficial_source"
          : usedMockSourceInLiveMode
            ? "mock_fallback_in_live"
            : "none",
    packGenerationFailureReason: null,
    failedPhase: null,
    packGeneratedFromPartialState: false,
    minimalPackRescueReason: null,
    partialPackGenerated: sufficiencyResult.level !== "sufficient",
    notes: question.notes,
    timeBudgetTelemetry: input.timeBudgetTelemetry
  };
}

function evaluateThrownBenchmarkItem(input: {
  question: BenchmarkQuestion;
  sourceMode: "live" | "mock";
  durationMs: number;
  error: unknown;
  partialState?: MinimalPackRescueContext | null;
}): BenchmarkItemResult {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const packFailureKind = classifyPackGenerationFailure(message);
  const failedPhase = packFailureKind === "pack_generation_failed_budget_exhausted" ? "pack_generation" : "unknown";
  const ps = input.partialState;
  const hasPartialState = Boolean(ps && (ps.provisionsAvailable > 0 || ps.precedentsAvailable > 0));
  const emptyPack = {
    relevantLegislation: [],
    verifiedHighCourtPrecedents: [],
    missingInformation: [],
    lawyerReviewPoints: [],
    sourceWarnings: [],
    legalClassification: {
      criminal: [],
      civilCompensation: [],
      disciplinaryAdministrative: [],
      patientRights: [],
      privacyKvkk: [],
      professionalEthics: []
    },
    shortAnswer: ""
  } as DoctorLegalInformationPack;
  const safety = {
    forbiddenFieldsAbsent: true,
    noUrgentAction: true,
    noRiskLevel: true,
    noDefinitiveLegalOpinion: true,
    noPetitionDraft: true,
    noUnsafePrecedent: true,
    noMockFallbackInLive: true
  };
  const scores = scoreBenchmarkItem({
    question: input.question,
    pack: emptyPack,
    legislationOrder: [],
    auditErrors: [`Pack generation threw error: ${message}`],
    auditWarnings: [],
    sourceUnavailableCount: 1,
    safety
  });
  return {
    id: input.question.id,
    category: input.question.category,
    question: input.question.question,
    sourceMode: input.sourceMode,
    durationMs: input.durationMs,
    passed: false,
    regressionStatus: "failed",
    auditStatus: "error",
    legislationOrder: [],
    topicClusters: [],
    kvkkIncluded: false,
    hhyRole: null,
    selectedPrecedentCount: 0,
    excludedPrecedentCount: 0,
    usedMockSourceInLiveMode: false,
    audit: { ok: false, errors: [`Pack generation threw error: ${message}`], warnings: [] },
    legislation: {
      selectedCount: 0,
      expectedPrimaryMatched: false,
      expectedPrimaryLegislation: input.question.expectedPrimaryLegislationNames,
      firstLegislationName: null,
      firstArticleNo: null,
      priorityMatch: false,
      quotePresent: false,
      sourceTracePresent: false,
      sourceUnavailable: [{ source: "benchmark", errorCode: "pack_generation_failed", message }]
    },
    precedents: {
      searchedSources: [],
      selectedUsableCount: 0,
      excludedCount: 0,
      exclusionReasonsBreakdown: {},
      sourceUnavailableBreakdown: [],
      verifiedHighCourtPrecedentsCount: 0,
      metadataOnlyUsedAsPrecedent: false,
      proceduralOnlyUsedAsPrecedent: false,
      noReasoningUsedAsPrecedent: false,
      verifiedPrecedentAudit: []
    },
    safety,
    scores,
    failureReasons: [`Pack generation failed: ${message}`],
    warnings: [],
    informationalWarnings: [],
    tuningWarnings: [],
    safetyWarnings: [],
    queryTelemetry: [],
    issueProfile: inferIssueProfileFromQuestion(input.question.question),
    fallbackUsed: false,
    fallbackAttemptCount: 0,
    firstSuccessfulQueryText: null,
    wastedQueryCount: 0,
    noResultQueryCount: 0,
    preRerankTopDecisionId: null,
    postRerankTopDecisionId: null,
    rerankChangedSelection: false,
    contractPassed: false,
    missingSections: ["shortAnswer", "legalClassification", "missingInformation", "lawyerReviewPoints"],
    missingLegislationFieldCount: 0,
    missingPrecedentFieldCount: 0,
    unofficialSourceDetected: false,
    unsafeAdviceDetected: false,
    routedIssueIds: [],
    primaryIssueId: null,
    routerConfidence: null,
    routerMissingInfoHintCount: 0,
    sourceSufficiencyLevel: "insufficient",
    missingAuthorityTypes: ["legislation", "highCourtPrecedent", "officialSourceTrace"],
    sourceSufficiencyReasonCount: 1,
    canComposeResearchPack: false,
    packGenerated: false,
    packFailureKind,
    packGenerationFailureReason: message,
    failedPhase,
    packGeneratedFromPartialState: false,
    minimalPackRescueReason: null,
    noPackDiagnostic: {
      canComposeResearchPack: false,
      packGenerationFailureReason: message,
      failedPhase,
      elapsedMs: input.durationMs,
      sourceSufficiencyLevel: "insufficient",
      missingAuthorityTypes: ["legislation", "highCourtPrecedent", "officialSourceTrace"],
      coverageGaps: ps?.legislationPhaseDiagnostics?.coverageGaps ?? [],
      recommendedNextDiagnostic: diagnosticForPackFailure(packFailureKind),
      partialLegislationCount: ps?.provisionsAvailable ?? 0,
      partialVerifiedPrecedentCount: ps?.precedentsAvailable ?? 0,
      lastCompletedPhase: ps?.lastCompletedPhase ?? "none",
      retrievalTimeoutSources: ps?.legislationPhaseDiagnostics?.retrievalTimeout ? ["mevzuat.gov.tr"] : [],
      canRetryWithLongerBudget: true,
      canRetryWithNarrowerIssue: hasPartialState,
      partialStateAvailable: hasPartialState
    },
    partialPackGenerated: false,
    notes: input.question.notes
  };
}
function classifyPackGenerationFailure(message: string): PackFailureKind {
  const lower = message.toLowerCase();
  if (lower.includes("timed out") || lower.includes("timeout")) return "pack_generation_failed_timeout";
  if (lower.includes("budget") || lower.includes("exhausted")) return "pack_generation_failed_budget_exhausted";
  if (lower.includes("source unavailable") || lower.includes("unavailable")) return "pack_generation_failed_source_unavailable";
  return "pack_generation_failed_unknown";
}
function diagnosticForPackFailure(kind: PackFailureKind): string {
  switch (kind) {
    case "pack_generation_failed_timeout":
      return "Pack generation timed out before a safe research pack could be composed; inspect phase telemetry and source availability.";
    case "pack_generation_failed_budget_exhausted":
      return "Time budget was exhausted before pack generation; inspect legislation/precedent phase allocation.";
    case "pack_generation_failed_source_unavailable":
      return "A required live source was unavailable before pack generation; retry live sources or inspect source adapters.";
    default:
      return "Pack generation failed before a safe research pack could be composed; inspect thrown error and source diagnostics.";
  }
}
function deriveRescueReason(ps: MinimalPackRescueContext): string {
  if (ps.provisionsAvailable > 0 && ps.precedentsAvailable > 0) return "timeout_with_both";
  if (ps.provisionsAvailable > 0) return "timeout_with_legislation";
  if (ps.precedentsAvailable > 0) return "timeout_with_precedent";
  return "timeout_no_partial_state";
}

function buildMinimalRescuePack(ps: MinimalPackRescueContext, _question: BenchmarkQuestion): DoctorLegalInformationPack {
  const { provisions, classification, legislationPhaseDiagnostics } = ps;

  // Convert reranked to FilteredPrecedent format for selectVerifiedPrecedents
  const filteredPrecedents = ps.reranked.map((r) => ({
    decision: r.decision,
    status: r.status as PrecedentStatus,
    reason: ""
  }));
  const verifiedPrecedents = selectVerifiedPrecedents(filteredPrecedents);
  const provisionsArray = Array.isArray(provisions) ? provisions : [];
  const precedentsArray = Array.isArray(verifiedPrecedents) ? verifiedPrecedents : [];

  const pack = composeDoctorLegalInformationPack(
    classification,
    provisionsArray,
    precedentsArray,
    [],
    undefined
  );

  // Add coverage gap warnings
  if (legislationPhaseDiagnostics?.coverageGaps?.length) {
    for (const gap of legislationPhaseDiagnostics.coverageGaps) {
      pack.sourceWarnings.push(`Coverage gap detected: ${gap}`);
    }
  }

  // Add rescue warning
  if (provisionsArray.length > 0 || precedentsArray.length > 0) {
    pack.sourceWarnings.push("Partial pack generated from intermediate state after timeout; verify all content against live sources.");
  }

  return pack;
}