import type { BenchmarkItemResult, BenchmarkReport, VerifiedPrecedentAuditEntry, PackFailureKind } from "./benchmarkRunner.js";
import type { SourceSufficiencyLevel } from "../sourceSufficiency.js";
import { average, median, countBy } from "./scoring.js";
import { buildLiveReliabilityGate, type LiveReliabilityGate } from "../live/reliabilityGate.js";
import { healthLegislationHints } from "../sources/legislation/healthMappings.js";
import { buildInventoryReport, type HealthLegislationCategory, type HealthLegislationAccessStatus } from "../healthLegislationInventory.js";
import { buildGlobalQueryMetrics, buildSourceReliabilityMetrics, buildIssueProfileReliabilityMetrics } from "./reliabilityMetrics.js";

// Known gaps — legislation that would be valuable but whose mevzuat.gov.tr
// internal IDs are not yet confirmed (so they are not added to the registry).
// v0.28.0: gap entries now live in healthLegislationInventory.ts.
// This const is kept as a fallback reference for the markdown report label.
const KNOWN_UNCOVERED_LEGISLATION_KEYS = ["ozel-hastaneler-yonetmeligi", "ayakta-teshis-ozel-saglik", "saglik-meslek-is-gorev-tanimlari"] as const;

export function buildSufficiencyMetrics(results: BenchmarkItemResult[]): BenchmarkReport["sourceSufficiencyMetrics"] {
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

export function buildRouterMetrics(results: BenchmarkItemResult[]): BenchmarkReport["routerMetrics"] {
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

export function buildOfficialLegislationCoverage(results: BenchmarkItemResult[]): BenchmarkReport["officialLegislationCoverage"] {
  // ── v0.22.0 fields ─────────────────────────────────────────────────────────
  const registeredSourceIds = [...new Set(healthLegislationHints.map((h) => h.sourceId))];
  const coveredTitles = [...new Set(healthLegislationHints.map((h) => h.title))];
  const topicClustersRegistered = [...new Set(healthLegislationHints.map((h) => h.topicCluster))];

  let unofficialCount = 0;
  for (const result of results) {
    if (result.unofficialSourceDetected) unofficialCount++;
  }

  // ── v0.28.0 inventory ──────────────────────────────────────────────────────
  const inventory = buildInventoryReport();

  // Gap titles for the legacy coverageWarnings field
  const gapTitles = inventory.gapEntries.map((e) => e.titleNormalized);

  const coverageWarnings: string[] = [...inventory.coverageWarnings];
  if (unofficialCount > 0) {
    coverageWarnings.push(
      `${unofficialCount} soruda resmi olmayan mevzuat kaynağı tespit edildi (contract check: unofficialSourceDetected).`
    );
  }

  void KNOWN_UNCOVERED_LEGISLATION_KEYS; // retained for reference; inventory now owns gap list

  return {
    // ── v0.22.0 (preserved) ──
    coveredOfficialLegislationCount: registeredSourceIds.length,
    coveredLegislationTitles: coveredTitles,
    knownUncoveredLegislation: gapTitles,
    missingKnownHealthLegislationCount: inventory.gapCount,
    topicClustersRegistered,
    topicClusterCount: topicClustersRegistered.length,
    unofficialLegislationSourceCount: unofficialCount,
    coverageWarnings,
    // ── v0.28.0 inventory ──
    inventoryTotalCount: inventory.inventoryTotalCount,
    coreInventoryCount: inventory.coreInventoryCount,
    verifiedOfficialSourceCount: inventory.verifiedOfficialSourceCount,
    candidateOfficialSourceCount: inventory.candidateOfficialSourceCount,
    gapCount: inventory.gapCount,
    deferredCount: inventory.deferredCount,
    coveredByActiveHintsCount: inventory.coveredByActiveHintsCount,
    uncoveredCoreCount: inventory.uncoveredCoreCount,
    inventoryByCategory: inventory.inventoryByCategory,
    inventoryByAccessStatus: inventory.inventoryByAccessStatus
  };
}

export function buildTimeBudgetMetrics(results: BenchmarkItemResult[]): BenchmarkReport["timeBudgetMetrics"] {
  const withBudget = results.filter((r) => r.timeBudgetTelemetry != null);
  const questionsWithBudget = withBudget.length;
  const legPhases = withBudget.map((r) => r.timeBudgetTelemetry!.legislationPhaseMs);
  const precPhases = withBudget.map((r) => r.timeBudgetTelemetry!.precedentPhaseMs);
  const totals = withBudget.map((r) => r.timeBudgetTelemetry!.totalElapsedMs);
  const budgetExhaustedCount = withBudget.filter((r) => r.timeBudgetTelemetry!.budgetExhausted).length;
  const sourcePriorityDistribution: Record<string, number> = {};
  for (const r of withBudget) {
    const order = r.timeBudgetTelemetry!.sourcePriorityOrder.join(",");
    sourcePriorityDistribution[order] = (sourcePriorityDistribution[order] ?? 0) + 1;
  }
  // v0.40.0 legislation phase diagnostics
  const legislationPhaseTimeoutCount = withBudget.filter((r) => r.timeBudgetTelemetry!.legislationPhaseTimedOut).length;
  const legislationPhaseBudgetExhaustedCount = withBudget.filter((r) => r.timeBudgetTelemetry!.legislationPhaseBudgetExhausted).length;
  const knownHintFastPathCount = withBudget.filter((r) => r.timeBudgetTelemetry!.legislationKnownHintFastPathUsed).length;
  const coverageGapCount = withBudget.reduce((sum, r) => sum + (r.timeBudgetTelemetry!.legislationCoverageGaps?.length ?? 0), 0);
  const legislationPhaseFailedBeforePrecedentCount = withBudget.filter((r) => r.timeBudgetTelemetry!.legislationPhaseFailedBeforePrecedent).length;
  // packGeneratedAfterLegislationTimeoutCount: passed items where legislation timed out
  const packGeneratedAfterLegislationTimeoutCount = results.filter((r) =>
    r.timeBudgetTelemetry?.legislationPhaseTimedOut && r.passed
  ).length;
  return {
    questionsWithBudget,
    averageLegislationPhaseMs: average(legPhases),
    averagePrecedentPhaseMs: average(precPhases),
    averageTotalElapsedMs: average(totals),
    budgetExhaustedCount,
    sourcePriorityDistribution,
    legislationPhaseTimeoutCount,
    legislationPhaseBudgetExhaustedCount,
    knownHintFastPathCount,
    coverageGapCount,
    legislationPhaseFailedBeforePrecedentCount,
    packGeneratedAfterLegislationTimeoutCount
  };
}

export function buildLiveTimeoutMetrics(results: BenchmarkItemResult[]): BenchmarkReport["liveTimeoutMetrics"] {
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

export function buildLiveReliabilityGateFromResults(results: BenchmarkItemResult[], sourceMode: "live" | "mock"): LiveReliabilityGate {
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

  const quoteUnusableInVerifiedCount = results.reduce((sum, r) =>
    sum + r.precedents.verifiedPrecedentAudit.filter((e) => !e.quoteUsable).length, 0);

  const generatedPackContractFailCount = results.filter((r) => r.packGenerated && !r.contractPassed).length;
  const packGenerationFailed = results.filter((r) => !r.packGenerated);

  return buildLiveReliabilityGate({
    totalLiveQuestions: sourceMode === "live" ? results.length : liveResults.length,
    livePassedCount: results.filter((r) => r.passed).length,
    liveFailedCount: results.filter((r) => !r.passed).length,
    mockFallbackDetected: results.some((r) => r.usedMockSourceInLiveMode),
    contractFailedCount: generatedPackContractFailCount,
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
    sourceSufficiencyDistribution,
    quoteUnusableInVerifiedCount,
    generatedPackContractFailCount,
    packGenerationFailedCount: packGenerationFailed.length,
    timeoutNoPackCount: packGenerationFailed.filter((r) => r.packFailureKind === "pack_generation_failed_timeout").length,
    sourceUnavailableNoPackCount: packGenerationFailed.filter((r) => r.packFailureKind === "pack_generation_failed_source_unavailable").length,
    budgetExhaustedNoPackCount: packGenerationFailed.filter((r) => r.packFailureKind === "pack_generation_failed_budget_exhausted").length
  });
}

export function buildPackFailureMetrics(results: BenchmarkItemResult[]) {
  const distribution = countBy(results, (r) => r.packFailureKind);
  const timeoutNoPackCount = results.filter((r) => r.packFailureKind === "pack_generation_failed_timeout").length;
  const sourceUnavailableNoPackCount = results.filter((r) => r.packFailureKind === "pack_generation_failed_source_unavailable").length;
  const budgetExhaustedNoPackCount = results.filter((r) => r.packFailureKind === "pack_generation_failed_budget_exhausted").length;
  const generatedPackContractFailCount = results.filter((r) => r.packGenerated && !r.contractPassed).length;
  const generatedPackUnsafeCount = results.filter((r) => r.packGenerated && r.unsafeAdviceDetected).length;
  const generatedPackUnofficialCount = results.filter((r) => r.packGenerated && r.unofficialSourceDetected).length;
  const noPackDiagnosticCount = results.filter((r) => Boolean(r.noPackDiagnostic)).length;
  const noPackDiagnosticEnhancedCount = results.filter((r) => Boolean(r.noPackDiagnostic?.partialStateAvailable)).length;
  const partialPackGeneratedCount = results.filter((r) => r.partialPackGenerated).length;
  const partialStateAvailableCount = results.filter((r) => Boolean(r.noPackDiagnostic?.partialStateAvailable)).length;
  const generatedFromPartialStateCount = results.filter((r) => r.packGeneratedFromPartialState).length;
  const minimalPackRescueAttemptCount = results.filter((r) => Boolean(r.minimalPackRescueReason)).length;
  const minimalPackRescueSuccessCount = results.filter((r) => r.packGeneratedFromPartialState && r.contractPassed).length;
  const minimalPackRescueFailureCount = results.filter((r) => r.packGeneratedFromPartialState && !r.contractPassed).length;
  return {
    packGenerationFailureDistribution: distribution,
    timeoutNoPackCount,
    sourceUnavailableNoPackCount,
    budgetExhaustedNoPackCount,
    generatedPackContractFailCount,
    generatedPackUnsafeCount,
    generatedPackUnofficialCount,
    noPackDiagnosticCount,
    noPackDiagnosticEnhancedCount,
    partialPackGeneratedCount,
    partialStateAvailableCount,
    generatedFromPartialStateCount,
    minimalPackRescueAttemptCount,
    minimalPackRescueSuccessCount,
    minimalPackRescueFailureCount
  };
}

export function buildProvenanceMetricsFromResults(results: BenchmarkItemResult[]): BenchmarkReport["provenanceMetrics"] {
  const allEntries = results.flatMap((r) => r.precedents.verifiedPrecedentAudit);
  const contentStatusDistribution: Record<string, number> = {};
  const fetchStatusDistribution: Record<string, number> = {};
  const provenanceSourceDistribution: Record<string, number> = {};
  const perSourceFetchStatusDistribution: Record<string, Record<string, number>> = {};

  let quoteUsableCount = 0;
  let quoteUnusableCount = 0;
  let metadataOnlyDecisionCount = 0;
  let pdfLinkOnlyDecisionCount = 0;
  let unavailableDecisionCount = 0;
  let mergedDecisionCount = 0;

  for (const entry of allEntries) {
    const cs = entry.contentStatus ?? "unavailable";
    contentStatusDistribution[cs] = (contentStatusDistribution[cs] ?? 0) + 1;
    if (cs === "metadata_only") metadataOnlyDecisionCount++;
    if (cs === "pdf_link_only") pdfLinkOnlyDecisionCount++;
    if (cs === "unavailable") unavailableDecisionCount++;

    if (entry.quoteUsable) quoteUsableCount++;
    else quoteUnusableCount++;

    // Derive source from court field (best proxy available here)
    const src = entry.court ?? "unknown";
    provenanceSourceDistribution[src] = (provenanceSourceDistribution[src] ?? 0) + 1;

    // Derive fetchStatus proxy from contentStatus
    const fetchStatus = cs === "full_text" || cs === "html_markdown" ? "full_text_fetched" : "metadata_only";
    fetchStatusDistribution[fetchStatus] = (fetchStatusDistribution[fetchStatus] ?? 0) + 1;

    if (!perSourceFetchStatusDistribution[src]) perSourceFetchStatusDistribution[src] = {};
    perSourceFetchStatusDistribution[src][fetchStatus] = (perSourceFetchStatusDistribution[src][fetchStatus] ?? 0) + 1;

  }

  // mergedDecisionCount and duplicateDecisionCount are not derivable from audit entries
  // (audit entries don't carry provenance[]; those are on CourtDecision at adapter level).
  // They remain 0 here — the benchmark runner operates on pack output, not raw decisions.
  void mergedDecisionCount;

  return {
    totalDecisions: allEntries.length,
    uniqueDecisions: allEntries.length,
    duplicateDecisionCount: 0,
    mergedDecisionCount: 0,
    provenanceSourceDistribution,
    contentStatusDistribution,
    fetchStatusDistribution,
    quoteUsableCount,
    quoteUnusableCount,
    metadataOnlyDecisionCount,
    pdfLinkOnlyDecisionCount,
    unavailableDecisionCount,
    perSourceFetchStatusDistribution
  };
}

export function buildBenchmarkReport(input: {
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
  const liveReliabilityGate = buildLiveReliabilityGateFromResults(input.results, input.sourceMode);
  const packFailureMetrics = buildPackFailureMetrics(input.results);

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
    liveReliabilityGate,
    timeBudgetMetrics: buildTimeBudgetMetrics(input.results),
    provenanceMetrics: buildProvenanceMetricsFromResults(input.results),
    ...packFailureMetrics,
    liveReliabilityGateTimeoutObservationCount: liveReliabilityGate.gateObservations.filter((o) => o.includes("TIMEOUT")).length,
    results: input.results
  };
}

export function buildQueryAggregateMetrics(
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

export function generateMarkdownReport(report: BenchmarkReport): string {
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

## Official Health Legislation Inventory (v0.28.0)

- **Inventory Total**: ${report.officialLegislationCoverage.inventoryTotalCount}
- **Core**: ${report.officialLegislationCoverage.coreInventoryCount}
- **Verified (active)**: ${report.officialLegislationCoverage.verifiedOfficialSourceCount} | **Covered by Active Hints**: ${report.officialLegislationCoverage.coveredByActiveHintsCount}
- **Candidate**: ${report.officialLegislationCoverage.candidateOfficialSourceCount}
- **Gap**: ${report.officialLegislationCoverage.gapCount}
- **Deferred**: ${report.officialLegislationCoverage.deferredCount}
- **Uncovered Core**: ${report.officialLegislationCoverage.uncoveredCoreCount}
- **By Access Status**: ${Object.entries(report.officialLegislationCoverage.inventoryByAccessStatus).map(([k, v]) => `${k}: ${v}`).join(" | ")}
- **By Category**: ${Object.entries(report.officialLegislationCoverage.inventoryByCategory).map(([k, v]) => `${k}: ${v}`).join(", ")}
${report.officialLegislationCoverage.coverageWarnings.length > 0 ? "\n**Coverage Warnings:**\n" + report.officialLegislationCoverage.coverageWarnings.map((w) => `- ⚠️ ${w}`).join("\n") : ""}

## Cross-Source Provenance Metrics (v0.27.0)

- **Total Decisions Audited**: ${report.provenanceMetrics.totalDecisions}
- **Quote Usable**: ${report.provenanceMetrics.quoteUsableCount} | **Quote Unusable**: ${report.provenanceMetrics.quoteUnusableCount}
- **Metadata Only**: ${report.provenanceMetrics.metadataOnlyDecisionCount} | **PDF Link Only**: ${report.provenanceMetrics.pdfLinkOnlyDecisionCount} | **Unavailable**: ${report.provenanceMetrics.unavailableDecisionCount}
- **Content Status Distribution**: ${Object.entries(report.provenanceMetrics.contentStatusDistribution).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}
- **Fetch Status Distribution**: ${Object.entries(report.provenanceMetrics.fetchStatusDistribution).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}
- **Source Distribution**: ${Object.entries(report.provenanceMetrics.provenanceSourceDistribution).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}

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
