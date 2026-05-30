/**
 * src/sourceSufficiency.ts
 *
 * v0.24.0 — Source Sufficiency Gate
 *
 * Evaluates whether a retrieved source set is adequate to safely compose a
 * research-grade doktor legal information pack.
 *
 * This module is a *diagnostic / benchmark* layer.
 * It does NOT modify DoctorLegalInformationPack output format.
 * It does NOT generate legal opinions, risk levels, or action instructions.
 * It does NOT produce petition/defence drafts.
 */

import type { MedicalIssueId } from "./medicalIssueRouter.js";

// ─── Public Types ──────────────────────────────────────────────────────────────

export type SourceSufficiencyLevel = "sufficient" | "partial" | "insufficient";

export type MissingAuthorityType =
  | "legislation"
  | "highCourtPrecedent"
  | "fullTextReasoning"
  | "issueSpecificMatch"
  | "officialSourceTrace"
  | "verifiedPrecedentEligibility"
  | "retrievalTimeout"
  | "timeBudgetExhausted"
  | "sourceBudgetExhausted"
  | "legislationPhaseBudgetExhausted"
  | "legislationCoverageGap";

export interface SourceSufficiencyResult {
  level: SourceSufficiencyLevel;
  missingAuthorityTypes: MissingAuthorityType[];
  reasons: string[];
  issueIds: MedicalIssueId[];
  legislationCount: number;
  verifiedPrecedentCount: number;
  issueSpecificLegislationCount: number;
  issueSpecificPrecedentCount: number;
  hasFullTextReasoning: boolean;
  hasOfficialSourceTrace: boolean;
  canComposeResearchPack: boolean;
  warnings: string[];
}

// ─── Input Shape ───────────────────────────────────────────────────────────────

export interface SourceSufficiencyInput {
  /** Issue IDs from the router (v0.23.0). */
  routedIssueIds: MedicalIssueId[];
  primaryIssueId: MedicalIssueId | null;

  /** relevantLegislation items from the pack (raw, untyped for resilience). */
  relevantLegislation: Array<Record<string, unknown>>;

  /** verifiedHighCourtPrecedents items from the pack (raw). */
  verifiedPrecedents: Array<Record<string, unknown>>;

  /** Whether the pack contract check passed (v0.21.0). */
  contractPassed: boolean;

  /** Whether an unofficial source was detected (contract check result). */
  unofficialSourceDetected: boolean;

  /** Whether mock fallback was used in live mode. */
  usedMockSourceInLiveMode: boolean;

  /** Source mode for the benchmark run. */
  sourceMode: "live" | "mock";

  /** Audit ok flag (from AuditResult). */
  auditOk: boolean;

  // v0.39.0 time budget telemetry
  timeBudgetExhausted?: boolean;
  retrievalTimeout?: boolean;
  sourceBudgetExhausted?: boolean;

  // v0.40.0 legislation phase diagnostics
  legislationPhaseBudgetExhausted?: boolean;
  legislationPhaseTimedOut?: boolean;
  legislationCoverageGaps?: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

/**
 * A legislation item has an official source trace if it carries a sourceTrace
 * object with at least one gov.tr URL OR a non-null sourceTrace object at all.
 * (The contract check enforces gov.tr; here we just check presence.)
 */
function legislationHasSourceTrace(item: Record<string, unknown>): boolean {
  const trace = item.sourceTrace;
  if (!trace || typeof trace !== "object") return false;
  const t = trace as Record<string, unknown>;
  return (
    typeof t.landingUrl === "string" ||
    typeof t.fullTextUrl === "string" ||
    typeof t.generatedPdfUrl === "string" ||
    typeof t.directPdfUrl === "string" ||
    typeof t.detailUrl === "string"
  );
}

/**
 * A legislation item has a verbatim quote (non-empty verbatimQuote field).
 */
function legislationHasQuote(item: Record<string, unknown>): boolean {
  return str(item.verbatimQuote).trim().length > 0;
}

/**
 * A legislation item has an article number (non-empty articleNumber).
 */
function legislationHasArticleNumber(item: Record<string, unknown>): boolean {
  return str(item.articleNumber).trim().length > 0;
}

/**
 * A precedent has full-text reasoning if:
 *   - fullTextAvailable === true AND reasoningDetected === true
 *   - OR eligibilityStatus === "precedent_usable"
 */
function precedentHasFullTextReasoning(entry: Record<string, unknown>): boolean {
  if (str(entry.eligibilityStatus) === "precedent_usable") return true;
  return bool(entry.fullTextAvailable) && bool(entry.reasoningDetected);
}

/**
 * Checks whether an issue ID is "unclear_or_mixed".
 */
function isUnclearOrMixed(id: MedicalIssueId | null): boolean {
  return id === "unclear_or_mixed";
}

/**
 * Very lightweight issue-to-legislation matching:
 * Checks if a legislation item's name contains any term suggestive of the issue.
 * This is intentionally coarse — a more precise match would need actual
 * topic cluster linking (which is done in live mode via healthMappings).
 * For the benchmark (mock mode), we use a simple keyword approach.
 */
const ISSUE_LEGISLATION_KEYWORDS: Record<string, string[]> = {
  informed_consent: ["hasta haklar", "deontoloji", "tababet"],
  medical_records:  ["hasta haklar", "deontoloji"],
  privacy_kvkk:     ["kvkk", "kisisel veri", "kişisel veri", "hasta haklar"],
  emergency_care:   ["hasta haklar", "tababet", "deontoloji", "saglik hizm", "sağlık hizm"],
  referral_consultation: ["hasta haklar", "deontoloji"],
  malpractice_complication: ["tababet", "deontoloji", "saglik hizm", "sağlık hizm"],
  disciplinary_admin: ["tababet", "saglik hizm", "sağlık hizm"],
  patient_rights:   ["hasta haklar"],
  criminal_liability: ["tababet"],
  civil_compensation: ["tababet", "saglik hizm", "sağlık hizm"],
  private_health_facility: ["saglik hizm", "sağlık hizm", "tababet"],
  professional_scope_of_practice: ["tababet"],
  workplace_employee_health: ["tababet", "saglik hizm", "sağlık hizm"],
  prescription_report: ["tababet", "deontoloji"],
  death_postmortem: ["tababet", "deontoloji"],
  unclear_or_mixed: []
};

function countIssueSpecificLegislation(
  legislation: Array<Record<string, unknown>>,
  issueIds: MedicalIssueId[]
): number {
  return legislation.filter((item) => {
    const name = str(item.legislationName).toLocaleLowerCase("tr-TR");
    return issueIds.some((id) => {
      const keywords = ISSUE_LEGISLATION_KEYWORDS[id] ?? [];
      return keywords.some((kw) => name.includes(kw));
    });
  }).length;
}

/**
 * Issue-specific precedent match: check if precedent topicTags or issueProfile
 * overlaps with a routed issue ID.
 */
const ISSUE_PRECEDENT_KEYWORDS: Record<string, string[]> = {
  informed_consent:              ["onam", "riza", "rıza", "aydinlat", "bilgilendirme"],
  medical_records:               ["epikriz", "kayit", "dosya"],
  privacy_kvkk:                  ["mahremiyet", "veri", "kvkk", "sir", "sır"],
  emergency_care:                ["acil", "hayati", "mudahale"],
  referral_consultation:         ["sevk", "konsultasyon"],
  malpractice_complication:      ["malpraktis", "komplikasyon", "kusur", "hata", "ozen"],
  disciplinary_admin:            ["disiplin", "idari", "sorusturma"],
  patient_rights:                ["hasta haklar", "sikayet"],
  criminal_liability:            ["taksir", "ceza", "suc"],
  civil_compensation:            ["tazminat", "zarar"],
  private_health_facility:       ["ozel hastane", "ozel saglik"],
  professional_scope_of_practice:["uzmanlik", "brans"],
  workplace_employee_health:     ["isyeri", "is kazasi"],
  prescription_report:           ["recete", "rapor", "istirahat"],
  death_postmortem:              ["olum", "defin", "adli"],
  unclear_or_mixed:              []
};

function countIssueSpecificPrecedents(
  precedents: Array<Record<string, unknown>>,
  issueIds: MedicalIssueId[]
): number {
  return precedents.filter((entry) => {
    const profile = str(entry.issueProfile).toLocaleLowerCase("tr-TR");
    const tags = (Array.isArray(entry.matchedHealthLawTerms) ? entry.matchedHealthLawTerms : [])
      .map((t: unknown) => str(t).toLocaleLowerCase("tr-TR"))
      .join(" ");
    const combined = `${profile} ${tags}`;
    return issueIds.some((id) => {
      const keywords = ISSUE_PRECEDENT_KEYWORDS[id] ?? [];
      return keywords.some((kw) => combined.includes(kw));
    });
  }).length;
}

// ─── Main Evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluate whether the retrieved source set is sufficient to compose a
 * doktor legal research pack for the given question.
 *
 * Returns a `SourceSufficiencyResult` with a `level` of:
 *   - "sufficient"   — all key criteria met
 *   - "partial"      — some criteria met; pack composable but note limitations
 *   - "insufficient" — critical authority missing; pack not safely composable
 */
export function evaluateSourceSufficiency(
  input: SourceSufficiencyInput
): SourceSufficiencyResult {
  const {
    routedIssueIds,
    primaryIssueId,
    relevantLegislation,
    verifiedPrecedents,
    contractPassed,
    unofficialSourceDetected,
    usedMockSourceInLiveMode,
    auditOk,
    timeBudgetExhausted,
    retrievalTimeout,
    sourceBudgetExhausted,
    legislationPhaseBudgetExhausted,
    legislationPhaseTimedOut,
    legislationCoverageGaps
  } = input;

  const missing: MissingAuthorityType[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (retrievalTimeout) {
    missing.push("retrievalTimeout");
    reasons.push("Canlı kaynaktan veri çekilirken zaman aşımı (retrieval timeout) oluştu.");
  }
  if (timeBudgetExhausted) {
    missing.push("timeBudgetExhausted");
    reasons.push("Zaman bütçesi tükendiği için (time budget exhausted) tarama durduruldu.");
  }
  if (sourceBudgetExhausted) {
    missing.push("sourceBudgetExhausted");
    reasons.push("Kaynak bazlı zaman sınırı aşıldı (source budget exhausted).");
  }

  // v0.40.0: Legislation phase diagnostics
  if (legislationPhaseBudgetExhausted) {
    missing.push("legislationPhaseBudgetExhausted");
    reasons.push("Mevzuat fazı zaman sınırı aşıldı (legislation phase budget exhausted).");
  }
  if (legislationPhaseTimedOut) {
    if (!missing.includes("retrievalTimeout")) {
      missing.push("retrievalTimeout");
    }
    reasons.push("Mevzuat retrieval zaman aşımına uğradı (legislation phase timed out).");
  }
  if (legislationCoverageGaps && legislationCoverageGaps.length > 0) {
    missing.push("legislationCoverageGap");
    for (const gap of legislationCoverageGaps) {
      reasons.push(`Resmi mevzuat kapsam boşluğu: ${gap} (coverage gap).`);
    }
  }

  // ── 1. Legislation ──────────────────────────────────────────────────────────

  const legislationCount = relevantLegislation.length;
  const hasLegislation = legislationCount > 0;

  if (!hasLegislation) {
    missing.push("legislation");
    reasons.push("Resmi mevzuat bulunamadı; kaynak seti mevzuat dayanağından yoksun.");
  }

  // ── 2. Legislation completeness (quote + article number + sourceTrace) ──────

  const hasQuote = hasLegislation && relevantLegislation.some(legislationHasQuote);
  const hasArticleNumber = hasLegislation && relevantLegislation.some(legislationHasArticleNumber);
  const hasLegislationSourceTrace = hasLegislation && relevantLegislation.some(legislationHasSourceTrace);
  const hasOfficialSourceTrace = hasLegislationSourceTrace; // legislation is the primary trace source

  if (hasLegislation && (!hasQuote || !hasArticleNumber)) {
    reasons.push("En az bir mevzuat kalemi madde numarası veya birebir alıntı içermiyor.");
  }

  if (hasLegislation && !hasLegislationSourceTrace) {
    missing.push("officialSourceTrace");
    reasons.push("Mevzuat kalemleri için resmi sourceTrace (mevzuat.gov.tr bağlantısı) bulunamadı.");
  }

  // ── 3. Verified precedents ──────────────────────────────────────────────────

  const verifiedPrecedentCount = verifiedPrecedents.length;
  const hasVerifiedPrecedent = verifiedPrecedentCount > 0;

  if (!hasVerifiedPrecedent) {
    missing.push("highCourtPrecedent");
    reasons.push("Doğrulanmış yüksek mahkeme emsal kararı bulunamadı.");
  }

  // ── 4. Full-text reasoning ──────────────────────────────────────────────────

  const hasFullTextReasoning =
    hasVerifiedPrecedent && verifiedPrecedents.some(precedentHasFullTextReasoning);

  if (hasVerifiedPrecedent && !hasFullTextReasoning) {
    missing.push("fullTextReasoning");
    reasons.push(
      "Mevcut emsal kararlar tam metin gerekçe içermiyor (metadata-only veya procedural-only olabilir)."
    );
  }

  // ── 5. Verified precedent eligibility (no metadata-only / procedural-only) ──

  const allPrecedentsIneligible =
    hasVerifiedPrecedent &&
    verifiedPrecedents.every((entry) => {
      const status = str(entry.eligibilityStatus);
      return status === "metadata_only" || status === "procedural_only" || status === "no_reasoning";
    });

  if (allPrecedentsIneligible) {
    missing.push("verifiedPrecedentEligibility");
    reasons.push(
      "Tüm emsal kararlar metadata-only, procedural-only veya gerekçesiz; araştırma paketi için yeterli değil."
    );
  }

  // ── 6. Issue-specific match ─────────────────────────────────────────────────

  const issueSpecificLegislationCount = countIssueSpecificLegislation(
    relevantLegislation,
    routedIssueIds
  );
  const issueSpecificPrecedentCount = countIssueSpecificPrecedents(
    verifiedPrecedents,
    routedIssueIds
  );

  const hasIssueSpecificLegislation = issueSpecificLegislationCount > 0;

  const issueMismatch =
    hasLegislation && !hasIssueSpecificLegislation && !isUnclearOrMixed(primaryIssueId);

  if (issueMismatch) {
    missing.push("issueSpecificMatch");
    reasons.push(
      `Mevcut mevzuat kaynaklarının routed issue(lar) (${routedIssueIds.join(", ")}) ile tematik örtüşmesi zayıf.`
    );
  }

  // ── 6b. Coverage Gap Visibility for Unverified Core Regulations ────────────
  const hasOzelHastaneler = relevantLegislation.some((item) =>
    str(item.legislationName).toLowerCase().includes("özel hastaneler") ||
    str(item.legislationName).toLowerCase().includes("ozel hastaneler")
  );
  if (!hasOzelHastaneler && routedIssueIds.includes("private_health_facility")) {
    reasons.push("Özel Hastaneler Yönetmeliği doğrulanmış resmi mevzuat veri setinde aktif kapsamda değil (coverage gap).");
  }

  const hasAyaktaTeshis = relevantLegislation.some((item) =>
    str(item.legislationName).toLowerCase().includes("ayakta teşhis") ||
    str(item.legislationName).toLowerCase().includes("ayakta teshis")
  );
  if (!hasAyaktaTeshis && routedIssueIds.includes("private_health_facility")) {
    reasons.push("Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Yönetmeliği doğrulanmış resmi mevzuat veri setinde aktif kapsamda değil (coverage gap).");
  }

  const hasKisiselSaglikVerileri = relevantLegislation.some((item) =>
    str(item.legislationName).toLowerCase().includes("kişisel sağlık verileri") ||
    str(item.legislationName).toLowerCase().includes("kisisel saglik verileri")
  );
  if (!hasKisiselSaglikVerileri && (routedIssueIds.includes("privacy_kvkk") || routedIssueIds.includes("medical_records"))) {
    reasons.push("Kişisel Sağlık Verileri Hakkında Yönetmelik doğrulanmış resmi mevzuat veri setinde aktif kapsamda değil (coverage gap).");
  }

  const hasAcilSaglik = relevantLegislation.some((item) =>
    str(item.legislationName).toLowerCase().includes("acil sağlık") ||
    str(item.legislationName).toLowerCase().includes("acil saglik")
  );
  if (!hasAcilSaglik && routedIssueIds.includes("emergency_care")) {
    reasons.push("Acil Sağlık Hizmetleri Yönetmeliği doğrulanmış resmi mevzuat veri setinde aktif kapsamda değil (coverage gap).");
  }

  const hasCoverageGap =
    (!hasOzelHastaneler && routedIssueIds.includes("private_health_facility")) ||
    (!hasAyaktaTeshis && routedIssueIds.includes("private_health_facility")) ||
    (!hasKisiselSaglikVerileri && (routedIssueIds.includes("privacy_kvkk") || routedIssueIds.includes("medical_records"))) ||
    (!hasAcilSaglik && routedIssueIds.includes("emergency_care"));

  // ── 7. Unofficial / mock source ─────────────────────────────────────────────

  if (unofficialSourceDetected) {
    // Already captured by contractPassed, but make it explicit in sufficiency
    reasons.push("Resmi olmayan kaynak (gov.tr dışı URL) tespit edildi; kaynak güvenilirliği bozulmuş.");
    if (!missing.includes("officialSourceTrace")) {
      missing.push("officialSourceTrace");
    }
  }

  if (usedMockSourceInLiveMode) {
    reasons.push("Live modda mock kaynak kullanıldı; kaynak yeterliliği değerlendirilemez.");
    if (!missing.includes("officialSourceTrace")) {
      missing.push("officialSourceTrace");
    }
  }

  // ── 8. Contract pass ────────────────────────────────────────────────────────

  if (!contractPassed) {
    reasons.push("Pack contract check geçemedi; zorunlu alan(lar) eksik veya hatalı.");
  }

  if (!auditOk) {
    warnings.push("Pack audit hatası mevcut; detaylar için audit.errors alanına bakılmalı.");
  }

  // ── 9. Unclear or mixed issue ───────────────────────────────────────────────

  if (isUnclearOrMixed(primaryIssueId) && !hasLegislation) {
    reasons.push("Soru belirsiz (unclear_or_mixed) ve mevzuat kaynağı da yok; yeterlilik değerlendirilemez.");
  }

  // ── 10. Sufficiency level decision ─────────────────────────────────────────

  const hasHardBlocker =
    !hasLegislation ||
    unofficialSourceDetected ||
    usedMockSourceInLiveMode ||
    (hasVerifiedPrecedent && allPrecedentsIneligible);

  // "sufficient": all of the following hold
  const isSufficient =
    hasLegislation &&
    hasQuote &&
    hasArticleNumber &&
    hasOfficialSourceTrace &&
    hasVerifiedPrecedent &&
    hasFullTextReasoning &&
    !allPrecedentsIneligible &&
    !unofficialSourceDetected &&
    !usedMockSourceInLiveMode &&
    contractPassed &&
    !isUnclearOrMixed(primaryIssueId) &&
    !hasCoverageGap;

  let level: SourceSufficiencyLevel;
  if (hasHardBlocker) {
    level = "insufficient";
  } else if (isSufficient && missing.length === 0) {
    level = "sufficient";
  } else {
    level = "partial";
  }

  // canComposeResearchPack: true when at least legislation is present and no hard blocker
  const canComposeResearchPack = hasLegislation && !hasHardBlocker;

  // Populate warnings for partial cases
  if (level === "partial") {
    if (!hasVerifiedPrecedent) {
      warnings.push("Doğrulanmış yüksek mahkeme kararı yok; araştırma paketi yalnızca mevzuata dayalı.");
    }
    if (hasVerifiedPrecedent && !hasFullTextReasoning) {
      warnings.push("Emsal karar(lar) tam metin gerekçe içermiyor; alıntı kalitesi sınırlı olabilir.");
    }
    if (issueMismatch) {
      warnings.push("Mevzuat ve/veya emsal kaynakların issue-specific örtüşmesi zayıf; farklı soru için retrieve edilmiş olabilir.");
    }
    if (!contractPassed) {
      warnings.push("Contract check geçemedi; çıktı kalitesi sınırlı.");
    }
  }

  return {
    level,
    missingAuthorityTypes: [...new Set(missing)],
    reasons,
    issueIds: routedIssueIds,
    legislationCount,
    verifiedPrecedentCount,
    issueSpecificLegislationCount,
    issueSpecificPrecedentCount,
    hasFullTextReasoning,
    hasOfficialSourceTrace,
    canComposeResearchPack,
    warnings
  };
}
