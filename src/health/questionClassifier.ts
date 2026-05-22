import type {
  ClassifiedMedicalLegalQuestion,
  LegalDimension
} from "../contracts/legal.js";

const termDimensions: Array<{ terms: string[]; dimensions: LegalDimension[] }> = [
  { terms: ["riza", "rıza", "onam", "aydinlat", "aydınlat"], dimensions: ["patient_rights", "civil_compensation"] },
  { terms: ["veri", "kvkk", "saglik verisi", "sağlık verisi", "sosyal medya", "paylaşım", "paylasim"], dimensions: ["privacy_kvkk", "patient_rights"] },
  { terms: ["mahrem", "mahremiyet", "sir", "sır", "gizlilik", "kayit", "kayıt", "epikriz", "rapor", "dosya", "arsiv", "arşiv"], dimensions: ["patient_rights"] },
  { terms: ["ceza", "taksir", "yaralama"], dimensions: ["criminal"] },
  { terms: ["disiplin", "idari", "sorusturma"], dimensions: ["disciplinary_administrative"] },
  { terms: ["etik", "meslek", "acil", "sevk", "nobet", "nöbet"], dimensions: ["professional_ethics", "patient_rights"] },
  { terms: ["hekim", "tibbi", "tıbbi", "mudahale", "müdahale"], dimensions: ["patient_rights"] },
  { terms: ["redde", "reddet", "kabul etme", "iliskisini sonlandir", "ilişkisini sonlandır", "tedaviyi birak", "tedaviyi bırak", "tedaviyi sonlandir", "kacinma", "kaçınma", "bakmama"], dimensions: ["professional_ethics", "civil_compensation"] },
  { terms: ["uymuyor", "uyumsu", "uygulamıyor", "uygulamiyor", "talimatlara uyma", "talimatlara uyulma"], dimensions: ["patient_rights", "professional_ethics"] },
  { terms: ["komplikasyon", "malpraktis", "hata", "kusur", "özen", "ozen", "tazminat", "sorumluluk"], dimensions: ["professional_ethics", "civil_compensation"] },
  { terms: ["acil durum", "acil degil", "acil değil", "acil mudehale"], dimensions: ["professional_ethics", "patient_rights"] }
];

export function classifyMedicalLegalQuestion(question: string): ClassifiedMedicalLegalQuestion {
  const normalized = question.toLocaleLowerCase("tr-TR");
  const dimensions = new Set<LegalDimension>();
  const searchTerms = new Set<string>();

  for (const mapping of termDimensions) {
    for (const term of mapping.terms) {
      if (normalized.includes(term)) {
        mapping.dimensions.forEach((dimension) => dimensions.add(dimension));
        searchTerms.add(term);
      }
    }
  }

  if (dimensions.size === 0) {
    dimensions.add("professional_ethics");
    dimensions.add("patient_rights");
  }

  return {
    question,
    dimensions: [...dimensions],
    searchTerms: [...searchTerms],
    missingInformation: [
      "Mudahalenin turu, tarihi ve aciliyet durumu",
      "Hangi resmi kayitlarin mevcut oldugu",
      "Sorunun ceza, tazminat, idari veya mahremiyet boyutundan hangisine odaklandigi"
    ]
  };
}
