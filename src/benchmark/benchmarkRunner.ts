import { PhysicianLegalInformationService } from "../app/service.js";
import type { DoctorLegalInformationPack, PrecedentStatus, ContentStatus } from "../contracts/legal.js";
import type { QueryAttemptTelemetry, SourceReliabilityMetrics, IssueProfileReliabilityMetrics } from "../contracts/queryTelemetry.js";
import { buildLiveReliabilityGate } from "../live/reliabilityGate.js";
import type { LiveReliabilityGate } from "../live/reliabilityGate.js";
import { buildSessionSummary } from "../contracts/queryTelemetry.js";
import type { RerankResult } from "../health/precedentRerank.js";
import { inferIssueProfileFromQuestion } from "../health/precedentRelevance.js";
import { auditPack } from "../packAudit.js";
import { healthLegislationHints } from "../sources/legislation/healthMappings.js";
import { routeMedicalIssue } from "../medicalIssueRouter.js";
import type { MedicalIssueId, MedicalIssueRouterResult } from "../medicalIssueRouter.js";
import { evaluateSourceSufficiency } from "../sourceSufficiency.js";
import type { SourceSufficiencyLevel, MissingAuthorityType } from "../sourceSufficiency.js";
import { doctorQuestions, FORBIDDEN_FIELDS_LIST, type BenchmarkQuestion } from "./doctorQuestions.js";
import {
  buildSourceReliabilityMetrics,
  buildIssueProfileReliabilityMetrics,
  buildGlobalQueryMetrics
} from "./reliabilityMetrics.js";
import * as fs from "fs";
import * as path from "path";

export type QualityBand = "good" | "acceptable" | "needs_tuning" | "unsafe";
export type RegressionStatus = "passed" | "failed";
export type AuditStatus = "clean" | "warning" | "error";

export interface BenchmarkScores {
  legislationMatchScore: number;
  priorityScore: number;
  precedentSafetyScore: number;
  sourceAvailabilityScore: number;
  auditScore: number;
  forbiddenFieldsScore: number;
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
  notes: string;
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
  // Official legislation coverage summary (v0.22.0)
  officialLegislationCoverage: {
    coveredOfficialLegislationCount: number;
    coveredLegislationTitles: string[];
    knownUncoveredLegislation: string[];
    missingKnownHealthLegislationCount: number;
    topicClustersRegistered: string[];
    topicClusterCount: number;
    unofficialLegislationSourceCount: number;
    coverageWarnings: string[];
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
  results: BenchmarkItemResult[];
}

export async function runBenchmark(options: {
  sourceMode: "live" | "mock";
  limit?: number;
  outDir: string;
  service?: PhysicianLegalInformationService;
}): Promise<BenchmarkReport> {
  const { sourceMode, limit, outDir } = options;
  const service = options.service ?? new PhysicianLegalInformationService();
  const questionsToRun = typeof limit === "number" ? doctorQuestions.slice(0, limit) : doctorQuestions;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const results: BenchmarkItemResult[] = [];

  for (const question of questionsToRun) {
    const itemStartedAt = Date.now();
    try {
      const enrichedPack = await service.prepareInformationPack({
        question: question.question,
        sourceMode
      });
      results.push(evaluateBenchmarkItem({
        question,
        pack: enrichedPack as unknown as DoctorLegalInformationPack & Record<string, unknown>,
        sourceMode,
        durationMs: Date.now() - itemStartedAt,
        queryTelemetry: enrichedPack.queryTelemetry,
        rerankResult: enrichedPack.rerankResult
      }));
    } catch (error) {
      results.push(evaluateThrownBenchmarkItem({
        question,
        sourceMode,
        durationMs: Date.now() - itemStartedAt,
        error
      }));
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
    auditOk: auditRes.ok
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
    notes: question.notes
  };
}

export function scoreBenchmarkItem(input: {
  question: BenchmarkQuestion;
  pack: DoctorLegalInformationPack;
  legislationOrder: string[];
  auditErrors: string[];
  auditWarnings: string[];
  sourceUnavailableCount: number;
  safety: BenchmarkItemResult["safety"];
  verifiedPrecedentAudit?: VerifiedPrecedentAuditEntry[];
}): BenchmarkScores {
  const { question, pack, legislationOrder, auditErrors, auditWarnings, sourceUnavailableCount, safety } = input;
  const verifiedPrecedentAudit = input.verifiedPrecedentAudit ?? [];
  const hasLegislation = pack.relevantLegislation.length > 0;
  const quoteAndTrace = pack.relevantLegislation.some((item) => Boolean(item.verbatimQuote?.trim()) && Boolean(item.sourceTrace));
  const expectedMatch = question.expectedPrimaryLegislationNames.some((name) =>
    legislationOrder.some((selected) => includesLegislationName(selected, name))
  );
  const unsafe = !safety.forbiddenFieldsAbsent || !safety.noUrgentAction || !safety.noRiskLevel ||
    !safety.noDefinitiveLegalOpinion || !safety.noPetitionDraft || !safety.noUnsafePrecedent ||
    !safety.noMockFallbackInLive || auditErrors.length > 0;
  const hasVerifiedPrecedent = pack.verifiedHighCourtPrecedents.length > 0;
  const hasWeakVerifiedRelevance = verifiedPrecedentAudit.some((entry) => (entry.healthLawRelevanceScore ?? 0) < 1);
  const weakVerifiedCount = verifiedPrecedentAudit.filter((entry) => (entry.healthLawRelevanceScore ?? 0) < 1).length;
  const hasVerifiedTraceOrEvidenceGap = verifiedPrecedentAudit.some((entry) =>
    entry.errors.some((error) =>
      error.includes("source trace") || error.includes("full text") || error.includes("reasoning")
    )
  );
  const hasSourceSuccess = hasLegislation || (pack.precedentDiagnostics?.sourceSummaries ?? []).some((summary) =>
    summary.unavailableCount === 0 && (summary.searchResultsCount ?? 0) > 0
  );

  const legislationMatchScore = !hasLegislation ? 0 : expectedMatch && quoteAndTrace ? 2 : 1;
  const priorityScore = !hasLegislation ? 0 : isClearlyWrongPriority(question, legislationOrder) ? 0 : isPriorityMatch(question, legislationOrder) ? 2 : 1;
  const precedentSafetyScore = !safety.noUnsafePrecedent || hasVerifiedTraceOrEvidenceGap ? 0 :
    hasVerifiedPrecedent ? (hasWeakVerifiedRelevance ? 1 : 2) : 1;
  const sourceAvailabilityScore = !hasSourceSuccess ? 0 : sourceUnavailableCount > 0 ? 1 : 2;
  const auditScore = auditErrors.length > 0 ? 0 : auditWarnings.length > 0 ? 1 : 2;
  const forbiddenFieldsScore = safety.forbiddenFieldsAbsent ? 2 : 0;
  const relevancePenalty = weakVerifiedCount >= 3 ? 2 : weakVerifiedCount > 0 ? 1 : 0;
  const totalScore = legislationMatchScore + priorityScore + precedentSafetyScore + sourceAvailabilityScore + auditScore + forbiddenFieldsScore - relevancePenalty;
  const maxScore = 12;
  const scorePercent = Math.round((totalScore / maxScore) * 100);

  return {
    legislationMatchScore,
    priorityScore,
    precedentSafetyScore,
    sourceAvailabilityScore,
    auditScore,
    forbiddenFieldsScore,
    totalScore,
    maxScore,
    scorePercent,
    qualityBand: unsafe ? "unsafe" : scorePercent >= 80 ? "good" : scorePercent >= 60 ? "acceptable" : "needs_tuning"
  };
}

function evaluateThrownBenchmarkItem(input: {
  question: BenchmarkQuestion;
  sourceMode: "live" | "mock";
  durationMs: number;
  error: unknown;
}): BenchmarkItemResult {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
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
    notes: input.question.notes
  };
}

// Known gaps — legislation that would be valuable but whose mevzuat.gov.tr
// internal IDs are not yet confirmed (so they are not added to the registry).
const KNOWN_UNCOVERED_LEGISLATION = [
  "Ozel Hastaneler Yonetmeligi",
  "Ayakta Teshis ve Tedavi Yapilan Ozel Saglik Kuruluslari Hakkinda Yonetmelik",
  "Saglik Meslek Mensuplarinın Is ve Gorev Tanimlarına Dair Yonetmelik"
] as const;

function buildSufficiencyMetrics(results: BenchmarkItemResult[]): BenchmarkReport["sourceSufficiencyMetrics"] {
  const dist: Record<SourceSufficiencyLevel, number> = { sufficient: 0, partial: 0, insufficient: 0 };
  const missingDist: Record<string, number> = {};
  let cannotCompose = 0;

  for (const result of results) {
    dist[result.sourceSufficiencyLevel]++;
    if (!result.canComposeResearchPack) cannotCompose++;
    for (const missing of result.missingAuthorityTypes) {
      missingDist[missing] = (missingDist[missing] ?? 0) + 1;
    }
  }

  return {
    sourceSufficiencyDistribution: dist,
    insufficientSourceCount: dist.insufficient,
    partialSourceCount: dist.partial,
    sufficientSourceCount: dist.sufficient,
    missingAuthorityTypeDistribution: missingDist,
    cannotComposeResearchPackCount: cannotCompose
  };
}

function buildRouterMetrics(results: BenchmarkItemResult[]): BenchmarkReport["routerMetrics"] {
  const routedIssueCoverage: Record<string, number> = {};
  const primaryIssueDistribution: Record<string, number> = {};
  let lowConfidenceRouteCount = 0;
  let unclearOrMixedCount = 0;
  let multiIssueQuestionCount = 0;

  for (const result of results) {
    for (const issueId of result.routedIssueIds) {
      routedIssueCoverage[issueId] = (routedIssueCoverage[issueId] ?? 0) + 1;
    }
    if (result.primaryIssueId) {
      primaryIssueDistribution[result.primaryIssueId] = (primaryIssueDistribution[result.primaryIssueId] ?? 0) + 1;
    }
    if (result.routerConfidence === "low") lowConfidenceRouteCount++;
    if (result.primaryIssueId === "unclear_or_mixed") unclearOrMixedCount++;
    if (result.routedIssueIds.length > 1) multiIssueQuestionCount++;
  }

  return {
    routedIssueCoverage,
    lowConfidenceRouteCount,
    unclearOrMixedCount,
    multiIssueQuestionCount,
    primaryIssueDistribution
  };
}

function buildOfficialLegislationCoverage(results: BenchmarkItemResult[]): BenchmarkReport["officialLegislationCoverage"] {
  // Collect unique sourceIds registered in healthLegislationHints
  const registeredSourceIds = [...new Set(healthLegislationHints.map((h) => h.sourceId))];
  const coveredTitles = [...new Set(healthLegislationHints.map((h) => h.title))];
  const topicClustersRegistered = [...new Set(healthLegislationHints.map((h) => h.topicCluster))];

  // Count legislation entries in benchmark results whose sourceTrace contains non-gov.tr URLs
  let unofficialCount = 0;
  for (const result of results) {
    if (result.unofficialSourceDetected) {
      unofficialCount++;
    }
  }

  const coverageWarnings: string[] = [];
  if (KNOWN_UNCOVERED_LEGISLATION.length > 0) {
    coverageWarnings.push(
      `${KNOWN_UNCOVERED_LEGISLATION.length} mevzuat(lar) kapsam dışı: mevzuat.gov.tr dahili ID doğrulanamadı — ` +
      KNOWN_UNCOVERED_LEGISLATION.join(", ")
    );
  }
  if (unofficialCount > 0) {
    coverageWarnings.push(
      `${unofficialCount} soruda resmi olmayan mevzuat kaynağı tespit edildi (contract check: unofficialSourceDetected).`
    );
  }

  return {
    coveredOfficialLegislationCount: registeredSourceIds.length,
    coveredLegislationTitles: coveredTitles,
    knownUncoveredLegislation: [...KNOWN_UNCOVERED_LEGISLATION],
    missingKnownHealthLegislationCount: KNOWN_UNCOVERED_LEGISLATION.length,
    topicClustersRegistered,
    topicClusterCount: topicClustersRegistered.length,
    unofficialLegislationSourceCount: unofficialCount,
    coverageWarnings
  };
}

function buildLiveTimeoutMetrics(results: BenchmarkItemResult[]): BenchmarkReport["liveTimeoutMetrics"] {
  const allTelemetry = results.flatMap((r) => r.queryTelemetry);
  const timeoutCount = allTelemetry.filter((t) => t.timedOut).length;
  // Rate-limit proxy: retryAfterMs set means a 429 Retry-After header was honoured
  const rateLimitCount = allTelemetry.filter((t) => t.retryAfterMs !== null && t.retryAfterMs > 0).length;
  // Transient failure: any attempt that needed at least one retry
  const transientFailureCount = allTelemetry.filter((t) => t.retryCount > 0).length;
  const totalRetries = allTelemetry.reduce((sum, t) => sum + t.retryCount, 0);
  const totalBackoffMs = allTelemetry.reduce((sum, t) => sum + t.backoffMs, 0);
  const timedOutSources = [...new Set(allTelemetry.filter((t) => t.timedOut).map((t) => t.source))];
  return { timeoutCount, rateLimitCount, transientFailureCount, totalRetries, totalBackoffMs, timedOutSources };
}

function buildLiveReliabilityGateFromResults(results: BenchmarkItemResult[], sourceMode: "live" | "mock"): LiveReliabilityGate {
  const liveResults = results.filter((r) => r.sourceMode === "live");
  const timeoutMetrics = buildLiveTimeoutMetrics(results);

  const ineligibleUsedCount = results.reduce((sum, r) =>
    sum + (r.precedents.metadataOnlyUsedAsPrecedent || r.precedents.proceduralOnlyUsedAsPrecedent || r.precedents.noReasoningUsedAsPrecedent ? 1 : 0), 0);

  const allTelemetry = results.flatMap((r) => r.queryTelemetry);
  const cacheHitCount = allTelemetry.filter((t) => t.servedFromCache).length;
  const cacheMissCount = allTelemetry.filter((t) => !t.servedFromCache && t.networkRequestMade).length;
  const networkRequestMadeCount = allTelemetry.filter((t) => t.networkRequestMade).length;

  const sourceSufficiencyDistribution = results.map((r) => ({
    query: r.question,
    precedentCount: r.precedents.verifiedHighCourtPrecedentsCount,
    legislationCount: r.legislation.selectedCount,
    sufficient: r.sourceSufficiencyLevel === "sufficient"
  }));

  return buildLiveReliabilityGate({
    totalLiveQuestions: sourceMode === "live" ? results.length : liveResults.length,
    livePassedCount: results.filter((r) => r.passed).length,
    liveFailedCount: results.filter((r) => !r.passed).length,
    mockFallbackDetected: results.some((r) => r.usedMockSourceInLiveMode),
    contractFailedCount: results.filter((r) => !r.contractPassed).length,
    contractUnofficialSourceCount: results.filter((r) => r.unofficialSourceDetected).length,
    ineligibleUsedCount,
    timeoutCount: timeoutMetrics.timeoutCount,
    rateLimitCount: timeoutMetrics.rateLimitCount,
    sourceUnavailableCount: results.reduce((sum, r) => sum + r.legislation.sourceUnavailable.length + r.precedents.sourceUnavailableBreakdown.length, 0),
    transientFailureCount: timeoutMetrics.transientFailureCount,
    totalRetries: timeoutMetrics.totalRetries,
    totalBackoffMs: timeoutMetrics.totalBackoffMs,
    cacheHitCount,
    cacheMissCount,
    networkRequestMadeCount,
    verifiedPrecedentCount: results.reduce((sum, r) => sum + r.precedents.verifiedHighCourtPrecedentsCount, 0),
    sourceSufficiencyDistribution
  });
}

function buildBenchmarkReport(input: {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sourceMode: "live" | "mock";
  results: BenchmarkItemResult[];
}): BenchmarkReport {
  const totalQuestions = input.results.length;
  const passedRegressionCount = input.results.filter((result) => result.regressionStatus === "passed").length;
  const auditOkCount = input.results.filter((result) => result.audit.ok).length;
  const auditErrorCount = input.results.reduce((sum, result) => sum + result.audit.errors.length, 0);
  const auditWarningCount = input.results.reduce((sum, result) => sum + result.audit.warnings.length, 0);
  const questionsWithVerifiedPrecedents = input.results.filter((result) => result.precedents.verifiedHighCourtPrecedentsCount > 0).length;
  const questionsWithLegislation = input.results.filter((result) => result.legislation.selectedCount > 0).length;
  const verifiedAuditEntries = input.results.flatMap((result) => result.precedents.verifiedPrecedentAudit);
  const weakEntriesByResult = input.results.map((result) => ({
    result,
    weakEntries: result.precedents.verifiedPrecedentAudit.filter((entry) => (entry.healthLawRelevanceScore ?? 0) < 1)
  }));
  const relevanceScores = verifiedAuditEntries
    .map((entry) => entry.healthLawRelevanceScore)
    .filter((score): score is number => typeof score === "number");

  return {
    timestamp: input.startedAt,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    sourceMode: input.sourceMode,
    totalQuestions,
    passedCount: passedRegressionCount,
    failedCount: totalQuestions - passedRegressionCount,
    passedRegressionCount,
    failedRegressionCount: totalQuestions - passedRegressionCount,
    liveSourceUnavailableCount: input.results.reduce(
      (sum, result) => sum + result.legislation.sourceUnavailable.length + result.precedents.sourceUnavailableBreakdown.length,
      0
    ),
    auditOkCount,
    auditWarningCount,
    auditErrorCount,
    questionsWithVerifiedPrecedents,
    questionsWithoutVerifiedPrecedents: totalQuestions - questionsWithVerifiedPrecedents,
    questionsWithLegislation,
    questionsWithoutLegislation: totalQuestions - questionsWithLegislation,
    mockFallbackDetected: input.results.some((result) => result.usedMockSourceInLiveMode),
    goodCleanCount: input.results.filter((result) => result.scores.qualityBand === "good" && result.warnings.length === 0).length,
    goodWithWarningsCount: input.results.filter((result) => result.scores.qualityBand === "good" && result.warnings.length > 0).length,
    goodWithInformationalWarningsCount: input.results.filter((result) =>
      result.scores.qualityBand === "good" && result.informationalWarnings.length > 0 && result.tuningWarnings.length === 0 && result.safetyWarnings.length === 0
    ).length,
    goodWithTuningWarningsCount: input.results.filter((result) =>
      result.scores.qualityBand === "good" && result.tuningWarnings.length > 0
    ).length,
    acceptableCount: input.results.filter((result) => result.scores.qualityBand === "acceptable").length,
    needsTuningCount: input.results.filter((result) => result.scores.qualityBand === "needs_tuning").length,
    unsafeCount: input.results.filter((result) => result.scores.qualityBand === "unsafe").length,
    informationalWarningCount: input.results.reduce((sum, result) => sum + result.informationalWarnings.length, 0),
    tuningWarningCount: input.results.reduce((sum, result) => sum + result.tuningWarnings.length, 0),
    safetyWarningCount: input.results.reduce((sum, result) => sum + result.safetyWarnings.length, 0),
    questionsWithInformationalWarnings: input.results.filter((result) => result.informationalWarnings.length > 0).length,
    questionsWithTuningWarnings: input.results.filter((result) => result.tuningWarnings.length > 0).length,
    questionsWithSafetyWarnings: input.results.filter((result) => result.safetyWarnings.length > 0).length,
    weakRelevanceWarningCount: verifiedAuditEntries.filter((entry) => (entry.healthLawRelevanceScore ?? 0) < 1).length,
    questionsWithWeakRelevance: weakEntriesByResult.filter((entry) => entry.weakEntries.length > 0).length,
    averageHealthLawRelevanceScore: average(relevanceScores),
    medianHealthLawRelevanceScore: median(relevanceScores),
    weakRelevanceByQuestion: Object.fromEntries(weakEntriesByResult
      .filter((entry) => entry.weakEntries.length > 0)
      .map((entry) => [entry.result.id, entry.weakEntries.length])),
    weakRelevanceBySource: countBy(verifiedAuditEntries.filter((entry) => (entry.healthLawRelevanceScore ?? 0) < 1), (entry) => entry.court ?? "unknown"),
    weakRelevanceExamples: weakEntriesByResult.flatMap(({ result, weakEntries }) =>
      weakEntries.slice(0, 3).map((entry) => ({
        questionId: result.id,
        decisionId: entry.sourceId,
        court: entry.court,
        chamber: entry.chamber,
        matchedTerms: entry.matchedHealthLawTerms,
        missingExpectedIssueTerms: entry.missingExpectedIssueTerms,
        whyWeak: entry.whyWeak,
        suggestedQueryTerms: entry.suggestedQueryTerms
      }))
    ).slice(0, 20),
    verifiedPrecedentAudit: {
      totalVerifiedPrecedents: verifiedAuditEntries.length,
      auditErrorCount: verifiedAuditEntries.reduce((sum, entry) => sum + entry.errors.length, 0),
      auditWarningCount: verifiedAuditEntries.reduce((sum, entry) => sum + entry.warnings.length, 0),
      missingMetadataCount: verifiedAuditEntries.filter((entry) => !entry.decisionDate || !entry.esasNo || !entry.kararNo).length,
      weakRelevanceCount: verifiedAuditEntries.filter((entry) => (entry.healthLawRelevanceScore ?? 0) < 1).length,
      missingTraceCount: verifiedAuditEntries.filter((entry) => !entry.decisionSourceTracePresent).length
    },
    sourceSufficiencyMetrics: buildSufficiencyMetrics(input.results),
    routerMetrics: buildRouterMetrics(input.results),
    officialLegislationCoverage: buildOfficialLegislationCoverage(input.results),
    contractPassedCount: input.results.filter((r) => r.contractPassed).length,
    contractFailedCount: input.results.filter((r) => !r.contractPassed).length,
    contractMissingSectionTotal: input.results.reduce((sum, r) => sum + r.missingSections.length, 0),
    contractMissingLegislationFieldTotal: input.results.reduce((sum, r) => sum + r.missingLegislationFieldCount, 0),
    contractMissingPrecedentFieldTotal: input.results.reduce((sum, r) => sum + r.missingPrecedentFieldCount, 0),
    contractUnofficialSourceCount: input.results.filter((r) => r.unofficialSourceDetected).length,
    contractUnsafeAdviceCount: input.results.filter((r) => r.unsafeAdviceDetected).length,
    ...buildQueryAggregateMetrics(input.results, verifiedAuditEntries),
    liveTimeoutMetrics: buildLiveTimeoutMetrics(input.results),
    liveReliabilityGate: buildLiveReliabilityGateFromResults(input.results, input.sourceMode),
    results: input.results
  };
}

function buildSafety(
  pack: DoctorLegalInformationPack & Record<string, unknown>,
  sourceMode: "live" | "mock",
  selectedStatuses: PrecedentStatus[],
  forbiddenFieldMatches: string[],
  verifiedPrecedentAudit: VerifiedPrecedentAuditEntry[] = [],
  usedMockSourceInLiveMode = false
): BenchmarkItemResult["safety"] {
  const rootText = JSON.stringify(pack).toLocaleLowerCase("tr-TR");
  const unsafePrecedent = selectedStatuses.some((status) =>
    status === "metadata_only" || status === "procedural_only" || status === "no_reasoning"
  ) || verifiedPrecedentAudit.some((entry) => entry.errors.length > 0);

  return {
    forbiddenFieldsAbsent: forbiddenFieldMatches.length === 0,
    noUrgentAction: !rootText.includes("derhal yapilacak") && !rootText.includes("derhal yapılacak"),
    noRiskLevel: !("riskLevel" in pack) && !("riskSeviyesi" in pack),
    noDefinitiveLegalOpinion: !rootText.includes("kesin hukuki kanaat") && !("finalLegalOpinion" in pack),
    noPetitionDraft: !rootText.includes("dilekçe taslağı") && !rootText.includes("savunma taslağı") && !("dilekseTaslagi" in pack),
    noUnsafePrecedent: !unsafePrecedent,
    noMockFallbackInLive: sourceMode === "live" ? !usedMockSourceInLiveMode : true
  };
}

function buildRegressionFailures(input: {
  sourceMode: "live" | "mock";
  question: BenchmarkQuestion;
  pack: DoctorLegalInformationPack & Record<string, unknown>;
  legislationOrder: string[];
  kvkkIncluded: boolean;
  auditErrors: string[];
  forbiddenFieldMatches: string[];
  safety: BenchmarkItemResult["safety"];
}): string[] {
  const failures = [...input.auditErrors];
  for (const field of input.forbiddenFieldMatches) {
    failures.push(`Forbidden field present: "${field}"`);
  }
  if (!input.safety.noUnsafePrecedent) failures.push("Unsafe precedent status appeared in selected/verified precedent diagnostics.");
  if (!input.safety.noMockFallbackInLive) failures.push("Live mode used mock source fallback.");
  if (!input.safety.noUrgentAction) failures.push("Urgent action wording appeared in pack.");
  if (!input.safety.noRiskLevel) failures.push("Risk level field or wording appeared in pack.");
  if (!input.safety.noDefinitiveLegalOpinion) failures.push("Definitive legal opinion wording appeared in pack.");
  if (!input.safety.noPetitionDraft) failures.push("Petition/defense draft wording appeared in pack.");

  if (input.sourceMode === "mock") {
    const shouldNotHaveKvkk = input.question.shouldNotIncludeLegislation.includes("Kisisel Verilerin Korunmasi Kanunu");
    const shouldHaveKvkk = input.question.shouldIncludeLegislation.includes("Kisisel Verilerin Korunmasi Kanunu");
    if (shouldNotHaveKvkk && input.kvkkIncluded) failures.push("KVKK was included but this question must not contain KVKK.");
    if (shouldHaveKvkk && !input.kvkkIncluded) failures.push("KVKK was expected but not found in the pack.");
    if (isMockRegressionWrongPriority(input.question, input.legislationOrder)) {
      failures.push("Physician-centric legislation priority was clearly wrong.");
    }
    for (const expected of input.question.shouldIncludeLegislation) {
      if (!input.legislationOrder.some((name) => includesLegislationName(name, expected))) {
        failures.push(`Expected legislation "${expected}" was not found in the pack.`);
      }
    }
  }

  return [...new Set(failures)];
}

function buildCategorizedWarnings(input: {
  sourceMode: "live" | "mock";
  question: BenchmarkQuestion;
  legislationOrder: string[];
  sourceUnavailable: SourceUnavailableMetric[];
  precedentUnavailable: SourceUnavailableMetric[];
  selectedPrecedentCount: number;
  packAuditWarnings: string[];
  verifiedAuditWarnings: string[];
  fallbackUsed?: boolean;
  hasVerifiedPrecedents?: boolean;
}): { informational: string[]; tuning: string[]; safety: string[] } {
  const informational: string[] = [];
  const tuning: string[] = [];

  for (const warning of input.packAuditWarnings) {
    informational.push(warning);
  }
  for (const warning of input.verifiedAuditWarnings) {
    if (/relevance score/i.test(warning) || /weak relevance/i.test(warning)) {
      tuning.push(warning);
    } else {
      informational.push(warning);
    }
  }

  if (input.sourceUnavailable.length > 0) {
    informational.push(`Legislation source unavailable: ${input.sourceUnavailable.map((entry) => entry.errorCode).join(", ")}`);
  }
  if (input.precedentUnavailable.length > 0) {
    informational.push(`Precedent source unavailable: ${input.precedentUnavailable.map((entry) => `${entry.source}:${entry.errorCode}`).join(", ")}`);
  }
  if (input.sourceMode === "live") {
    informational.push("Live source quality is informational; transient source gaps are metrics, not automatic failures.");
  }
  if (input.fallbackUsed && input.hasVerifiedPrecedents) {
    informational.push("Fallback query was used; verified precedent quality is adequate.");
  }

  if (input.legislationOrder.length === 0) tuning.push("No legislation selected.");
  if (!isPriorityMatch(input.question, input.legislationOrder)) tuning.push("Expected primary legislation is not in the leading positions.");
  if (input.selectedPrecedentCount === 0) tuning.push("No verified high court precedent selected.");
  if (input.fallbackUsed && !input.hasVerifiedPrecedents) {
    tuning.push("Fallback query used but no verified precedent produced.");
  }

  return {
    informational: [...new Set(informational)],
    tuning: [...new Set(tuning)],
    safety: []
  };
}

function collectTopicClusters(pack: DoctorLegalInformationPack): string[] {
  const clusters = new Set<string>();
  for (const item of pack.selectionDiagnostics?.selectedLegislations ?? []) {
    if (item.topicCluster) clusters.add(item.topicCluster);
  }
  for (const trace of pack.sourceTrace ?? []) {
    if (trace.matchedHealthMapping?.topicCluster) clusters.add(trace.matchedHealthMapping.topicCluster);
  }
  return [...clusters];
}

function findHhyRole(pack: DoctorLegalInformationPack, legislationOrder: string[], question: BenchmarkQuestion): string | null {
  const hhyItem = pack.selectionDiagnostics?.selectedLegislations.find((item) => includesLegislationName(item.legislationName, "Hasta Haklari Yonetmeligi"));
  if (hhyItem) return hhyItem.legislationRole;
  if (!legislationOrder.some((name) => includesLegislationName(name, "Hasta Haklari Yonetmeligi"))) return null;
  return question.expectedPrimaryLegislationRoles["Hasta Haklari Yonetmeligi"] ?? "health_primary";
}

function collectLegislationUnavailable(pack: DoctorLegalInformationPack): SourceUnavailableMetric[] {
  return (pack.sourceUnavailable ?? []).map((entry) => ({
    source: entry.source,
    errorCode: entry.errorCode,
    message: entry.message,
    retryable: entry.retryable
  }));
}

function collectPrecedentUnavailable(pack: DoctorLegalInformationPack): SourceUnavailableMetric[] {
  return (pack.precedentDiagnostics?.sourceSummaries ?? [])
    .filter((summary) => summary.unavailableCount > 0)
    .flatMap((summary) =>
      (summary.errorCodes.length > 0 ? summary.errorCodes : ["source_unavailable"]).map((errorCode) => ({
        source: summary.source,
        errorCode,
        message: `${summary.source} unavailable in ${summary.mode} mode`
      }))
    );
}

function countExclusionReasons(pack: DoctorLegalInformationPack): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const excluded of pack.precedentDiagnostics?.excludedDecisions ?? []) {
    for (const reason of excluded.exclusionReasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return counts;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function countBy<T>(values: T[], keyFn: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildVerifiedPrecedentAudit(
  pack: DoctorLegalInformationPack,
  sourceMode: "live" | "mock"
): VerifiedPrecedentAuditEntry[] {
  return pack.verifiedHighCourtPrecedents.map((entry) => {
    const trace = entry.decisionSourceTrace;
    const status = entry.eligibilityStatus ?? null;
    const court = entry.court ?? inferCourt(entry.courtAndChamber);
    const accessSource = entry.accessSource ?? null;
    const sourceId = entry.sourceId ?? entry.sourceDocumentId ?? null;
    const fullTextAvailable = entry.fullTextAvailable === true;
    const reasoningDetected = entry.reasoningDetected === true;
    const healthLawRelevanceScore = typeof entry.healthLawRelevanceScore === "number" ? entry.healthLawRelevanceScore : null;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (status && status !== "precedent_usable") errors.push(`eligibilityStatus must be precedent_usable, got ${status}.`);
    if (sourceMode === "live" && status !== "precedent_usable") errors.push(`eligibilityStatus must be precedent_usable, got ${status ?? "missing"}.`);
    if (sourceMode === "live" && !fullTextAvailable) errors.push("full text is not confirmed available.");
    if (sourceMode === "live" && !reasoningDetected) errors.push("reasoning is not confirmed detected.");
    if (sourceMode === "live" && !trace) errors.push("decision source trace is missing.");
    if (sourceMode === "live" && isMockAccessSource(accessSource)) errors.push("live mode verified precedent used mock accessSource.");
    if (court && normalizeName(court).includes("bedesten")) errors.push("court field must stay as the deciding court, not Bedesten access channel.");
    if (status === "metadata_only" || status === "procedural_only" || status === "no_reasoning") {
      errors.push(`unsafe status ${status} leaked into verified precedents.`);
    }
    if (!entry.decisionDate && !entry.date) warnings.push("decisionDate is missing.");
    if (!entry.meritsNumber && !extractMeritsAndDecision(entry.meritsAndDecisionNumber).esasNo) warnings.push("esasNo is missing.");
    if (!entry.decisionNumber && !extractMeritsAndDecision(entry.meritsAndDecisionNumber).kararNo) warnings.push("kararNo is missing.");
    if ((healthLawRelevanceScore ?? 0) < 1) warnings.push("health-law relevance score is weak or missing.");

    const numbers = extractMeritsAndDecision(entry.meritsAndDecisionNumber);

    // Derive contentStatus from fullTextAvailable + reasoningDetected
    const contentStatus: ContentStatus | null = fullTextAvailable && reasoningDetected
      ? "full_text"
      : fullTextAvailable
        ? "html_markdown"
        : entry.fullTextAvailable === false
          ? "metadata_only"
          : null;
    const quoteUsable = status === "precedent_usable";

    return {
      court: court ?? null,
      chamber: entry.chamber ?? inferChamber(entry.courtAndChamber),
      decisionDate: entry.decisionDate ?? entry.date ?? null,
      esasNo: entry.meritsNumber ?? numbers.esasNo,
      kararNo: entry.decisionNumber ?? numbers.kararNo,
      accessSource,
      sourceId,
      documentId: sourceId,
      sourceUrl: entry.sourceUrl ?? trace?.searchRequest?.url ?? null,
      fullTextAvailable,
      reasoningDetected,
      eligibilityStatus: status,
      eligibilityReasons: entry.eligibilityReasons ?? [],
      healthLawRelevanceScore,
      matchedQueryTerms: entry.matchedQueryTerms ?? [],
      matchedHealthLawTerms: entry.matchedHealthLawTerms ?? [],
      issueProfile: entry.issueProfile ?? null,
      missingExpectedIssueTerms: entry.missingExpectedIssueTerms ?? [],
      whyWeak: entry.weakRelevanceReason ?? null,
      suggestedQueryTerms: entry.suggestedQueryTerms ?? [],
      decisionSourceTracePresent: Boolean(trace),
      sourceTraceFullTextUrl: trace?.searchRequest?.url ?? null,
      selectedAsVerifiedReason: entry.selectedAsVerifiedReason ?? null,
      exclusionReason: entry.exclusionReasons?.[0] ?? null,
      contentStatus,
      quoteUsable,
      errors,
      warnings
    };
  });
}

function detectMockFallback(
  pack: DoctorLegalInformationPack,
  sourceMode: "live" | "mock",
  verifiedPrecedentAudit: VerifiedPrecedentAuditEntry[]
): boolean {
  if (sourceMode !== "live") return false;
  return (pack.precedentDiagnostics?.sourceSummaries ?? []).some((summary) => summary.mode === "mock") ||
    verifiedPrecedentAudit.some((entry) => isMockAccessSource(entry.accessSource)) ||
    (pack.sourceTrace ?? []).some((trace) => trace.extractionMethod === "mock");
}

function isMockAccessSource(value: string | null | undefined): boolean {
  return Boolean(value && /mock/i.test(value));
}

function inferCourt(courtAndChamber: string): string | null {
  const first = courtAndChamber.split("/")[0]?.trim();
  return first || null;
}

function inferChamber(courtAndChamber: string): string | null {
  const parts = courtAndChamber.split("/");
  return parts.length > 1 ? parts.slice(1).join("/").trim() || null : null;
}

function extractMeritsAndDecision(value: string): { esasNo: string | null; kararNo: string | null } {
  const [esasNo, kararNo] = value.split(/\s+-\s+|\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  return { esasNo: esasNo ?? null, kararNo: kararNo ?? null };
}

function findForbiddenFields(pack: Record<string, unknown>): string[] {
  const rootKeys = Object.keys(pack);
  return FORBIDDEN_FIELDS_LIST.filter((forbidden) =>
    rootKeys.some((key) => key.toLocaleLowerCase("tr-TR") === forbidden.toLocaleLowerCase("tr-TR"))
  );
}

function isPriorityMatch(question: BenchmarkQuestion, legislationOrder: string[]): boolean {
  if (legislationOrder.length === 0) return false;
  const leading = legislationOrder.slice(0, 2);
  return question.expectedPrimaryLegislationNames.some((expected) =>
    leading.some((name) => includesLegislationName(name, expected))
  );
}

function isClearlyWrongPriority(question: BenchmarkQuestion, legislationOrder: string[]): boolean {
  const first = legislationOrder[0];
  if (!first) return false;
  if ((question.id === "refusal-noncompliance" || question.id === "private-hospital-fees") &&
    includesLegislationName(first, "Hasta Haklari Yonetmeligi")) {
    return true;
  }
  if ((question.id === "refusal-noncompliance" || question.id === "emergency-intervention") &&
    includesLegislationName(first, "Kisisel Verilerin Korunmasi Kanunu")) {
    return true;
  }
  return question.expectedPrimaryLegislationNames.length > 0 &&
    !question.expectedPrimaryLegislationNames.some((expected) => includesLegislationName(first, expected));
}

function isMockRegressionWrongPriority(question: BenchmarkQuestion, legislationOrder: string[]): boolean {
  const first = legislationOrder[0];
  return Boolean(first) &&
    (question.id === "refusal-noncompliance" || question.id === "private-hospital-fees") &&
    includesLegislationName(first, "Hasta Haklari Yonetmeligi");
}

function includesLegislationName(actual: string, expected: string): boolean {
  return normalizeName(actual).includes(normalizeName(expected)) || normalizeName(expected).includes(normalizeName(actual));
}

function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildQueryAggregateMetrics(
  results: BenchmarkItemResult[],
  verifiedAuditEntries: VerifiedPrecedentAuditEntry[]
) {
  const allTelemetry = results.flatMap((r) => r.queryTelemetry);
  const globalMetrics = buildGlobalQueryMetrics(allTelemetry);

  const verifiedWithSource = results.flatMap((r) =>
    r.precedents.verifiedPrecedentAudit.map((entry) => ({
      source: entry.court,
      entry
    }))
  );

  const sourceReliability = buildSourceReliabilityMetrics(allTelemetry, verifiedWithSource);

  const profileItems = results.map((r) => ({
    issueProfile: r.issueProfile,
    fallbackUsed: r.fallbackUsed,
    verifiedCount: r.precedents.verifiedHighCourtPrecedentsCount,
    queryTelemetry: r.queryTelemetry,
    weakRelevanceCount: r.precedents.verifiedPrecedentAudit.filter((e) => (e.healthLawRelevanceScore ?? 0) < 1).length
  }));

  const issueProfileReliability = buildIssueProfileReliabilityMetrics(allTelemetry, profileItems);

  // Populate averageRelevance per profile from verified audit entries
  const enrichedIssueProfileReliability = issueProfileReliability.map((m) => {
    const profileResults = results.filter((r) => r.issueProfile === m.issueProfile);
    const relevanceScores = profileResults.flatMap((r) =>
      r.precedents.verifiedPrecedentAudit
        .map((e) => e.healthLawRelevanceScore)
        .filter((s): s is number => typeof s === "number")
    );
    return {
      ...m,
      averageRelevance: relevanceScores.length > 0
        ? Math.round((relevanceScores.reduce((s, v) => s + v, 0) / relevanceScores.length) * 100) / 100
        : null
    };
  });

  void verifiedAuditEntries; // used by caller for other metrics

  return {
    ...globalMetrics,
    fallbackUsedCount: results.filter((r) => r.fallbackUsed).length,
    rerankChangedSelectionCount: results.filter((r) => r.rerankChangedSelection).length,
    sourceReliability,
    issueProfileReliability: enrichedIssueProfileReliability
  };
}

function generateMarkdownReport(report: BenchmarkReport): string {
  let md = `# Physician Question ${report.sourceMode === "live" ? "Live " : ""}Benchmark Report

- **Started**: \`${report.startedAt}\`
- **Completed**: \`${report.completedAt}\`
- **Duration**: ${report.durationMs} ms
- **Source Mode**: \`${report.sourceMode}\`
- **Total Questions Checked**: ${report.totalQuestions}
- **Regression Passed**: ${report.passedRegressionCount} / ${report.totalQuestions}
- **Regression Failed**: ${report.failedRegressionCount} / ${report.totalQuestions}
- **Audit OK**: ${report.auditOkCount}
- **Audit Warnings**: ${report.auditWarningCount}
- **Audit Errors**: ${report.auditErrorCount}
- **Live Source Unavailable Metrics**: ${report.liveSourceUnavailableCount}
- **Questions With Legislation**: ${report.questionsWithLegislation}
- **Questions Without Legislation**: ${report.questionsWithoutLegislation}
- **Questions With Verified Precedents**: ${report.questionsWithVerifiedPrecedents}
- **Questions Without Verified Precedents**: ${report.questionsWithoutVerifiedPrecedents}
- **Mock Fallback Detected**: \`${report.mockFallbackDetected}\`
- **Good Clean**: ${report.goodCleanCount}
- **Good With Warnings**: ${report.goodWithWarningsCount}
- **Good (Informational Only)**: ${report.goodWithInformationalWarningsCount}
- **Good With Tuning Warnings**: ${report.goodWithTuningWarningsCount}
- **Acceptable**: ${report.acceptableCount}
- **Needs Tuning**: ${report.needsTuningCount}
- **Unsafe**: ${report.unsafeCount}
- **Informational Warnings**: ${report.informationalWarningCount} (${report.questionsWithInformationalWarnings} questions)
- **Tuning Warnings**: ${report.tuningWarningCount} (${report.questionsWithTuningWarnings} questions)
- **Safety Warnings**: ${report.safetyWarningCount} (${report.questionsWithSafetyWarnings} questions)
- **Weak Relevance Warnings**: ${report.weakRelevanceWarningCount}
- **Questions With Weak Relevance**: ${report.questionsWithWeakRelevance}
- **Average Health-Law Relevance Score**: ${report.averageHealthLawRelevanceScore ?? "n/a"}
- **Median Health-Law Relevance Score**: ${report.medianHealthLawRelevanceScore ?? "n/a"}

## Live Source Summary

- **SourceUnavailable Metrics**: ${report.liveSourceUnavailableCount}
- **Questions With Legislation**: ${report.questionsWithLegislation}/${report.totalQuestions}
- **Questions With Verified Precedents**: ${report.questionsWithVerifiedPrecedents}/${report.totalQuestions}

## Mock Fallback Control

${report.mockFallbackDetected ? "- Live mode mock fallback was detected and treated as a hard regression.\n" : "- No mock fallback detected in live-mode benchmark evidence.\n"}

## Live Reliability Gate (v0.26.0)

- **Gate Passed**: \`${report.liveReliabilityGate.gatePassed}\`
- **Total Live Questions**: ${report.liveReliabilityGate.totalLiveQuestions}
- **Passed**: ${report.liveReliabilityGate.livePassedCount} | **Failed**: ${report.liveReliabilityGate.liveFailedCount}
- **Verified Precedents**: ${report.liveReliabilityGate.verifiedPrecedentCount}
- **Timeouts**: ${report.liveReliabilityGate.timeoutCount} | **Rate Limits**: ${report.liveReliabilityGate.rateLimitCount} | **Transient Failures**: ${report.liveReliabilityGate.transientFailureCount}
- **Total Retries**: ${report.liveReliabilityGate.totalRetries} | **Total Backoff**: ${report.liveReliabilityGate.totalBackoffMs} ms
- **Cache Hits**: ${report.liveReliabilityGate.cacheHitCount} | **Cache Misses**: ${report.liveReliabilityGate.cacheMissCount} | **Network Requests**: ${report.liveReliabilityGate.networkRequestMadeCount}

${report.liveReliabilityGate.gateFailures.length > 0
  ? `**Hard Failures:**\n${report.liveReliabilityGate.gateFailures.map((f) => `- ❌ ${f}`).join("\n")}`
  : "**Hard Failures:** none — gate passed."}

${report.liveReliabilityGate.gateObservations.length > 0
  ? `**Soft Observations:**\n${report.liveReliabilityGate.gateObservations.map((o) => `- ⚠️ ${o}`).join("\n")}`
  : "**Soft Observations:** none."}

## Query Effectiveness

- **Total Query Attempts**: ${report.totalQueryAttempts}
- **Successful Attempts**: ${report.successfulQueryAttempts}
- **Failed Attempts**: ${report.failedQueryAttempts}
- **Source Unavailable**: ${report.sourceUnavailableAttempts}
- **Fallback Used**: ${report.fallbackUsedCount} questions
- **Rerank Changed Selection**: ${report.rerankChangedSelectionCount} questions
- **Average Query Duration**: ${report.averageQueryDurationMs ?? "n/a"} ms
- **p50 Query Duration**: ${report.p50QueryDurationMs ?? "n/a"} ms
- **p95 Query Duration**: ${report.p95QueryDurationMs ?? "n/a"} ms
- **p99 Query Duration**: ${report.p99QueryDurationMs ?? "n/a"} ms

## Source Reliability

| Source | Attempts | Successes | Failures | Unavailable | Avg ms | p95 ms | Verified Precedents | Avg Relevance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${report.sourceReliability.map((s) => `| ${s.source} | ${s.attempts} | ${s.successes} | ${s.failures} | ${s.unavailableCount} | ${s.avgDurationMs ?? "n/a"} | ${s.p95DurationMs ?? "n/a"} | ${s.verifiedPrecedentsProduced} | ${s.averageRelevance ?? "n/a"} |`).join("\n") || "- No telemetry collected (mock mode or no live queries)."}

## Issue Profile Reliability

| Profile | Attempts | Verified | Fallback Used | Avg ms | p95 ms | Avg Relevance | Weak Relevance |
|---|---:|---:|---:|---:|---:|---:|---:|
${report.issueProfileReliability.map((p) => `| ${p.issueProfile} | ${p.attempts} | ${p.verifiedPrecedentsProduced} | ${p.fallbackUsedCount} | ${p.avgDurationMs ?? "n/a"} | ${p.p95DurationMs ?? "n/a"} | ${p.averageRelevance ?? "n/a"} | ${p.weakRelevanceCount} |`).join("\n") || "- No telemetry collected (mock mode or no live queries)."}

## Warning Taxonomy

| Category | Count | Questions Affected |
|---|---:|---:|
| Informational | ${report.informationalWarningCount} | ${report.questionsWithInformationalWarnings} |
| Tuning | ${report.tuningWarningCount} | ${report.questionsWithTuningWarnings} |
| Safety | ${report.safetyWarningCount} | ${report.questionsWithSafetyWarnings} |
| Audit Errors | ${report.auditErrorCount} | ${report.results.filter((r) => r.audit.errors.length > 0).length} |

**Informational** — live source gaps, missing metadata, source availability notes. Not actionable; do not affect quality band.
**Tuning** — weak relevance, missing legislation, priority mismatches. Indicate areas for deterministic mapping improvement.
**Safety** — verified precedent adjacent issues. Currently 0 in this schema version.

## Per-Question Warning Summary

| ID | Profile | Band | Info | Tuning | Safety | Precedents | Relevance | Fallback | Rerank | Audit |
|---|---|---|---:|---:|---:|---:|---:|---|---|---|
${report.results.map((r) => `| \`${r.id}\` | ${r.issueProfile} | \`${r.scores.qualityBand}\` | ${r.informationalWarnings.length} | ${r.tuningWarnings.length} | ${r.safetyWarnings.length} | ${r.precedents.verifiedHighCourtPrecedentsCount} | ${r.precedents.verifiedPrecedentAudit[0]?.healthLawRelevanceScore ?? "n/a"} | ${r.fallbackUsed ? "yes" : "no"} | ${r.rerankChangedSelection ? "changed" : "same"} | ${r.audit.errors.length > 0 ? "error" : r.audit.warnings.length > 0 ? "warn" : "ok"} |`).join("\n")}

## Verified Precedent Audit Summary

- **Total Verified Precedents Audited**: ${report.verifiedPrecedentAudit.totalVerifiedPrecedents}
- **Audit Errors**: ${report.verifiedPrecedentAudit.auditErrorCount}
- **Audit Warnings**: ${report.verifiedPrecedentAudit.auditWarningCount}
- **Missing Metadata Warnings**: ${report.verifiedPrecedentAudit.missingMetadataCount}
- **Weak Relevance Warnings**: ${report.verifiedPrecedentAudit.weakRelevanceCount}
- **Missing Trace Errors**: ${report.verifiedPrecedentAudit.missingTraceCount}

## Weak Relevance Kararlari

${renderWeakRelevanceMarkdown(report)}

## Score Table

| ID | Category | Regression | Band | Score | Legislation | Priority | Precedent Safety | Source | Audit | Forbidden | Warnings |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
`;

  for (const result of report.results) {
    md += `| \`${result.id}\` | ${result.category} | ${result.regressionStatus} | \`${result.scores.qualityBand}\` | ${result.scores.totalScore}/${result.scores.maxScore} (${result.scores.scorePercent}%) | ${result.scores.legislationMatchScore} | ${result.scores.priorityScore} | ${result.scores.precedentSafetyScore} | ${result.scores.sourceAvailabilityScore} | ${result.scores.auditScore} | ${result.scores.forbiddenFieldsScore} | ${result.warnings.length} |\n`;
  }

  md += `\n## Source Unavailable Breakdown\n\n`;
  const unavailableRows = report.results.flatMap((result) => [
    ...result.legislation.sourceUnavailable.map((entry) => ({ id: result.id, area: "legislation", ...entry })),
    ...result.precedents.sourceUnavailableBreakdown.map((entry) => ({ id: result.id, area: "precedent", ...entry }))
  ]);
  if (unavailableRows.length === 0) {
    md += "- No source unavailable metrics recorded.\n";
  } else {
    md += "| ID | Area | Source | Error Code | Message |\n|---|---|---|---|---|\n";
    for (const row of unavailableRows) {
      md += `| \`${row.id}\` | ${row.area} | ${row.source} | \`${row.errorCode}\` | ${row.message.replace(/\|/g, "/")} |\n`;
    }
  }

  md += `\n## Questions Without Verified Precedents\n\n`;
  const noPrecedent = report.results.filter((result) => result.precedents.verifiedHighCourtPrecedentsCount === 0);
  md += noPrecedent.length === 0
    ? "- Every question has at least one verified precedent.\n"
    : noPrecedent.map((result) => `- \`${result.id}\` (${result.category})`).join("\n") + "\n";

  md += `\n## Verified Precedent Audit Details\n\n`;
  const audited = report.results.flatMap((result) =>
    result.precedents.verifiedPrecedentAudit.map((entry) => ({ id: result.id, entry }))
  );
  if (audited.length === 0) {
    md += "- No verified precedents were selected.\n";
  } else {
    md += "| ID | Court | Access | Date | Esas | Karar | Full Text | Reasoning | Eligibility | Relevance | Trace | Errors | Warnings |\n|---|---|---|---|---|---|---:|---:|---|---:|---:|---:|---:|\n";
    for (const row of audited) {
      md += `| \`${row.id}\` | ${row.entry.court ?? "none"} | ${row.entry.accessSource ?? "none"} | ${row.entry.decisionDate ?? "none"} | ${row.entry.esasNo ?? "none"} | ${row.entry.kararNo ?? "none"} | ${row.entry.fullTextAvailable} | ${row.entry.reasoningDetected} | \`${row.entry.eligibilityStatus ?? "missing"}\` | ${row.entry.healthLawRelevanceScore ?? "n/a"} | ${row.entry.decisionSourceTracePresent} | ${row.entry.errors.length} | ${row.entry.warnings.length} |\n`;
    }
  }

  md += `\n## Weak Relevance / Missing Metadata Warnings\n\n`;
  const auditWarnings = audited.filter((row) => row.entry.warnings.length > 0);
  md += auditWarnings.length === 0
    ? "- No weak relevance or missing metadata warnings recorded.\n"
    : auditWarnings.map((row) => `- \`${row.id}\`: ${row.entry.warnings.join("; ")}`).join("\n") + "\n";

  md += `\n## Legislation Priority Notes\n\n`;
  const priorityWarnings = report.results.filter((result) => !result.legislation.priorityMatch);
  md += priorityWarnings.length === 0
    ? "- All questions match expected primary legislation in the leading positions.\n"
    : priorityWarnings.map((result) => `- \`${result.id}\`: first=\`${result.legislation.firstLegislationName ?? "none"}\`, expected=${result.legislation.expectedPrimaryLegislation.map((name) => `\`${name}\``).join(", ")}`).join("\n") + "\n";

  md += `\n## Detailed Question Breakdown\n\n`;
  for (const result of report.results) {
    md += `### ${result.id} (${result.category})

- **Regression Status**: \`${result.regressionStatus}\`
- **Quality Band**: \`${result.scores.qualityBand}\`
- **Score**: ${result.scores.totalScore}/${result.scores.maxScore} (${result.scores.scorePercent}%)
- **Legislation Priority**:
${result.legislationOrder.length > 0 ? result.legislationOrder.map((name, index) => `  ${index + 1}. ${name}`).join("\n") : "  *No legislation matched*"}
- **SourceUnavailable**: ${result.legislation.sourceUnavailable.length + result.precedents.sourceUnavailableBreakdown.length}
- **Verified Precedents**: ${result.precedents.verifiedHighCourtPrecedentsCount}
- **Excluded Precedents**: ${result.precedents.excludedCount}
- **Used Mock Source In Live Mode**: \`${result.usedMockSourceInLiveMode}\`
- **Safety**: forbiddenFieldsAbsent=\`${result.safety.forbiddenFieldsAbsent}\`, noUnsafePrecedent=\`${result.safety.noUnsafePrecedent}\`, noMockFallbackInLive=\`${result.safety.noMockFallbackInLive}\`
- **Audit**: \`${result.auditStatus}\`
- **Warnings**: ${result.warnings.length > 0 ? result.warnings.join("; ") : "none"}
- **Failure Reasons**: ${result.failureReasons.length > 0 ? result.failureReasons.join("; ") : "none"}
- **Tuning Note**: ${result.scores.qualityBand === "good" ? "none" : result.warnings[0] ?? result.failureReasons[0] ?? "inspect scoring inputs"}

`;
  }

  md += `## v0.19.0 Tuning Suggestions

- **Informational warnings** (live source gaps, fallback-but-quality-ok, missing metadata) are expected in live mode.
- **Tuning warnings** (weak relevance, missing legislation, priority order, fallback-with-no-result) indicate actionable improvements.
- Use **Source Reliability** table to identify which sources have high p95 latency or low verified precedent yield.
- Use **Issue Profile Reliability** to identify profiles where fallback queries are frequently needed.
- **Rerank changed selection** indicates the pre-selection order differed from relevance order — review those questions first.
- Treat source-unavailable metrics as live reliability signals, not automatic legal-quality failures.
- Keep audit errors and unsafe precedent usage as hard regression failures.
- v0.20 target: per-profile live reliability baselines, court-result reranking before selection, query cache hit rate.
`;

  return md;
}

function renderWeakRelevanceMarkdown(report: BenchmarkReport): string {
  if (report.weakRelevanceExamples.length === 0) {
    return "- Weak relevance precedent warning recorded edilmedi.\n";
  }
  let md = "| Question | Decision | Court | Matched Terms | Missing Issue Terms | Why Weak | Suggested Query Terms |\n|---|---|---|---|---|---|---|\n";
  for (const example of report.weakRelevanceExamples) {
    md += `| \`${example.questionId}\` | \`${example.decisionId ?? "unknown"}\` | ${[example.court, example.chamber].filter(Boolean).join(" / ") || "unknown"} | ${example.matchedTerms.join(", ") || "none"} | ${example.missingExpectedIssueTerms.slice(0, 4).join(", ") || "none"} | ${(example.whyWeak ?? "weak issue overlap").replace(/\|/g, "/")} | ${example.suggestedQueryTerms.slice(0, 3).join(", ")} |\n`;
  }
  md += "\n### Weak Relevance By Question\n\n";
  md += Object.keys(report.weakRelevanceByQuestion).length === 0
    ? "- none\n"
    : Object.entries(report.weakRelevanceByQuestion).map(([id, count]) => `- \`${id}\`: ${count}`).join("\n") + "\n";
  md += "\n### Weak Relevance By Source\n\n";
  md += Object.keys(report.weakRelevanceBySource).length === 0
    ? "- none\n"
    : Object.entries(report.weakRelevanceBySource).map(([source, count]) => `- \`${source}\`: ${count}`).join("\n") + "\n";
  return md;
}
