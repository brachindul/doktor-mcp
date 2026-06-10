import type {
  ClassifiedMedicalLegalQuestion,
  LegalDimension
} from "../contracts/legal.js";
import { tokenizeTr, matchesTermTr, foldTr } from "./turkishTokenMatcher.js";
import type { TermRule } from "./turkishTokenMatcher.js";

/**
 * E4.2: Term-dimension mappings rewritten with TermRule for token-based matching.
 *
 * Each term is consolidated to its folded form (foldTr handles diacritics).
 * - token mode: exact or suffixed match (e.g. "veri" matches "verisi" but not "verildi")
 * - prefix mode: any token starting with term (e.g. "aydinlat" matches "aydınlatılmış")
 * - substring mode: full text contains the folded term (e.g. "mecburi hizmet")
 *
 * Behavioral difference from old String.includes() approach:
 * - "verildi" no longer matches "veri" (blockedPrefixes: ["veril"])
 * - "verisi", "veriler", etc. still match via allowedTokens
 * - All other terms match more precisely via token mode (suffix-aware)
 */
const termDimensions: Array<{ terms: TermRule[]; dimensions: LegalDimension[] }> = [
  {
    terms: [
      { term: "riza", matchMode: "token" },
      { term: "onam", matchMode: "token" },
      { term: "aydinlat", matchMode: "prefix" },
    ],
    dimensions: ["patient_rights", "civil_compensation"],
  },
  {
    terms: [
      {
        term: "veri",
        matchMode: "token",
        blockedPrefixes: ["veril"],
        allowedTokens: ["veriler", "verileri", "verilerin", "verisi", "verisini"],
      },
      { term: "kvkk", matchMode: "token" },
      { term: "saglik verisi", matchMode: "substring" },
      { term: "sosyal medya", matchMode: "substring" },
      { term: "paylasim", matchMode: "token" },
    ],
    dimensions: ["privacy_kvkk", "patient_rights"],
  },
  {
    terms: [
      { term: "mahrem", matchMode: "token" },
      { term: "mahremiyet", matchMode: "token" },
      { term: "sir", matchMode: "token" },
      { term: "gizlilik", matchMode: "token" },
      { term: "kayit", matchMode: "token" },
      { term: "epikriz", matchMode: "token" },
      { term: "rapor", matchMode: "token" },
      { term: "dosya", matchMode: "token" },
      { term: "arsiv", matchMode: "token" },
    ],
    dimensions: ["patient_rights"],
  },
  {
    terms: [
      { term: "ceza", matchMode: "token" },
      { term: "taksir", matchMode: "token" },
      { term: "yaralama", matchMode: "token" },
    ],
    dimensions: ["criminal"],
  },
  {
    terms: [
      { term: "disiplin", matchMode: "token" },
      { term: "idari", matchMode: "token" },
      { term: "sorusturma", matchMode: "token" },
    ],
    dimensions: ["disciplinary_administrative"],
  },
  {
    terms: [
      { term: "tayin", matchMode: "token" },
      { term: "atama", matchMode: "token" },
      { term: "yer degistirme", matchMode: "substring" },
      { term: "nakil", matchMode: "token" },
      { term: "mecburi hizmet", matchMode: "substring" },
    ],
    dimensions: ["disciplinary_administrative"],
  },
  {
    terms: [
      { term: "ek odeme", matchMode: "substring" },
      { term: "doner sermaye", matchMode: "substring" },
    ],
    dimensions: ["disciplinary_administrative"],
  },
  {
    terms: [
      { term: "etik", matchMode: "token" },
      { term: "meslek", matchMode: "token" },
      { term: "acil", matchMode: "token" },
      { term: "sevk", matchMode: "token" },
      { term: "nobet", matchMode: "token" },
      { term: "yetki", matchMode: "token" },
      { term: "gorev", matchMode: "token" },
      { term: "brans", matchMode: "token" },
      { term: "klinik", matchMode: "token" },
      { term: "hastane", matchMode: "token" },
      { term: "otopsi", matchMode: "token" },
      { term: "olum", matchMode: "token" },
      { term: "defin", matchMode: "token" },
    ],
    dimensions: ["professional_ethics", "patient_rights"],
  },
  {
    terms: [
      { term: "hekim", matchMode: "token" },
      { term: "tibbi", matchMode: "token" },
      { term: "mudahale", matchMode: "token" },
    ],
    dimensions: ["patient_rights"],
  },
  {
    terms: [
      { term: "redde", matchMode: "prefix" },
      { term: "reddet", matchMode: "prefix" },
      { term: "kabul etme", matchMode: "substring" },
      { term: "iliskisini sonlandir", matchMode: "substring" },
      { term: "tedaviyi birak", matchMode: "substring" },
      { term: "tedaviyi sonlandir", matchMode: "substring" },
      { term: "kacinma", matchMode: "token" },
      { term: "bakmama", matchMode: "token" },
    ],
    dimensions: ["professional_ethics", "civil_compensation"],
  },
  {
    terms: [
      { term: "uymuyor", matchMode: "prefix" },
      { term: "uyumsu", matchMode: "prefix" },
      { term: "uygulamiyor", matchMode: "token" },
      { term: "talimatlara uyma", matchMode: "substring" },
    ],
    dimensions: ["patient_rights", "professional_ethics"],
  },
  {
    terms: [
      { term: "komplikasyon", matchMode: "token" },
      { term: "malpraktis", matchMode: "token" },
      { term: "hata", matchMode: "token" },
      { term: "kusur", matchMode: "token" },
      { term: "ozen", matchMode: "token" },
      { term: "tazminat", matchMode: "token" },
      { term: "sorumlu", matchMode: "token" },
    ],
    dimensions: ["professional_ethics", "civil_compensation"],
  },
  {
    terms: [
      { term: "acil durum", matchMode: "substring" },
      { term: "acil degil", matchMode: "substring" },
      { term: "acil mudehale", matchMode: "substring" },
    ],
    dimensions: ["professional_ethics", "patient_rights"],
  },
  // ── T17.2: Branch-specific term mappings ──────────────────────────────────
  {
    terms: [
      { term: "acil servis", matchMode: "substring" },
      { term: "acil tip", matchMode: "substring" },
    ],
    dimensions: ["emergency_services", "professional_ethics"],
  },
  {
    terms: [
      { term: "anestezi", matchMode: "token" },
      { term: "anestezist", matchMode: "token" },
    ],
    dimensions: ["professional_ethics", "patient_rights"],
  },
  {
    terms: [
      { term: "radyoloji", matchMode: "token" },
      { term: "radyolog", matchMode: "token" },
      { term: "radyasyon", matchMode: "token" },
    ],
    dimensions: ["patient_rights", "professional_ethics"],
  },
];

export function classifyMedicalLegalQuestion(question: string): ClassifiedMedicalLegalQuestion {
  const normalized = question.toLocaleLowerCase("tr-TR");
  const foldedNormalized = foldTr(normalized);
  const tokens = tokenizeTr(question).map(foldTr);
  const dimensions = new Set<LegalDimension>();
  const searchTerms = new Set<string>();

  for (const mapping of termDimensions) {
    for (const rule of mapping.terms) {
      // For substring mode, pass the full folded normalized text
      const text = rule.matchMode === "substring" ? foldedNormalized : undefined;
      if (matchesTermTr(tokens, rule.term, rule.matchMode, rule.blockedPrefixes, rule.allowedTokens, text)) {
        mapping.dimensions.forEach((dimension) => dimensions.add(dimension));
        searchTerms.add(rule.term);
      }
    }
  }

  const isFallback = dimensions.size === 0;

  if (isFallback) {
    dimensions.add("professional_ethics");
    dimensions.add("patient_rights");
  }

  return {
    question,
    dimensions: [...dimensions],
    searchTerms: [...searchTerms],
    classificationConfidence: isFallback ? "fallback" : "matched",
    missingInformation: [
      "Mudahalenin turu, tarihi ve aciliyet durumu",
      "Hangi resmi kayitlarin mevcut oldugu",
      "Sorunun ceza, tazminat, idari veya mahremiyet boyutundan hangisine odaklandigi"
    ]
  };
}
