import type { DoctorLegalInformationPack, PrecedentStatus, ContentStatus } from "../contracts/legal.js";
import type { BenchmarkQuestion } from "./doctorQuestions.js";
import { FORBIDDEN_FIELDS_LIST } from "./doctorQuestions.js";
import type {
  SourceUnavailableMetric,
  VerifiedPrecedentAuditEntry,
  BenchmarkItemResult
} from "./benchmarkRunner.js";

// ── Safety ────────────────────────────────────────────────────────────────────

export function buildSafety(
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

// ── Regression Failures ───────────────────────────────────────────────────────

export function buildRegressionFailures(input: {
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

// ── Categorized Warnings ──────────────────────────────────────────────────────

export function buildCategorizedWarnings(input: {
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

// ── Pack Data Collectors ──────────────────────────────────────────────────────

export function collectTopicClusters(pack: DoctorLegalInformationPack): string[] {
  const clusters = new Set<string>();
  for (const item of pack.selectionDiagnostics?.selectedLegislations ?? []) {
    if (item.topicCluster) clusters.add(item.topicCluster);
  }
  for (const trace of pack.sourceTrace ?? []) {
    if (trace.matchedHealthMapping?.topicCluster) clusters.add(trace.matchedHealthMapping.topicCluster);
  }
  return [...clusters];
}

export function findHhyRole(pack: DoctorLegalInformationPack, legislationOrder: string[], question: BenchmarkQuestion): string | null {
  const hhyItem = pack.selectionDiagnostics?.selectedLegislations.find((item) => includesLegislationName(item.legislationName, "Hasta Haklari Yonetmeligi"));
  if (hhyItem) return hhyItem.legislationRole;
  if (!legislationOrder.some((name) => includesLegislationName(name, "Hasta Haklari Yonetmeligi"))) return null;
  return question.expectedPrimaryLegislationRoles["Hasta Haklari Yonetmeligi"] ?? "health_primary";
}

export function collectLegislationUnavailable(pack: DoctorLegalInformationPack): SourceUnavailableMetric[] {
  return (pack.sourceUnavailable ?? []).map((entry) => ({
    source: entry.source,
    errorCode: entry.errorCode,
    message: entry.message,
    retryable: entry.retryable
  }));
}

export function collectPrecedentUnavailable(pack: DoctorLegalInformationPack): SourceUnavailableMetric[] {
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

export function countExclusionReasons(pack: DoctorLegalInformationPack): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const excluded of pack.precedentDiagnostics?.excludedDecisions ?? []) {
    for (const reason of excluded.exclusionReasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return counts;
}

// ── Verified Precedent Audit ──────────────────────────────────────────────────

export function buildVerifiedPrecedentAudit(
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

    const contentStatus: ContentStatus | null = fullTextAvailable && reasoningDetected
      ? "full_text"
      : fullTextAvailable
        ? "html_markdown"
        : entry.fullTextAvailable === false
          ? "metadata_only"
          : null;
    const quoteUsable = status === "precedent_usable";
    const adapterNativeContentStatus = sourceMode === "live";

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
      adapterNativeContentStatus,
      errors,
      warnings
    };
  });
}

export function detectMockFallback(
  pack: DoctorLegalInformationPack,
  sourceMode: "live" | "mock",
  verifiedPrecedentAudit: VerifiedPrecedentAuditEntry[]
): boolean {
  if (sourceMode !== "live") return false;
  return (pack.precedentDiagnostics?.sourceSummaries ?? []).some((summary) => summary.mode === "mock") ||
    verifiedPrecedentAudit.some((entry) => isMockAccessSource(entry.accessSource)) ||
    (pack.sourceTrace ?? []).some((trace) => trace.extractionMethod === "mock");
}

// ── String / Name Utilities ───────────────────────────────────────────────────

export function isMockAccessSource(value: string | null | undefined): boolean {
  return Boolean(value && /mock/i.test(value));
}

export function inferCourt(courtAndChamber: string): string | null {
  const first = courtAndChamber.split("/")[0]?.trim();
  return first || null;
}

export function inferChamber(courtAndChamber: string): string | null {
  const parts = courtAndChamber.split("/");
  return parts.length > 1 ? parts.slice(1).join("/").trim() || null : null;
}

export function extractMeritsAndDecision(value: string): { esasNo: string | null; kararNo: string | null } {
  const [esasNo, kararNo] = value.split(/\s+-\s+|\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  return { esasNo: esasNo ?? null, kararNo: kararNo ?? null };
}

export function findForbiddenFields(pack: Record<string, unknown>): string[] {
  const rootKeys = Object.keys(pack);
  return FORBIDDEN_FIELDS_LIST.filter((forbidden) =>
    rootKeys.some((key) => key.toLocaleLowerCase("tr-TR") === forbidden.toLocaleLowerCase("tr-TR"))
  );
}

// ── Priority Matching ─────────────────────────────────────────────────────────

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
