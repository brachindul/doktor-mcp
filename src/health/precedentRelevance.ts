import type { ClassifiedMedicalLegalQuestion, CourtDecision } from "../contracts/legal.js";

export type IssueProfile =
  | "informed_consent"
  | "malpractice_complication"
  | "emergency_care"
  | "treatment_refusal"
  | "privacy_records"
  | "psychiatric_privacy"
  | "violence_threat"
  | "referral_consultation"
  | "private_hospital_fee"
  | "public_discipline"
  | "intensive_care"
  | "pregnancy_emergency"
  | "public_employment";

export interface PrecedentRelevanceAssessment {
  issueProfile: IssueProfile;
  score: number;
  matchedIssueSignals: string[];
  matchedGeneralHealthSignals: string[];
  missingExpectedIssueTerms: string[];
  whyWeak: string | null;
  suggestedQueryTerms: string[];
}

interface IssueProfileDefinition {
  profile: IssueProfile;
  questionSignals: string[];
  decisionSignals: string[];
  suggestedQueryTerms: string[];
}

const ISSUE_PROFILES: IssueProfileDefinition[] = [
  {
    profile: "informed_consent",
    questionSignals: ["aydınlat", "aydinlat", "rıza", "riza", "onam", "ameliyat öncesi", "ameliyat oncesi", "bilgilendirme"],
    decisionSignals: ["aydınlatılmış onam", "aydinlatilmis onam", "aydınlatılmış rıza", "aydinlatilmis riza", "rızası", "rizasi", "onam", "bilgilendirme", "komplikasyon hakkında bilgilendirme", "tıbbi müdahale onam", "tibbi mudahale onam", "hasta rızası", "hasta rizasi", "aydinlatma yukumlulugu", "aydınlatma yükümlülüğü"],
    suggestedQueryTerms: ["aydınlatılmış onam", "aydınlatılmış rıza", "ameliyat öncesi bilgilendirme", "komplikasyon hakkında bilgilendirme", "tıbbi müdahale onam"]
  },
  {
    profile: "malpractice_complication",
    questionSignals: ["malpraktis", "komplikasyon", "tıbbi hata", "tibbi hata", "özen", "ozen", "hekim kusuru"],
    decisionSignals: ["malpraktis", "komplikasyon", "tıbbi hata", "tibbi hata", "özen yükümlülüğü", "ozen yukumlulugu", "hekim kusuru", "hizmet kusuru", "tıbbi standart", "tibbi standart", "tıbbi bakım", "tibbi bakim", "hizmet sunumu kusuru", "tedavi hatasi", "tedavi hatası", "kusurlu tıbbi müdahale"],
    suggestedQueryTerms: ["komplikasyon malpraktis ayrımı", "tıbbi hata", "özen yükümlülüğü", "hekim kusuru", "komplikasyon yönetimi"]
  },
  {
    profile: "emergency_care",
    questionSignals: ["acil", "hayati tehlike", "ilk müdahale", "ilk mudahale", "sevk"],
    decisionSignals: ["acil", "acil servis", "ilk müdahale", "ilk mudahale", "hayati tehlike", "sevk", "müdahale yükümlülüğü", "mudahale yukumlulugu", "acil tıbbi müdahale", "acil tibbi mudahale", "hayati tehlike durumu", "yasa muafiyeti", "rıza aranmaksızın"],
    suggestedQueryTerms: ["acil tıbbi müdahale", "acil serviste müdahale yükümlülüğü", "hayati tehlike", "rıza aranmaksızın müdahale"]
  },
  {
    profile: "treatment_refusal",
    questionSignals: ["reddet", "bakmama", "tedaviyi bırak", "tedaviyi birak", "uymuyor", "uyumsuz", "sonlandır", "sonlandir"],
    decisionSignals: ["tedaviyi reddeden hasta", "tedaviye uymama", "tedaviye uyumsuz", "hastayı reddetme", "hastayi reddetme", "tedaviden çekilme", "tedaviden cekilme", "hasta hekim ilişkisi", "hasta hekim iliskisi", "başka hekime yönlendirme", "baska hekime yonlendirme", "tedaviye uymama nedeniyle sorumluluk", "hasta uyumsuzlugu"],
    suggestedQueryTerms: ["tedaviyi reddeden hasta", "hastanın tedaviye uymaması", "hekim hasta ilişkisini sonlandırma", "tedaviden çekilme", "başka hekime yönlendirme"]
  },
  {
    profile: "privacy_records",
    questionSignals: ["mahrem", "kişisel sağlık verisi", "kisisel saglik verisi", "epikriz", "hasta dosyası", "hasta dosyasi", "kayıt", "kayit", "sosyal medya"],
    decisionSignals: ["hasta mahremiyeti", "kişisel sağlık verisi", "kisisel saglik verisi", "hasta dosyası", "hasta dosyasi", "epikriz", "sır saklama", "sir saklama", "sosyal medya", "sağlık verisi", "saglik verisi", "özel hayatın gizliliği", "ozel hayatin gizliligi", "kişisel veri", "kisisel veri", "kvkk", "veri sorumluluğu", "veri sorumlulugu", "hasta kaydı gizliliği", "hasta kaydi gizliligi"],
    suggestedQueryTerms: ["hasta mahremiyeti", "kişisel sağlık verisi", "hasta dosyası", "epikriz", "sır saklama yükümlülüğü"]
  },
  {
    profile: "psychiatric_privacy",
    questionSignals: ["psikiyatri", "psikiyatrik", "mahrem", "aydınlat", "aydinlat"],
    decisionSignals: ["psikiyatri", "psikiyatrik", "ruh sağlığı", "ruh sagligi", "hasta mahremiyeti", "aydınlatılmış rıza", "aydinlatilmis riza", "psikiyatrik hasta", "ruh sagligi tedavisi"],
    suggestedQueryTerms: ["psikiyatri mahremiyet", "psikiyatri aydınlatılmış rıza", "sır saklama yükümlülüğü", "kişisel sağlık verisi"]
  },
  {
    profile: "violence_threat",
    questionSignals: ["şiddet", "siddet", "tehdit", "hakaret", "beyaz kod", "can güvenliği", "can guvenligi"],
    decisionSignals: ["hekime şiddet", "hekime siddet", "sağlık personeline tehdit", "saglik personeline tehdit", "sağlık personeline hakaret", "saglik personeline hakaret", "beyaz kod", "görevi yaptırmamak", "gorevi yaptirmamak", "görev sırasında şiddet", "gorevi sirasinda siddet"],
    suggestedQueryTerms: ["hekime şiddet", "sağlık personeline hakaret", "sağlık personeline tehdit", "beyaz kod", "görevi yaptırmamak için direnme"]
  },
  {
    profile: "referral_consultation",
    questionSignals: ["konsültasyon", "konsultasyon", "sevk", "yandal", "uzman hekime"],
    decisionSignals: ["konsültasyon", "konsultasyon", "sevk yükümlülüğü", "sevk yukumlulugu", "uzman hekime yönlendirme", "uzman hekime yonlendirme", "tıbbi standarda uygun sevk", "tibbi standarda uygun sevk", "sevk edilmeme", "uzman hekim talebi"],
    suggestedQueryTerms: ["konsültasyon", "sevk yükümlülüğü", "uzman hekime yönlendirme", "tıbbi standarda uygun sevk"]
  },
  {
    profile: "private_hospital_fee",
    questionSignals: ["özel hastane", "ozel hastane", "ücret", "ucret", "tedavi bedeli", "ödemiyor", "odemiyor"],
    decisionSignals: ["özel hastane", "ozel hastane", "ücret uyuşmazlığı", "ucret uyusmazligi", "tedavi bedeli", "hasta ücret bilgilendirme", "hasta ucret bilgilendirme", "özel sağlık kuruluşu", "ozel saglik kurulusu", "hizmet bedeli", "muayene ucreti", "muayene ücreti"],
    suggestedQueryTerms: ["özel hastane ücret uyuşmazlığı", "hasta ücret bilgilendirme", "tedavi bedeli", "özel sağlık kuruluşu"]
  },
  {
    profile: "public_discipline",
    questionSignals: ["kamu hastanesi", "disiplin", "idari soruşturma", "idari sorusturma", "görevi ihmal", "gorevi ihmal"],
    decisionSignals: ["kamu hastanesi", "disiplin", "idari soruşturma", "idari sorusturma", "görevi ihmal", "gorevi ihmal", "hizmet kusuru", "sağlık hizmeti", "saglik hizmeti", "disiplin cezası", "disiplin cezasi", "disiplin soruşturması", "disiplin sorusturmasi", "idari para cezası", "idari para cezasi", "görevi kötüye kullanma"],
    suggestedQueryTerms: ["kamu hastanesi hekim disiplin", "idari soruşturma hekim", "görevi ihmal sağlık hizmeti", "hizmet kusuru"]
  },
  {
    profile: "intensive_care",
    questionSignals: ["yoğun bakım", "yogun bakim", "tedaviyi bırakmak", "tedaviyi birakmak"],
    decisionSignals: ["yoğun bakım", "yogun bakim", "yaşam desteği", "yasam destegi", "tedaviyi sonlandırma", "tedaviyi sonlandirma", "acil müdahale", "acil mudahale", "yaşam sonu kararları", "yasam sonu kararlari"],
    suggestedQueryTerms: ["yoğun bakım tedavi reddi", "yaşam desteği tedaviyi sonlandırma", "acil müdahale yükümlülüğü"]
  },
  {
    profile: "pregnancy_emergency",
    questionSignals: ["gebe", "gebelik", "hamile", "acil", "rıza yok", "riza yok"],
    decisionSignals: ["gebe", "gebelik", "hamile", "doğum", "dogum", "acil müdahale", "acil mudahale", "rıza aranmaksızın", "riza aranmaksizin", "gebede acil", "hamilelikte acil"],
    suggestedQueryTerms: ["gebede acil müdahale", "rıza aranmaksızın müdahale", "hayati tehlike gebelik", "acil tıbbi müdahale"]
  },
  {
    profile: "public_employment",
    questionSignals: ["tayin", "yer değiştirme", "yer degistirme", "atama", "nakil", "kamu görevlisi", "kamu gorevlisi"],
    decisionSignals: ["sağlık personeli atama", "saglik personeli atama", "kamu görevlisi atama", "kamu gorevlisi atama", "atama iptali", "nakil iptali", "yer değiştirme iptali", "yer degistirme iptali", "idari dava", "idari iptal", "idari yargı", "memur ataması", "memur atamasi", "göreve iade", "goreve iade", "idari işlem iptali"],
    suggestedQueryTerms: ["sağlık personeli atama nakil iptal", "kamu görevlisi atama idari dava", "memur ataması iptali", "göreve iade idari dava"]
  }
];

const GENERAL_HEALTH_SIGNALS = ["hasta", "hastane", "hekim", "doktor", "tabip", "tedavi", "tıbbi", "tibbi", "sağlık", "saglik", "tazminat"];

/** Signals that are too generic to indicate domain-specific relevance on their own. */
const GENERIC_ONLY_SIGNALS = ["sağlık", "saglik", "hasta", "hekim", "tedavi"];

/** Ratio threshold: if matched signals are all generic, apply penalty. */
const GENERIC_MATCH_PENALTY = -1;

/** Chamber relevance bonus/penalty for court-topic alignment.
 *  +1: chamber is a specifically distinguished match (e.g. Ceza for violence)
 *   0: default/expected chamber (e.g. Hukuk for malpractice) — no boost
 *  -1: clearly wrong chamber or wrong court
 */
const CHAMBER_BONUS = 1;
const CHAMBER_PENALTY = -1;

interface ChamberMapping {
  preferredCourts: ("yargitay" | "danistay")[];
  /** Default chamber keywords — expected, no bonus. */
  defaultChamberKeywords: string[];
  /** Distinguished chamber keywords — gives +1 when matched. */
  distinguishedChamberKeywords?: string[];
  /** Clearly wrong chamber keywords — gives -1 when matched. */
  irrelevantChamberKeywords?: string[];
}

const ISSUE_PROFILE_CHAMBERS: Record<IssueProfile, ChamberMapping> = {
  informed_consent: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  malpractice_complication: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  emergency_care: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"], distinguishedChamberKeywords: ["ceza"] },
  treatment_refusal: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  privacy_records: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  psychiatric_privacy: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  violence_threat: {
    preferredCourts: ["yargitay"],
    defaultChamberKeywords: ["ceza"],
    distinguishedChamberKeywords: ["ceza"],
    irrelevantChamberKeywords: ["hukuk"]
  },
  referral_consultation: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  private_hospital_fee: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  public_discipline: {
    preferredCourts: ["danistay"],
    defaultChamberKeywords: ["daire"],
    irrelevantChamberKeywords: ["hukuk", "ceza"]
  },
  intensive_care: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  pregnancy_emergency: { preferredCourts: ["yargitay"], defaultChamberKeywords: ["hukuk"] },
  public_employment: {
    preferredCourts: ["danistay"],
    defaultChamberKeywords: ["daire"],
    irrelevantChamberKeywords: ["hukuk", "ceza"]
  }
};

function computeChamberBonus(profile: IssueProfile, court: string | undefined, chamber: string | undefined): number {
  const mapping = ISSUE_PROFILE_CHAMBERS[profile];
  if (!mapping || !court) return 0;
  const normalizedCourt = normalizeText(court);
  const normalizedChamber = normalizeText(chamber ?? "");

  const isPreferredCourt = mapping.preferredCourts.some((c) => normalizedCourt.includes(c));
  if (!isPreferredCourt) return CHAMBER_PENALTY;

  if (mapping.irrelevantChamberKeywords?.some((kw) => normalizedChamber.includes(kw))) {
    return CHAMBER_PENALTY;
  }

  if (mapping.distinguishedChamberKeywords?.some((kw) => normalizedChamber.includes(kw))) {
    return CHAMBER_BONUS;
  }

  return 0;
}

export function inferIssueProfileFromQuestion(question: string): IssueProfile {
  const normalized = normalizeText(question);
  const matched = ISSUE_PROFILES
    .map((definition) => ({
      definition,
      count: definition.questionSignals.filter((signal) => normalized.includes(normalizeText(signal))).length
    }))
    .sort((a, b) => b.count - a.count);
  return matched[0]?.count ? matched[0].definition.profile : "malpractice_complication";
}

export function suggestedQueriesForQuestion(question: string, maxQueries = 3): string[] {
  const profile = getProfileDefinition(inferIssueProfileFromQuestion(question));
  return profile.suggestedQueryTerms.slice(0, maxQueries);
}

export function assessPrecedentRelevance(
  questionOrClassification: string | ClassifiedMedicalLegalQuestion,
  decision: CourtDecision
): PrecedentRelevanceAssessment {
  const question = typeof questionOrClassification === "string" ? questionOrClassification : questionOrClassification.question;
  const profile = getProfileDefinition(inferIssueProfileFromQuestion(question));

  const decisionText = normalizeText([
    decision.factSummary,
    decision.legalReasoning,
    decision.outcome,
    decision.relevanceNote,
    decision.fullText,
    decision.topicTags.join(" ")
  ].filter(Boolean).join(" "));

  // ── Core-body text (legalReasoning + outcome) for weighted matching ──
  const coreText = normalizeText([
    decision.legalReasoning,
    decision.outcome
  ].filter(Boolean).join(" "));

  const matchedIssueSignals = profile.decisionSignals.filter((signal) => decisionText.includes(normalizeText(signal)));
  const matchedGeneralHealthSignals = GENERAL_HEALTH_SIGNALS.filter((signal) => decisionText.includes(normalizeText(signal)));

  // ── Core-body bonus: issue signals found in legalReasoning/outcome count double ──
  const matchedCoreSignals = profile.decisionSignals.filter((signal) => coreText.includes(normalizeText(signal)));
  const coreBonus = matchedCoreSignals.length >= 2 ? 2 : matchedCoreSignals.length === 1 ? 1 : 0;

  // ── Base score from matched issue signals ──
  let score = matchedIssueSignals.length >= 2 ? 2 : matchedIssueSignals.length === 1 ? 1 : 0;

  // ── Apply core-body bonus ──
  score += coreBonus;

  // ── Chamber relevance bonus/penalty ──
  score += computeChamberBonus(profile.profile, decision.court, decision.chamber);

  // ── Penalty: only generic health terms matched, no specific issue signals ──
  if (matchedIssueSignals.length === 0 && matchedGeneralHealthSignals.length > 0) {
    const allGeneric = matchedGeneralHealthSignals.every((signal) =>
      GENERIC_ONLY_SIGNALS.includes(signal)
    );
    if (allGeneric) {
      score += GENERIC_MATCH_PENALTY;
    }
  }

  // Clamp to [0, 5]
  score = Math.max(0, Math.min(5, score));

  const missingExpectedIssueTerms = score >= 2 ? [] : profile.decisionSignals.slice(0, 5).filter((signal) =>
    !matchedIssueSignals.some((matched) => normalizeText(matched) === normalizeText(signal))
  );

  const whyWeak = score >= 2 ? null :
    matchedGeneralHealthSignals.length > 0
      ? matchedIssueSignals.length === 0
        ? `Only generic health terms matched (e.g. "sağlık", "hasta"); no specific ${profile.profile} issue overlap detected.`
        : `General health terms matched, but specific ${profile.profile} issue overlap is weak.`
      : `No specific ${profile.profile} issue signals were detected.`;

  return {
    issueProfile: profile.profile,
    score,
    matchedIssueSignals: [...new Set(matchedIssueSignals)],
    matchedGeneralHealthSignals: [...new Set(matchedGeneralHealthSignals)],
    missingExpectedIssueTerms,
    whyWeak,
    suggestedQueryTerms: profile.suggestedQueryTerms
  };
}

export function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProfileDefinition(profile: IssueProfile): IssueProfileDefinition {
  return ISSUE_PROFILES.find((definition) => definition.profile === profile) ?? ISSUE_PROFILES[1];
}
