import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  DoctorLegalInformationPack,
  LegalClassificationSection,
  LegislationProvision,
  LegislationSelectionDiagnostics,
  SourceUnavailable
} from "../contracts/legal.js";

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

function formatPrecedent(decision: CourtDecision) {
  const trace = decision.decisionSourceTrace;
  const accessSource = inferAccessSource(decision);
  const reasoningDetected = Boolean(decision.legalReasoning?.trim());
  const matchedHealthLawTerms = findMatchedHealthLawTerms(decision);
  const healthLawRelevanceScore = matchedHealthLawTerms.length >= 2
    ? 2
    : matchedHealthLawTerms.length === 1 || decision.topicTags.length > 0 ? 1 : 0;

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
    healthLawRelevanceScore,
    matchedQueryTerms: trace?.query ? [trace.query] : [],
    matchedHealthLawTerms,
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

function findMatchedHealthLawTerms(decision: CourtDecision): string[] {
  const haystack = `${decision.factSummary ?? ""} ${decision.legalReasoning ?? ""} ${decision.fullText ?? ""}`.toLocaleLowerCase("tr-TR");
  const terms = [
    "hekim",
    "doktor",
    "tabip",
    "hasta",
    "tedavi",
    "tibbi",
    "tıbbi",
    "müdahale",
    "mudahale",
    "riza",
    "rıza",
    "onam",
    "aydınlat",
    "aydinlat",
    "sağlık",
    "saglik",
    "mahremiyet",
    "acil",
    "deontoloji",
    "malpraktis"
  ];
  return [...new Set([...decision.topicTags, ...terms.filter((term) => haystack.includes(term))])];
}

export function composeDoctorLegalInformationPack(
  classification: ClassifiedMedicalLegalQuestion,
  provisions: LegislationProvision[],
  precedents: CourtDecision[],
  sourceUnavailable: SourceUnavailable[] = [],
  selectionDiagnostics?: LegislationSelectionDiagnostics
): DoctorLegalInformationPack {
  const groundedCount = provisions.length + precedents.length;
  const shortAnswer =
    groundedCount > 0
      ? "Soru resmi kaynak kayitlariyla eslestirildi; asagidaki paket nihai hukuki kanaat degildir."
      : "Bu soru icin dogrulanmis mevzuat maddesi veya gerekceli yuksek mahkeme karari bulunamadi.";
  const hasLiveLegislation = provisions.some((provision) => Boolean(provision.evidence.sourceUrl));

  return {
    shortAnswer,
    legalClassification: classificationSection(classification),
    relevantLegislation: provisions.map((provision) => ({
      legislationName: provision.legislationName,
      articleNumber: provision.articleNumber,
      verbatimQuote: provision.verbatimText,
      connection: provision.connection,
      sourceDocumentId: provision.evidence.documentId,
      ...(provision.sourceTrace ? { sourceTrace: provision.sourceTrace } : {}),
      ...(provision.ranking ? { ranking: provision.ranking } : {})
    })),
    verifiedHighCourtPrecedents: precedents.map(formatPrecedent),
    missingInformation: classification.missingInformation,
    lawyerReviewPoints: [
      "Somut olay belgeleri ile resmi kaynak eslestirmesinin avukat tarafindan kontrolu",
      "Guncel mevzuat metni ve karar tam metninin canli kaynaktan yeniden dogrulanmasi"
    ],
    sourceWarnings:
      groundedCount > 0
        ? [hasLiveLegislation
            ? "Mevzuat maddesi canli resmi kaynaktan cikartildi; emsal kaynak modlari diagnostik alaninda izlenir."
            : "MVP mock kaynaklarla calisir; canli resmi kaynak entegrasyonu bu pack icin kullanilmadi."]
        : ["Kaynak yokken madde veya karar uretilmedi."],
    ...(sourceUnavailable.length > 0 ? { sourceUnavailable } : {}),
    ...(provisions.some((provision) => provision.sourceTrace)
      ? { sourceTrace: provisions.flatMap((provision) => provision.sourceTrace ? [provision.sourceTrace] : []) }
      : {}),
    ...(selectionDiagnostics ? { selectionDiagnostics } : {})
  };
}
