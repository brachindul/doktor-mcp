import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  DoctorLegalInformationPack,
  LegalClassificationSection,
  LegislationProvision,
  LegislationSelectionDiagnostics,
  PreliminaryAssessment,
  AssessmentSentence,
  SourceUnavailable
} from "../contracts/legal.js";
import { assessPrecedentRelevance } from "./precedentRelevance.js";

/** Controls whether the pack includes a source-grounded preliminary assessment. */
export type AssessmentTone = "strict" | "grounded-advisory";

const dimensionLabels = {
  criminal: "Ceza hukuku boyutu resmi kaynak eslestirmesi bekliyor.",
  civil_compensation: "Tazminat ve ozel hukuk boyutu olay kayitlariyla birlikte incelenebilir.",
  disciplinary_administrative: "Disiplin veya idari sorusturma boyutu ayri kaynak taramasi gerektirebilir.",
  patient_rights: "Hasta haklari boyutu soru ile eslestirildi.",
  privacy_kvkk: "Saglik verisi ve mahremiyet boyutu soru ile eslestirildi.",
  professional_ethics: "Meslek etigi boyutu soru ile eslestirildi."
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

function formatPrecedent(decision: CourtDecision, classification: ClassifiedMedicalLegalQuestion) {
  const trace = decision.decisionSourceTrace;
  const accessSource = inferAccessSource(decision);
  const reasoningDetected = Boolean(decision.legalReasoning?.trim());
  const relevance = assessPrecedentRelevance(classification, decision);

  return {
    courtAndChamber: [decision.court.toLocaleUpperCase("tr-TR"), decision.chamber].filter(Boolean).join(" / "),
    court: decision.court,
    chamber: decision.chamber,
    date: decision.decisionDate ?? "Kaynakta tarih yok",
    decisionDate: decision.decisionDate,
    meritsAndDecisionNumber: [decision.meritsNumber, decision.decisionNumber].filter(Boolean).join(" - "),
    meritsNumber: decision.meritsNumber,
    decisionNumber: decision.decisionNumber,
    factSummary: decision.factSummary ?? "Kaynakta olay ozeti yok",
    legalAssessment: decision.legalReasoning ?? "Kaynakta hukuki degerlendirme yok",
    outcome: decision.outcome ?? "Kaynakta sonuc yok",
    similarityDifference: decision.relevanceNote ?? "Benzerlik teyit edilmedi",
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

  // From legislation: one sentence per relevant provision that has a verbatim quote
  for (const prov of pack.relevantLegislation) {
    if (!prov.verbatimQuote?.trim()) continue;
    const sourceLabel =
      prov.sourceTrace?.matchedHealthMapping?.title
      ?? prov.sourceTrace?.query
      ?? prov.sourceDocumentId
      ?? "unknown";
    sentences.push({
      text: `Bu durum, ${sourceLabel} hükümlerine göre değerlendirilebilir.`,
      sourceRef: prov.sourceDocumentId ?? sourceLabel,
      sourceLabel
    });
  }

  // From precedents: one sentence per verified precedent
  for (const prec of pack.verifiedHighCourtPrecedents) {
    const sourceLabel = prec.courtAndChamber ?? prec.sourceDocumentId ?? "unknown";
    sentences.push({
      text: `Emsal kararlar benzer olaylarda ${sourceLabel} kararının işaret ettiği yönde eğilim göstermektedir.`,
      sourceRef: prec.sourceDocumentId ?? sourceLabel,
      sourceLabel
    });
  }

  if (sentences.length === 0) return null;

  // Build summary from the first few sentences
  const summarySources = sentences.slice(0, 3).map(s => s.sourceLabel).join(", ");
  const summary = `Mevcut kaynaklar (${summarySources}) ışığında, bu hukuki durum ilgili mevzuat ve emsal kararlar çerçevesinde değerlendirilmelidir. Nihai hukuki kanaat oluşturmak için bir uzmana danışılması önerilir.`;

  return { summary, sentences };
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
  const groundedCount = provisions.length + precedents.length;
  let shortAnswer =
    groundedCount > 0
      ? "Soru resmi kaynak kayitlariyla eslestirildi; asagidaki paket nihai hukuki kanaat degildir."
      : "Bu soru icin dogrulanmis mevzuat maddesi veya gerekceli yuksek mahkeme karari bulunamadi.";

  const isExhausted = timeBudget && typeof timeBudget.isExhausted === "function" && timeBudget.isExhausted();
  if (isExhausted && groundedCount > 0) {
    shortAnswer = "Zaman bütçesi limiti nedeniyle kısmi veri seti oluşturulabildi. Soru resmi kaynak kayitlariyla eslestirildi; asagidaki paket nihai hukuki kanaat degildir.";
  }

  const hasLiveLegislation = provisions.some((provision) => Boolean(provision.evidence.sourceUrl));

  const sourceWarnings = groundedCount > 0
    ? [hasLiveLegislation
        ? "Mevzuat maddesi canli resmi kaynaktan cikartildi; emsal kaynak modlari diagnostik alaninda izlenir."
        : "MVP mock kaynaklarla calisir; canli resmi kaynak entegrasyonu bu pack icin kullanilmadi."]
    : ["Kaynak yokken madde veya karar uretilmedi."];

  if (isExhausted) {
    sourceWarnings.push("Zaman bütçesi sınırı nedeniyle tarama erken sonlandırıldı (timeBudgetExhausted).");
  }

  // Build optional preliminary assessment from available sources
  const relevantLegislation = provisions.map((provision) => ({
    legislationName: provision.legislationName,
    articleNumber: provision.articleNumber,
    verbatimQuote: provision.verbatimText,
    connection: provision.connection,
    sourceDocumentId: provision.evidence.documentId,
    ...(provision.sourceTrace ? { sourceTrace: provision.sourceTrace } : {}),
    ...(provision.ranking ? { ranking: provision.ranking } : {})
  }));
  const verifiedHighCourtPrecedents = precedents.map((precedent) => formatPrecedent(precedent, classification));
  const legalClassification = classificationSection(classification);
  const missingInformation = classification.missingInformation;
  const lawyerReviewPoints = [
    "Somut olay belgeleri ile resmi kaynak eslestirmesinin avukat tarafindan kontrolu",
    "Guncel mevzuat metni ve karar tam metninin canli kaynaktan yeniden dogrulanmasi"
  ];

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

  return {
    shortAnswer,
    legalClassification,
    relevantLegislation,
    verifiedHighCourtPrecedents,
    missingInformation,
    lawyerReviewPoints,
    sourceWarnings,
    ...(sourceUnavailable.length > 0 ? { sourceUnavailable } : {}),
    ...(provisions.some((provision) => provision.sourceTrace)
      ? { sourceTrace: provisions.flatMap((provision) => provision.sourceTrace ? [provision.sourceTrace] : []) }
      : {}),
    ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
    ...(preliminaryAssessment ? { preliminaryAssessment } : {})
  };
}
