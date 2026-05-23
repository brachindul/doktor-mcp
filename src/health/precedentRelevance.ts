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
  | "pregnancy_emergency";

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
    decisionSignals: ["aydınlatılmış onam", "aydinlatilmis onam", "aydınlatılmış rıza", "aydinlatilmis riza", "rızası", "rizasi", "onam", "bilgilendirme", "komplikasyon hakkında bilgilendirme", "tıbbi müdahale onam", "tibbi mudahale onam"],
    suggestedQueryTerms: ["aydınlatılmış onam", "aydınlatılmış rıza", "ameliyat öncesi bilgilendirme", "komplikasyon hakkında bilgilendirme", "tıbbi müdahale onam"]
  },
  {
    profile: "malpractice_complication",
    questionSignals: ["malpraktis", "komplikasyon", "tıbbi hata", "tibbi hata", "özen", "ozen", "hekim kusuru"],
    decisionSignals: ["malpraktis", "komplikasyon", "tıbbi hata", "tibbi hata", "özen yükümlülüğü", "ozen yukumlulugu", "hekim kusuru", "hizmet kusuru", "tıbbi standart", "tibbi standart"],
    suggestedQueryTerms: ["komplikasyon malpraktis ayrımı", "tıbbi hata", "özen yükümlülüğü", "hekim kusuru", "komplikasyon yönetimi"]
  },
  {
    profile: "emergency_care",
    questionSignals: ["acil", "hayati tehlike", "ilk müdahale", "ilk mudahale", "sevk"],
    decisionSignals: ["acil", "acil servis", "ilk müdahale", "ilk mudahale", "hayati tehlike", "sevk", "müdahale yükümlülüğü", "mudahale yukumlulugu"],
    suggestedQueryTerms: ["acil tıbbi müdahale", "acil serviste müdahale yükümlülüğü", "hayati tehlike", "rıza aranmaksızın müdahale"]
  },
  {
    profile: "treatment_refusal",
    questionSignals: ["reddet", "bakmama", "tedaviyi bırak", "tedaviyi birak", "uymuyor", "uyumsuz", "sonlandır", "sonlandir"],
    decisionSignals: ["tedaviyi reddeden hasta", "tedaviye uymama", "tedaviye uyumsuz", "hastayı reddetme", "hastayi reddetme", "tedaviden çekilme", "tedaviden cekilme", "hasta hekim ilişkisi", "hasta hekim iliskisi", "başka hekime yönlendirme", "baska hekime yonlendirme"],
    suggestedQueryTerms: ["tedaviyi reddeden hasta", "hastanın tedaviye uymaması", "hekim hasta ilişkisini sonlandırma", "tedaviden çekilme", "başka hekime yönlendirme"]
  },
  {
    profile: "privacy_records",
    questionSignals: ["mahrem", "kişisel sağlık verisi", "kisisel saglik verisi", "epikriz", "hasta dosyası", "hasta dosyasi", "kayıt", "kayit", "sosyal medya"],
    decisionSignals: ["hasta mahremiyeti", "kişisel sağlık verisi", "kisisel saglik verisi", "hasta dosyası", "hasta dosyasi", "epikriz", "sır saklama", "sir saklama", "sosyal medya", "sağlık verisi", "saglik verisi"],
    suggestedQueryTerms: ["hasta mahremiyeti", "kişisel sağlık verisi", "hasta dosyası", "epikriz", "sır saklama yükümlülüğü"]
  },
  {
    profile: "psychiatric_privacy",
    questionSignals: ["psikiyatri", "psikiyatrik", "mahrem", "aydınlat", "aydinlat"],
    decisionSignals: ["psikiyatri", "psikiyatrik", "ruh sağlığı", "ruh sagligi", "hasta mahremiyeti", "aydınlatılmış rıza", "aydinlatilmis riza"],
    suggestedQueryTerms: ["psikiyatri mahremiyet", "psikiyatri aydınlatılmış rıza", "sır saklama yükümlülüğü", "kişisel sağlık verisi"]
  },
  {
    profile: "violence_threat",
    questionSignals: ["şiddet", "siddet", "tehdit", "hakaret", "beyaz kod", "can güvenliği", "can guvenligi"],
    decisionSignals: ["hekime şiddet", "hekime siddet", "sağlık personeline tehdit", "saglik personeline tehdit", "sağlık personeline hakaret", "saglik personeline hakaret", "beyaz kod", "görevi yaptırmamak", "gorevi yaptirmamak"],
    suggestedQueryTerms: ["hekime şiddet", "sağlık personeline hakaret", "sağlık personeline tehdit", "beyaz kod", "görevi yaptırmamak için direnme"]
  },
  {
    profile: "referral_consultation",
    questionSignals: ["konsültasyon", "konsultasyon", "sevk", "yandal", "uzman hekime"],
    decisionSignals: ["konsültasyon", "konsultasyon", "sevk yükümlülüğü", "sevk yukumlulugu", "uzman hekime yönlendirme", "uzman hekime yonlendirme", "tıbbi standarda uygun sevk", "tibbi standarda uygun sevk"],
    suggestedQueryTerms: ["konsültasyon", "sevk yükümlülüğü", "uzman hekime yönlendirme", "tıbbi standarda uygun sevk"]
  },
  {
    profile: "private_hospital_fee",
    questionSignals: ["özel hastane", "ozel hastane", "ücret", "ucret", "tedavi bedeli", "ödemiyor", "odemiyor"],
    decisionSignals: ["özel hastane", "ozel hastane", "ücret uyuşmazlığı", "ucret uyusmazligi", "tedavi bedeli", "hasta ücret bilgilendirme", "hasta ucret bilgilendirme", "özel sağlık kuruluşu", "ozel saglik kurulusu"],
    suggestedQueryTerms: ["özel hastane ücret uyuşmazlığı", "hasta ücret bilgilendirme", "tedavi bedeli", "özel sağlık kuruluşu"]
  },
  {
    profile: "public_discipline",
    questionSignals: ["kamu hastanesi", "disiplin", "idari soruşturma", "idari sorusturma", "görevi ihmal", "gorevi ihmal"],
    decisionSignals: ["kamu hastanesi", "disiplin", "idari soruşturma", "idari sorusturma", "görevi ihmal", "gorevi ihmal", "hizmet kusuru", "sağlık hizmeti", "saglik hizmeti"],
    suggestedQueryTerms: ["kamu hastanesi hekim disiplin", "idari soruşturma hekim", "görevi ihmal sağlık hizmeti", "hizmet kusuru"]
  },
  {
    profile: "intensive_care",
    questionSignals: ["yoğun bakım", "yogun bakim", "tedaviyi bırakmak", "tedaviyi birakmak"],
    decisionSignals: ["yoğun bakım", "yogun bakim", "yaşam desteği", "yasam destegi", "tedaviyi sonlandırma", "tedaviyi sonlandirma", "acil müdahale", "acil mudahale"],
    suggestedQueryTerms: ["yoğun bakım tedavi reddi", "yaşam desteği tedaviyi sonlandırma", "acil müdahale yükümlülüğü"]
  },
  {
    profile: "pregnancy_emergency",
    questionSignals: ["gebe", "gebelik", "hamile", "acil", "rıza yok", "riza yok"],
    decisionSignals: ["gebe", "gebelik", "hamile", "doğum", "dogum", "acil müdahale", "acil mudahale", "rıza aranmaksızın", "riza aranmaksizin"],
    suggestedQueryTerms: ["gebede acil müdahale", "rıza aranmaksızın müdahale", "hayati tehlike gebelik", "acil tıbbi müdahale"]
  }
];

const GENERAL_HEALTH_SIGNALS = ["hasta", "hastane", "hekim", "doktor", "tabip", "tedavi", "tıbbi", "tibbi", "sağlık", "saglik", "tazminat"];

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
  const matchedIssueSignals = profile.decisionSignals.filter((signal) => decisionText.includes(normalizeText(signal)));
  const matchedGeneralHealthSignals = GENERAL_HEALTH_SIGNALS.filter((signal) => decisionText.includes(normalizeText(signal)));
  const score = matchedIssueSignals.length >= 2 ? 2 : matchedIssueSignals.length === 1 ? 1 : 0;
  const missingExpectedIssueTerms = score === 2 ? [] : profile.decisionSignals.slice(0, 5).filter((signal) =>
    !matchedIssueSignals.some((matched) => normalizeText(matched) === normalizeText(signal))
  );
  const whyWeak = score >= 2 ? null :
    matchedGeneralHealthSignals.length > 0
      ? `General health terms matched, but specific ${profile.profile} issue overlap is weak.`
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
