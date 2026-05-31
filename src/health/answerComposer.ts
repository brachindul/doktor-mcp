import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  DoctorLegalInformationPack,
  LegalClassificationSection,
  LegislationProvision,
  LegislationSelectionDiagnostics,
  PrecedentSelectionDiagnostics,
  PreliminaryAssessment,
  AssessmentSentence,
  SourceUnavailable
} from "../contracts/legal.js";
import { assessPrecedentRelevance } from "./precedentRelevance.js";
import type { PrecedentRelevanceAssessment } from "./precedentRelevance.js";
import { deduplicateDecisions } from "./decisionDedup.js";
import { stripHtmlToText, truncateForDisplay } from "../util/textSanitizer.js";
import { readConfig } from "../core/runtimeConfig.js";

/** Controls whether the pack includes a source-grounded preliminary assessment. */
export type AssessmentTone = "strict" | "grounded-advisory";

const dimensionLabels = {
  criminal: "Ceza hukuku boyutu resmi kaynak eşleştirmesi bekliyor.",
  civil_compensation: "Tazminat ve özel hukuk boyutu olay kayıtlarıyla birlikte incelenebilir.",
  disciplinary_administrative: "Disiplin veya idari soruşturma boyutu ayrı kaynak taraması gerektirebilir.",
  patient_rights: "Hasta hakları boyutu soru ile eşleştirildi.",
  privacy_kvkk: "Sağlık verisi ve mahremiyet boyutu soru ile eşleştirildi.",
  professional_ethics: "Meslek etiği boyutu soru ile eşleştirildi."
} as const;

function classificationSection(classification: ClassifiedMedicalLegalQuestion): LegalClassificationSection {
  const has = (dimension: keyof typeof dimensionLabels) =>
    classification.dimensions.includes(dimension) ? [dimensionLabels[dimension]] : [];

  return {
    criminal: has("criminal"),
    civilCompensation: has("civil_compensation"),
    disciplinaryAdministrative: has("disciplinary_administrative"),
    patientRights: has("patient_rights"),
    privacyKvkk: has("privacy_kvkk"),
    professionalEthics: has("professional_ethics")
  };
}

/**
 * Build a short human-readable explanation of why this precedent was selected.
 * Shows matched issue terms and a brief reason.
 */
function buildRelevanceExplanation(relevance: PrecedentRelevanceAssessment): string {
  const matchedTerms = relevance.matchedIssueSignals;
  const profile = relevance.issueProfile;
  const score = relevance.score;

  if (score === 0) {
    return `Düşük skor (${score}): ${profile} issue sinyalleri eşleşmedi.`;
  }

  const termList = matchedTerms.length > 0
    ? `"${matchedTerms.slice(0, 3).join("\", \"")}" terimleri eşleşti.`
    : "Genel sağlık terimleri eşleşti.";

  if (score >= 2) {
    return `Yüksek skor (${score}): ${termList} Bu karar ${profile} bağlamında ilgili.`;
  }

  return `Orta skor (${score}): ${termList} ${profile} bağlamında kısmen ilgili.`;
}

function formatPrecedent(decision: CourtDecision, classification: ClassifiedMedicalLegalQuestion) {
  const trace = decision.decisionSourceTrace;
  const accessSource = inferAccessSource(decision);
  const reasoningDetected = Boolean(decision.legalReasoning?.trim());
  const relevance = assessPrecedentRelevance(classification, decision);

  // Build relevance explanation
  const relevanceExplanation = buildRelevanceExplanation(relevance);

  return {
    courtAndChamber: [decision.court.toLocaleUpperCase("tr-TR"), decision.chamber].filter(Boolean).join(" / "),
    court: decision.court,
    chamber: decision.chamber,
    date: decision.decisionDate ?? "Kaynakta tarih yok",
    decisionDate: decision.decisionDate,
    meritsAndDecisionNumber: [decision.meritsNumber, decision.decisionNumber].filter(Boolean).join(" - "),
    meritsNumber: decision.meritsNumber,
    decisionNumber: decision.decisionNumber,
    factSummary: stripHtmlToText(decision.factSummary ?? "Kaynakta olay ozeti yok"),
    legalAssessment: stripHtmlToText(decision.legalReasoning ?? "Kaynakta hukuki degerlendirme yok"),
    outcome: stripHtmlToText(decision.outcome ?? "Kaynakta sonuc yok"),
    similarityDifference: stripHtmlToText(decision.relevanceNote ?? "Benzerlik teyit edilmedi"),
    sourceDocumentId: decision.evidence.documentId,
    sourceId: decision.evidence.sourceId,
    sourceUrl: decision.evidence.sourceUrl,
    accessSource,
    fullTextAvailable: trace?.fullTextAvailable ?? decision.evidence.fullText,
    reasoningDetected,
    eligibilityStatus: trace?.eligibilityStatus,
    eligibilityReasons: trace?.eligibilityReasons,
    exclusionReasons: trace?.exclusionReasons,
    healthLawRelevanceScore: relevance.score,
    matchedQueryTerms: trace?.query ? [trace.query] : [],
    matchedHealthLawTerms: relevance.matchedIssueSignals,
    issueProfile: relevance.issueProfile,
    missingExpectedIssueTerms: relevance.missingExpectedIssueTerms,
    weakRelevanceReason: relevance.whyWeak,
    suggestedQueryTerms: relevance.suggestedQueryTerms,
    relevanceExplanation,
    selectedAsVerifiedReason: trace?.eligibilityReasons?.at(-1) ?? "Filtered as precedent_usable.",
    ...(trace ? { decisionSourceTrace: trace } : {})
  };
}

function inferAccessSource(decision: CourtDecision): string {
  const url = decision.decisionSourceTrace?.searchRequest?.url ?? decision.evidence.sourceUrl ?? "";
  if (url.includes("bedesten.adalet.gov.tr")) return "bedesten";
  if (url.includes("karararama.danistay.gov.tr")) return "karararama.danistay.gov.tr";
  if (decision.decisionSourceTrace?.fullTextRetrievalMethod === "mock") return "mock";
  return decision.evidence.source;
}

function buildPreliminaryAssessment(pack: DoctorLegalInformationPack): PreliminaryAssessment | null {
  const sentences: AssessmentSentence[] = [];
  const seenChambers = new Set<string>();

  // ── Legislation sentences: extract concrete obligation ──
  for (const prov of pack.relevantLegislation) {
    if (!prov.verbatimQuote?.trim()) continue;

    const name = prov.legislationName ?? "ilgili mevzuat";
    const article = prov.articleNumber ? `md. ${prov.articleNumber}` : "";
    const sourceLabel = [name, article].filter(Boolean).join(" ");

    // Extract a short snippet from the verbatim quote for context
    const rawSnippet = stripHtmlToText(prov.verbatimQuote);
    const snippet = rawSnippet.length > 120
      ? rawSnippet.slice(0, 120).trim() + "\u2026"
      : rawSnippet.trim();

    sentences.push({
      text: `${sourceLabel} uyarınca: "${snippet}"`,
      sourceRef: prov.sourceDocumentId ?? `legislation:${encodeURIComponent(sourceLabel)}`,
      sourceLabel
    });
  }

  // ── Precedent sentences: extract real outcome, dedupe chambers ──
  for (const prec of pack.verifiedHighCourtPrecedents) {
    // Skip low-relevance decisions (e.g. land registry, traffic court)
    const relevance = prec.healthLawRelevanceScore ?? 0;
    const minScore = readConfig().assessment.minRelevanceScore;
    if (relevance < minScore) continue;

    const courtLabel = prec.courtAndChamber ?? prec.court ?? "yüksek mahkeme";

    // Skip if no meaningful content to report
    let outcome = stripHtmlToText(prec.outcome ?? "");
    if (outcome && outcome !== "Kaynakta sonuc yok" && outcome.length > 0) {
      outcome = truncateForDisplay(outcome, 200);
    }
    const hasOutcome = outcome && outcome !== "Kaynakta sonuc yok" && outcome.length > 0;
    const hasReasoning = prec.legalAssessment && prec.legalAssessment !== "Kaynakta hukuki degerlendirme yok";
    if (!hasOutcome && !hasReasoning) continue;

    // Dedupe: max 1 sentence per court+chamber (keep the first/most relevant)
    if (seenChambers.has(courtLabel)) continue;
    seenChambers.add(courtLabel);

    // Build meaningful text from real data
    let text = "";
    if (hasOutcome && hasReasoning) {
      text = `${courtLabel}, benzer bir olayda "${outcome}" yönünde karar vermiştir.`;
    } else if (hasOutcome) {
      text = `${courtLabel}, benzer bir olayda sonuç olarak "${outcome}" yönünde hüküm kurmuştur.`;
    } else {
      text = `${courtLabel} içtihadı, benzer olaylarda emsal teşkil edebilecek değerlendirmeler içermektedir.`;
    }

    // Add similarity note if available
    const similarityNote = stripHtmlToText(prec.similarityDifference ?? "");
    if (similarityNote && similarityNote !== "Benzerlik teyit edilmedi") {
      text += ` ${similarityNote}`;
    }

    sentences.push({
      text,
      sourceRef: prec.sourceDocumentId ?? `precedent:${encodeURIComponent(courtLabel)}`,
      sourceLabel: courtLabel
    });
  }

  if (sentences.length === 0) return null;

  // Build summary from the assessment sentences
  const sourceNames = sentences.map(s => s.sourceLabel).filter((v, i, a) => a.indexOf(v) === i);
  const summarySources = sourceNames.slice(0, 3).join(", ");
  const summary = `Mevcut kaynaklar (${summarySources}) ışığında değerlendirilmiştir. Bu paket nihai hukuki kanaat oluşturmaz; her somut olay kendi bağlamında bir uzman tarafından değerlendirilmelidir.`;

  return { summary, sentences };
}

/**
 * Deduplicate legislation provisions by sourceDocumentId + articleNumber.
 * Keeps the provision with the longest verbatimText.
 */
function deduplicateProvisions(provisions: LegislationProvision[]): { dedupedProvisions: LegislationProvision[]; dedupedProvisionCount: number } {
  const seen = new Map<string, LegislationProvision>();
  for (const p of provisions) {
    const key = `${p.evidence.documentId}::${p.articleNumber ?? ""}`;
    const existing = seen.get(key);
    if (!existing || (p.verbatimText?.length ?? 0) > (existing.verbatimText?.length ?? 0)) {
      seen.set(key, p);
    }
  }
  const deduped = [...seen.values()];
  return { dedupedProvisions: deduped, dedupedProvisionCount: provisions.length - deduped.length };
}

export function composeDoctorLegalInformationPack(
  classification: ClassifiedMedicalLegalQuestion,
  provisions: LegislationProvision[],
  precedents: CourtDecision[],
  sourceUnavailable: SourceUnavailable[] = [],
  selectionDiagnostics?: LegislationSelectionDiagnostics,
  timeBudget?: any,
  assessmentTone?: AssessmentTone
): DoctorLegalInformationPack {
  const tone = assessmentTone ?? "grounded-advisory";

  // Deduplicate decisions that appear from multiple sources (e.g. same case from Yargitay and Bedesten).
  // Keep the richest version (full text + reasoning).
  const { decisions: dedupedPrecedents, dedupedCount } = deduplicateDecisions(precedents);

  // Deduplicate legislation provisions from the same documentId + articleNumber.
  const { dedupedProvisions, dedupedProvisionCount } = deduplicateProvisions(provisions);

  const groundedCount = dedupedProvisions.length + dedupedPrecedents.length;
  let shortAnswer =
    groundedCount > 0
      ? "Soru resmi kaynak kayıtlarıyla eşleştirildi; aşağıdaki paket nihai hukuki kanaat değildir."
      : "Bu soru için doğrulanmış mevzuat maddesi veya gerekçeli yüksek mahkeme kararı bulunamadı.";

  const isExhausted = timeBudget && typeof timeBudget.isExhausted === "function" && timeBudget.isExhausted();
  if (isExhausted && groundedCount > 0) {
    shortAnswer = "Zaman bütçesi limiti nedeniyle kısmi veri seti oluşturulabildi. Soru resmi kaynak kayıtlarıyla eşleştirildi; aşağıdaki paket nihai hukuki kanaat değildir.";
  }

  const hasLiveLegislation = dedupedProvisions.some((provision) => Boolean(provision.evidence.sourceUrl));

  const sourceWarnings = groundedCount > 0
    ? [hasLiveLegislation
        ? "Mevzuat maddesi canlı resmi kaynaktan çıkartıldı; emsal kaynak modları diagnostik alanında izlenir."
        : "MVP mock kaynaklarla çalışır; canlı resmi kaynak entegrasyonu bu pack için kullanılmadı."]
    : ["Kaynak yokken madde veya karar üretilmedi."];

  if (isExhausted) {
    sourceWarnings.push("Zaman bütçesi sınırı nedeniyle tarama erken sonlandırıldı (timeBudgetExhausted).");
  }

  // Build optional preliminary assessment from available sources
  const relevantLegislation = dedupedProvisions.map((provision) => ({
    legislationName: provision.legislationName,
    articleNumber: provision.articleNumber,
    verbatimQuote: provision.verbatimText,
    connection: provision.connection,
    sourceDocumentId: provision.evidence.documentId,
    ...(provision.sourceTrace ? { sourceTrace: provision.sourceTrace } : {}),
    ...(provision.ranking ? { ranking: provision.ranking } : {}),
    ...(provision.inForce !== undefined ? { inForce: provision.inForce } : {}),
    ...(provision.lastAmendedDate !== undefined ? { lastAmendedDate: provision.lastAmendedDate } : {}),
    ...(provision.repealed !== undefined ? { repealed: provision.repealed } : {})
  }));
  const verifiedHighCourtPrecedents = dedupedPrecedents.map((precedent) => formatPrecedent(precedent, classification));
  const legalClassification = classificationSection(classification);
  const missingInformation = classification.missingInformation;
  const lawyerReviewPoints = [
    "Somut olay belgeleri ile resmi kaynak eslestirmesinin avukat tarafindan kontrolu",
    "Guncel mevzuat metni ve karar tam metninin canli kaynaktan yeniden dogrulanmasi"
  ];

  // Context-aware lawyer review points based on classification dimensions
  if (classification.dimensions.includes("disciplinary_administrative" as any)) {
    lawyerReviewPoints.push("Disiplin soruşturmasında savunma süresi ve zamanaşımı kontrolü");
  }
  if (classification.dimensions.includes("privacy_kvkk" as any)) {
    lawyerReviewPoints.push("Veri sorumlusuna başvuru ve KVK Kurulu'na şikayet süreleri");
  }

  // Build preliminary assessment only in grounded-advisory mode
  let preliminaryAssessment: PreliminaryAssessment | null = null;
  if (tone !== "strict") {
    preliminaryAssessment = buildPreliminaryAssessment({
      shortAnswer,
      legalClassification,
      relevantLegislation,
      verifiedHighCourtPrecedents,
      missingInformation,
      lawyerReviewPoints,
      sourceWarnings,
    } as DoctorLegalInformationPack);
  }

  const pack: DoctorLegalInformationPack = {
    shortAnswer,
    legalClassification,
    relevantLegislation,
    verifiedHighCourtPrecedents,
    missingInformation,
    lawyerReviewPoints,
    sourceWarnings,
    ...(sourceUnavailable.length > 0 ? { sourceUnavailable } : {}),
    ...(dedupedProvisions.some((provision) => provision.sourceTrace)
      ? { sourceTrace: dedupedProvisions.flatMap((provision) => provision.sourceTrace ? [provision.sourceTrace] : []) }
      : {}),
    ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
    ...(preliminaryAssessment ? { preliminaryAssessment } : {})
  };

  // Attach dedup diagnostics (will be merged with full precedentDiagnostics by caller)
  if (dedupedCount > 0 || dedupedProvisionCount > 0) {
    pack.precedentDiagnostics = {
      ...(pack.precedentDiagnostics as any ?? {}),
      dedupedCount: dedupedCount > 0 ? dedupedCount : undefined,
      dedupedProvisionCount: dedupedProvisionCount > 0 ? dedupedProvisionCount : undefined,
    } as PrecedentSelectionDiagnostics;
  }

  return pack;
}
