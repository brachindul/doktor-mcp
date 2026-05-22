import type { HealthLegislationHint } from "./liveTypes.js";

const patientRights = {
  query: "Hasta Haklari Yonetmeligi",
  title: "Hasta Haklari Yonetmeligi",
  sourceId: "mevzuat:7.5.4847",
  legislationNumber: "4847",
  legislationType: "7",
  legislationArrangement: "5"
} as const;

const deontology = {
  query: "deontoloji nizamnamesi",
  title: "Tibbi Deontoloji Nizamnamesi",
  sourceId: "mevzuat:2.3.412578",
  legislationNumber: "412578",
  legislationType: "2",
  legislationArrangement: "3"
} as const;

const tababet = {
  query: "1219",
  title: "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun",
  sourceId: "mevzuat:1.3.1219",
  legislationNumber: "1219",
  legislationType: "1",
  legislationArrangement: "3"
} as const;

const healthServices = {
  query: "3359",
  title: "Saglik Hizmetleri Temel Kanunu",
  sourceId: "mevzuat:1.5.3359",
  legislationNumber: "3359",
  legislationType: "1",
  legislationArrangement: "5"
} as const;

const kvkk = {
  query: "Kisisel Verilerin Korunmasi Kanunu",
  title: "Kisisel Verilerin Korunmasi Kanunu",
  sourceId: "mevzuat:1.5.6698",
  legislationNumber: "6698",
  legislationType: "1",
  legislationArrangement: "5"
} as const;

export const healthLegislationHints: HealthLegislationHint[] = [
  {
    ...patientRights,
    topicCluster: "informed_consent",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason: "Patient Rights regulation directly governs informed consent and consent forms.",
    terms: ["riza", "rıza", "onam", "aydinlat", "aydınlat"],
    articleNumbers: ["24", "26"],
    dimensions: ["patient_rights", "civil_compensation", "disciplinary_administrative"]
  },
  {
    ...patientRights,
    topicCluster: "medical_intervention",
    legislationRole: "health_primary",
    healthLawPriority: 12,
    selectionReason: "Medical intervention questions first map to the patient-rights consent provisions.",
    terms: ["tibbi mudahale", "tıbbi müdahale", "mudahale", "müdahale"],
    articleNumbers: ["24", "31"],
    dimensions: ["patient_rights", "civil_compensation"]
  },
  {
    ...patientRights,
    topicCluster: "patient_rights",
    legislationRole: "health_primary",
    healthLawPriority: 14,
    selectionReason: "Patient-rights wording selects the dedicated patient-rights regulation.",
    terms: ["hasta haklari", "hasta hakları", "hasta hakkı"],
    articleNumbers: ["15", "24"],
    dimensions: ["patient_rights"]
  },
  {
    ...patientRights,
    topicCluster: "patient_privacy",
    legislationRole: "health_primary",
    healthLawPriority: 16,
    selectionReason: "Patient privacy in care is addressed by the patient-rights regulation before general data law.",
    terms: ["hasta mahremiyeti", "mahremiyet", "mahrem"],
    articleNumbers: ["21"],
    dimensions: ["patient_rights", "privacy_kvkk"]
  },
  {
    ...patientRights,
    topicCluster: "records_epicrisis",
    legislationRole: "health_primary",
    healthLawPriority: 18,
    selectionReason: "Record and epicrisis questions map to patient access and record provisions.",
    terms: ["kayit", "kayıt", "dosya", "epikriz"],
    articleNumbers: ["16", "17"],
    dimensions: ["patient_rights", "disciplinary_administrative"]
  },
  {
    ...patientRights,
    topicCluster: "emergency_intervention",
    legislationRole: "health_primary",
    healthLawPriority: 20,
    selectionReason: "Emergency intervention questions retain the patient-rights emergency consent exception.",
    terms: ["acil mudahale", "acil müdahale", "acil"],
    articleNumbers: ["24"],
    dimensions: ["patient_rights", "civil_compensation"]
  },
  {
    ...patientRights,
    topicCluster: "referral_consultation",
    legislationRole: "health_primary",
    healthLawPriority: 22,
    selectionReason: "Referral and consultation language starts with patient-rights information and referral context.",
    terms: ["sevk", "konsultasyon", "konsültasyon"],
    articleNumbers: ["15", "19"],
    dimensions: ["patient_rights"]
  },
  {
    ...deontology,
    topicCluster: "physician_duty_of_care",
    legislationRole: "health_primary",
    healthLawPriority: 30,
    selectionReason: "Physician care and scientific diligence are expressly framed in medical deontology duties.",
    terms: ["hekim yukumlulugu", "hekim yükümlülüğü", "ozen", "özen", "ihtimam"],
    articleNumbers: ["2", "13", "14"],
    dimensions: ["professional_ethics", "civil_compensation"]
  },
  {
    ...deontology,
    topicCluster: "professional_ethics",
    legislationRole: "health_primary",
    healthLawPriority: 32,
    selectionReason: "Professional ethics and emergency first aid duties map to Medical Deontology rules.",
    terms: ["meslek etigi", "meslek etiği", "etik", "acil mudahale", "acil müdahale"],
    articleNumbers: ["2", "3", "4"],
    dimensions: ["professional_ethics", "patient_rights", "privacy_kvkk"]
  },
  {
    ...tababet,
    topicCluster: "medical_intervention",
    legislationRole: "health_primary",
    healthLawPriority: 40,
    selectionReason: "The core practice statute supports questions about who may practise medicine and treat patients.",
    terms: ["tababet", "hekimlik icrasi", "hekimlik icrası", "tibbi mudahale", "tıbbi müdahale"],
    articleNumbers: ["1"],
    dimensions: ["professional_ethics", "patient_rights"]
  },
  {
    ...healthServices,
    topicCluster: "patient_rights",
    legislationRole: "health_primary",
    healthLawPriority: 50,
    selectionReason: "The health services framework is a secondary health-law source for service organization questions.",
    terms: ["saglik hizmeti", "sağlık hizmeti", "hasta haklari", "hasta hakları"],
    articleNumbers: ["1", "3"],
    dimensions: ["patient_rights", "disciplinary_administrative"]
  },
  {
    ...deontology,
    topicCluster: "physician_refusal_or_withdrawal",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason: "Physician's right to refuse or withdraw from a case is regulated strictly by Medical Deontology rules (e.g. Article 18, 19).",
    terms: ["redde", "reddet", "kabul etme", "iliskisini sonlandir", "ilişkisini sonlandır", "tedaviyi birak", "tedaviyi bırak", "tedaviyi sonlandir", "kacinma", "kaçınma", "bakmama"],
    articleNumbers: ["18", "19"],
    dimensions: ["professional_ethics", "civil_compensation"]
  },
  {
    ...tababet,
    topicCluster: "physician_refusal_or_withdrawal",
    legislationRole: "health_primary",
    healthLawPriority: 20,
    selectionReason: "The core practice statute governs the physician's duties when practicing or withdrawing.",
    terms: ["redde", "reddet", "kabul etme", "iliskisini sonlandir", "ilişkisini sonlandır", "tedaviyi birak", "tedaviyi bırak", "tedaviyi sonlandir", "kacinma", "kaçınma", "bakmama"],
    articleNumbers: ["1"],
    dimensions: ["professional_ethics", "civil_compensation"]
  },
  {
    ...patientRights,
    topicCluster: "physician_refusal_or_withdrawal",
    legislationRole: "supporting_general",
    healthLawPriority: 40,
    selectionReason: "Patient rights provides a counter-balance but is not the primary law governing physician's right to refuse.",
    terms: ["redde", "reddet", "kabul etme", "iliskisini sonlandir", "ilişkisini sonlandır", "tedaviyi birak", "tedaviyi bırak", "tedaviyi sonlandir", "kacinma", "kaçınma", "bakmama"],
    articleNumbers: ["5"],
    dimensions: ["patient_rights"]
  },
  {
    ...deontology,
    topicCluster: "patient_noncompliance",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason: "Patient noncompliance directly triggers ethical duties and refusal rights under Deontology rules.",
    terms: ["uymuyor", "uyumsu", "uygulamıyor", "uygulamiyor", "talimatlara uyma", "talimatlara uyulma"],
    articleNumbers: ["19"],
    dimensions: ["professional_ethics", "patient_rights"]
  },
  {
    ...healthServices,
    topicCluster: "patient_noncompliance",
    legislationRole: "health_primary",
    healthLawPriority: 30,
    selectionReason: "Health Services basic law sets the framework for patient-physician cooperation.",
    terms: ["uymuyor", "uyumsu", "uygulamıyor", "uygulamiyor", "talimatlara uyma", "talimatlara uyulma"],
    articleNumbers: ["3"],
    dimensions: ["professional_ethics"]
  },
  {
    ...deontology,
    topicCluster: "physician_patient_relationship_termination",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason: "Termination of the physician-patient relationship is an ethical/duty matter primarily under Deontology rules.",
    terms: ["iliskisini sonlandir", "ilişkisini sonlandır", "tedaviyi sonlandir", "tedaviyi bırak"],
    articleNumbers: ["18", "19"],
    dimensions: ["professional_ethics", "civil_compensation"]
  },
  {
    ...patientRights,
    topicCluster: "emergency_exception",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason: "Emergency exceptions for intervention consent map to patient rights first.",
    terms: ["acil durum", "acil degil", "acil değil", "acil mudehale"],
    articleNumbers: ["24"],
    dimensions: ["patient_rights", "professional_ethics"]
  },
  {
    ...deontology,
    topicCluster: "emergency_exception",
    legislationRole: "health_primary",
    healthLawPriority: 15,
    selectionReason: "Emergency duty of care is mandated by Deontology rules.",
    terms: ["acil durum", "acil degil", "acil değil", "acil mudehale"],
    articleNumbers: ["3", "18"],
    dimensions: ["professional_ethics"]
  },
  {
    ...tababet,
    topicCluster: "emergency_exception",
    legislationRole: "health_primary",
    healthLawPriority: 20,
    selectionReason: "Emergency treatment obligations are enforced by core practice law.",
    terms: ["acil durum", "acil degil", "acil değil", "acil mudehale"],
    articleNumbers: ["3"],
    dimensions: ["professional_ethics"]
  },
  {
    ...kvkk,
    topicCluster: "personal_health_data",
    legislationRole: "supporting_general",
    healthLawPriority: 90,
    selectionReason: "KVKK is supporting general law only for personal health data and privacy questions.",
    terms: ["kisisel saglik verisi", "kişisel sağlık verisi", "saglik verisi", "sağlık verisi", "kvkk"],
    articleNumbers: ["6"],
    dimensions: ["privacy_kvkk", "patient_rights"]
  }
];
