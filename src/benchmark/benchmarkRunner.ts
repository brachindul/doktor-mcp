import { PhysicianLegalInformationService } from "../app/service.js";
import type { DoctorLegalInformationPack, PrecedentStatus } from "../contracts/legal.js";
import { auditPack } from "../packAudit.js";
import { doctorQuestions, FORBIDDEN_FIELDS_LIST, type BenchmarkQuestion } from "./doctorQuestions.js";
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
  notes: string;
}

export interface SourceUnavailableMetric {
  source: string;
  errorCode: string;
  message: string;
  retryable?: boolean;
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
      const pack = await service.prepareInformationPack({
        question: question.question,
        sourceMode
      });
      results.push(evaluateBenchmarkItem({
        question,
        pack,
        sourceMode,
        durationMs: Date.now() - itemStartedAt
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
}): BenchmarkItemResult {
  const { question, pack, sourceMode, durationMs } = input;
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
  const forbiddenFieldMatches = findForbiddenFields(pack);
  const safety = buildSafety(pack, sourceMode, selectedStatuses, forbiddenFieldMatches);
  const warnings = buildWarnings({
    sourceMode,
    question,
    legislationOrder,
    sourceUnavailable,
    precedentUnavailable,
    selectedPrecedentCount,
    auditWarnings: auditRes.warnings
  });
  const regressionFailures = buildRegressionFailures({
    sourceMode,
    question,
    pack,
    legislationOrder,
    kvkkIncluded,
    auditErrors: auditRes.errors,
    forbiddenFieldMatches,
    safety
  });
  const scores = scoreBenchmarkItem({
    question,
    pack,
    legislationOrder,
    auditErrors: auditRes.errors,
    auditWarnings: auditRes.warnings,
    sourceUnavailableCount: sourceUnavailable.length + precedentUnavailable.length,
    safety
  });
  const auditStatus: AuditStatus = auditRes.errors.length > 0 ? "error" : auditRes.warnings.length > 0 ? "warning" : "clean";

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
    audit: {
      ok: auditRes.ok,
      errors: auditRes.errors,
      warnings: auditRes.warnings
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
      noReasoningUsedAsPrecedent: selectedStatuses.includes("no_reasoning" as PrecedentStatus)
    },
    safety,
    scores,
    failureReasons: regressionFailures,
    warnings,
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
}): BenchmarkScores {
  const { question, pack, legislationOrder, auditErrors, auditWarnings, sourceUnavailableCount, safety } = input;
  const hasLegislation = pack.relevantLegislation.length > 0;
  const quoteAndTrace = pack.relevantLegislation.some((item) => Boolean(item.verbatimQuote?.trim()) && Boolean(item.sourceTrace));
  const expectedMatch = question.expectedPrimaryLegislationNames.some((name) =>
    legislationOrder.some((selected) => includesLegislationName(selected, name))
  );
  const unsafe = !safety.forbiddenFieldsAbsent || !safety.noUrgentAction || !safety.noRiskLevel ||
    !safety.noDefinitiveLegalOpinion || !safety.noPetitionDraft || !safety.noUnsafePrecedent ||
    !safety.noMockFallbackInLive || auditErrors.length > 0;
  const hasVerifiedPrecedent = pack.verifiedHighCourtPrecedents.length > 0;
  const hasSourceSuccess = hasLegislation || (pack.precedentDiagnostics?.sourceSummaries ?? []).some((summary) =>
    summary.unavailableCount === 0 && (summary.searchResultsCount ?? 0) > 0
  );

  const legislationMatchScore = !hasLegislation ? 0 : expectedMatch && quoteAndTrace ? 2 : 1;
  const priorityScore = !hasLegislation ? 0 : isClearlyWrongPriority(question, legislationOrder) ? 0 : isPriorityMatch(question, legislationOrder) ? 2 : 1;
  const precedentSafetyScore = !safety.noUnsafePrecedent ? 0 : hasVerifiedPrecedent ? 2 : 1;
  const sourceAvailabilityScore = !hasSourceSuccess ? 0 : sourceUnavailableCount > 0 ? 1 : 2;
  const auditScore = auditErrors.length > 0 ? 0 : auditWarnings.length > 0 ? 1 : 2;
  const forbiddenFieldsScore = safety.forbiddenFieldsAbsent ? 2 : 0;
  const totalScore = legislationMatchScore + priorityScore + precedentSafetyScore + sourceAvailabilityScore + auditScore + forbiddenFieldsScore;
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
      noReasoningUsedAsPrecedent: false
    },
    safety,
    scores,
    failureReasons: [`Pack generation failed: ${message}`],
    warnings: [],
    notes: input.question.notes
  };
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
    results: input.results
  };
}

function buildSafety(
  pack: DoctorLegalInformationPack & Record<string, unknown>,
  sourceMode: "live" | "mock",
  selectedStatuses: PrecedentStatus[],
  forbiddenFieldMatches: string[]
): BenchmarkItemResult["safety"] {
  const rootText = JSON.stringify(pack).toLocaleLowerCase("tr-TR");
  const unsafePrecedent = selectedStatuses.some((status) =>
    status === "metadata_only" || status === "procedural_only" || status === "no_reasoning"
  );
  const liveMockFallback = (pack.precedentDiagnostics?.sourceSummaries ?? []).some((summary) =>
    summary.source === "aym" && summary.mode === "mock"
  );

  return {
    forbiddenFieldsAbsent: forbiddenFieldMatches.length === 0,
    noUrgentAction: !rootText.includes("derhal yapilacak") && !rootText.includes("derhal yapılacak"),
    noRiskLevel: !("riskLevel" in pack) && !("riskSeviyesi" in pack),
    noDefinitiveLegalOpinion: !rootText.includes("kesin hukuki kanaat") && !("finalLegalOpinion" in pack),
    noPetitionDraft: !rootText.includes("dilekçe taslağı") && !rootText.includes("savunma taslağı") && !("dilekseTaslagi" in pack),
    noUnsafePrecedent: !unsafePrecedent,
    noMockFallbackInLive: sourceMode === "live" ? !liveMockFallback : true
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
  if (!input.safety.noMockFallbackInLive) failures.push("Live mode used mock AYM fallback.");
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

function buildWarnings(input: {
  sourceMode: "live" | "mock";
  question: BenchmarkQuestion;
  legislationOrder: string[];
  sourceUnavailable: SourceUnavailableMetric[];
  precedentUnavailable: SourceUnavailableMetric[];
  selectedPrecedentCount: number;
  auditWarnings: string[];
}): string[] {
  const warnings = [...input.auditWarnings];
  if (input.sourceUnavailable.length > 0) warnings.push(`Legislation source unavailable: ${input.sourceUnavailable.map((entry) => entry.errorCode).join(", ")}`);
  if (input.precedentUnavailable.length > 0) warnings.push(`Precedent source unavailable: ${input.precedentUnavailable.map((entry) => `${entry.source}:${entry.errorCode}`).join(", ")}`);
  if (input.legislationOrder.length === 0) warnings.push("No legislation selected.");
  if (!isPriorityMatch(input.question, input.legislationOrder)) warnings.push("Expected primary legislation is not in the leading positions.");
  if (input.selectedPrecedentCount === 0) warnings.push("No verified high court precedent selected.");
  if (input.sourceMode === "live") warnings.push("Live source quality is informational; transient source gaps are metrics, not automatic failures.");
  return [...new Set(warnings)];
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
- **Safety**: forbiddenFieldsAbsent=\`${result.safety.forbiddenFieldsAbsent}\`, noUnsafePrecedent=\`${result.safety.noUnsafePrecedent}\`, noMockFallbackInLive=\`${result.safety.noMockFallbackInLive}\`
- **Audit**: \`${result.auditStatus}\`
- **Warnings**: ${result.warnings.length > 0 ? result.warnings.join("; ") : "none"}
- **Failure Reasons**: ${result.failureReasons.length > 0 ? result.failureReasons.join("; ") : "none"}

`;
  }

  md += `## v0.17.1 Tuning Suggestions

- Use questions with \`needs_tuning\` bands to adjust deterministic health-law mappings.
- Treat source-unavailable rows as live reliability metrics, not automatic legal-quality defects.
- Inspect questions without verified precedents for better search query expansion before changing safety filters.
- Keep audit errors and unsafe precedent usage as hard regression failures.
`;

  return md;
}
