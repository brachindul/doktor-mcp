import type { BenchmarkQuestion } from "./doctorQuestions.js";
import type { BenchmarkScores, QualityBand, BenchmarkItemResult, VerifiedPrecedentAuditEntry } from "./benchmarkRunner.js";
import type { DoctorLegalInformationPack } from "../contracts/legal.js";

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

  // ── New multi-dimensional quality scores (T23.2) ──
  const lawCount = legislationOrder.filter((n) => /\bkanun\b/i.test(n)).length;
  const regulationCount = legislationOrder.filter((n) => /y[oö]netmeli([kğ]i|k)|yonetmeli(gi|k)|nizamname/i.test(n)).length;
  const lawRegulationBalanceScore = lawCount > 0 && regulationCount > 0 ? 1 : 0;

  const classification = pack.legalClassification;
  const populatedAxes = [
    classification.criminal,
    classification.civilCompensation,
    classification.disciplinaryAdministrative,
    classification.patientRights,
    classification.privacyKvkk,
    classification.professionalEthics
  ].filter((v) => v && v.length > 0).length;
  const axisCoverageScore = populatedAxes >= 3 ? 2 : populatedAxes >= 1 ? 1 : 0;

  const avgRelevance = verifiedPrecedentAudit.length > 0
    ? average(verifiedPrecedentAudit.map((e) => e.healthLawRelevanceScore ?? 0)) ?? 0
    : hasVerifiedPrecedent ? 1 : 0;
  const precedentRelevanceScore = avgRelevance >= 2 ? 2 : avgRelevance >= 1 ? 1 : 0;

  const totalScore = legislationMatchScore + priorityScore + precedentSafetyScore + sourceAvailabilityScore + auditScore + forbiddenFieldsScore - relevancePenalty + lawRegulationBalanceScore + axisCoverageScore + precedentRelevanceScore;
  const maxScore = 15;
  const scorePercent = Math.round((totalScore / maxScore) * 100);

  return {
    legislationMatchScore,
    priorityScore,
    precedentSafetyScore,
    sourceAvailabilityScore,
    auditScore,
    forbiddenFieldsScore,
    lawRegulationBalanceScore,
    axisCoverageScore,
    precedentRelevanceScore,
    totalScore,
    maxScore,
    scorePercent,
    qualityBand: unsafe ? "unsafe" : scorePercent >= 80 ? "good" : scorePercent >= 60 ? "acceptable" : "needs_tuning"
  };
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function countBy<T>(values: T[], keyFn: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function isPriorityMatch(question: BenchmarkQuestion, legislationOrder: string[]): boolean {
  if (legislationOrder.length === 0) return false;
  const leading = legislationOrder.slice(0, 2);
  return question.expectedPrimaryLegislationNames.some((expected) =>
    leading.some((name) => includesLegislationName(name, expected))
  );
}

export function isClearlyWrongPriority(question: BenchmarkQuestion, legislationOrder: string[]): boolean {
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

export function isMockRegressionWrongPriority(question: BenchmarkQuestion, legislationOrder: string[]): boolean {
  const first = legislationOrder[0];
  return Boolean(first) &&
    (question.id === "refusal-noncompliance" || question.id === "private-hospital-fees") &&
    includesLegislationName(first, "Hasta Haklari Yonetmeligi");
}

export function includesLegislationName(actual: string, expected: string): boolean {
  return normalizeName(actual).includes(normalizeName(expected)) || normalizeName(expected).includes(normalizeName(actual));
}

export function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
