import type {
  ClassifiedMedicalLegalQuestion,
  LegalDimension
} from "../contracts/legal.js";

const termDimensions: Array<{ terms: string[]; dimensions: LegalDimension[] }> = [
  { terms: ["riza", "rıza", "onam", "aydinlat", "aydınlat"], dimensions: ["patient_rights", "civil_compensation"] },
  { terms: ["veri", "mahrem", "kvkk", "kayit", "kayıt", "saglik verisi", "sağlık verisi"], dimensions: ["privacy_kvkk", "patient_rights"] },
  { terms: ["ceza", "taksir", "yaralama"], dimensions: ["criminal"] },
  { terms: ["disiplin", "idari", "sorusturma"], dimensions: ["disciplinary_administrative"] },
  { terms: ["etik", "meslek"], dimensions: ["professional_ethics"] },
  { terms: ["hekim", "tibbi", "tıbbi", "mudahale", "müdahale"], dimensions: ["patient_rights"] }
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
