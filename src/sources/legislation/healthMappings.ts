import type { HealthLegislationHint } from "./liveTypes.js";

// ── v0.29.0 newly verified legislation ───────────────────────────────────────
// All sourceIds confirmed via live mevzuat.gov.tr search (score 1.000).

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

const aileHekimligi = {
  query: "Aile Hekimliği Kanunu",
  title: "Aile Hekimligi Kanunu",
  sourceId: "mevzuat:1.5.5258",
  legislationNumber: "5258",
  legislationType: "1",
  legislationArrangement: "5"
} as const;

const isSagligiGuvenligi = {
  query: "İş Sağlığı ve Güvenliği Kanunu",
  title: "Is Sagligi ve Guvenligi Kanunu",
  sourceId: "mevzuat:1.5.6331",
  legislationNumber: "6331",
  legislationType: "1",
  legislationArrangement: "5"
} as const;

const organDokuNakli = {
  query: "organ nakli 2238",
  title: "Organ ve Doku Nakli Kanunu",
  sourceId: "mevzuat:1.5.2238",
  legislationNumber: "2238",
  legislationType: "1",
  legislationArrangement: "5"
} as const;

const uyteTedavi = {
  query: "üremeye yardımcı tedavi",
  title: "Uremeye Yardimci Tedavi Yonetmeligi",
  sourceId: "mevzuat:7.5.20085",
  legislationNumber: "20085",
  legislationType: "7",
  legislationArrangement: "5"
} as const;

const getat = {
  query: "GETAT geleneksel tamamlayıcı tıp",
  title: "Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi",
  sourceId: "mevzuat:7.5.45117",
  legislationNumber: "45117",
  legislationType: "7",
  legislationArrangement: "5"
} as const;

const saglikMeslek = {
  query: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
  title: "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
  sourceId: "mevzuat:7.5.19696",
  legislationNumber: "19696",
  legislationType: "7",
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
    terms: ["hasta mahremiyeti", "mahremiyet", "mahrem", "kişisel sağlık verisi", "kisisel saglik verisi", "sağlık verisi", "saglik verisi"],
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
  },
  // --- professional_scope_of_practice cluster ---
  // Tababet Kanunu Art. 1 & 25: who may practise medicine and permissible acts.
  // Art. 25 (ücreti belirleme / yasaklar) da mesleki sınır konuları için kullanılır.
  {
    ...tababet,
    topicCluster: "professional_scope_of_practice",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason:
      "Hekimlik yetkisi, uzmanlık sınırları ve mesleki faaliyet kapsamı Tababet Kanunu md.1 ve md.25 ile çerçevelenir.",
    terms: [
      "uzmanlik siniri", "uzmanlık sınırı", "uzman disinda", "uzman dışında",
      "yetki siniri", "yetki sınırı", "meslek siniri", "meslek sınırı",
      "bransim disinda", "branşım dışında", "uzmanlik alani", "uzmanlık alanı",
      "tabip yetki", "hekim yetki"
    ],
    articleNumbers: ["1", "25"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },
  // Saglik Hizmetleri Temel Kanunu: health service delivery scope and discipline framework.
  {
    ...healthServices,
    topicCluster: "professional_scope_of_practice",
    legislationRole: "supporting_general",
    healthLawPriority: 30,
    selectionReason:
      "Sağlık Hizmetleri Temel Kanunu md.3 ve md.9, hizmet kapsamı ve mesleki denetim çerçevesini destekler.",
    terms: [
      "uzmanlik siniri", "uzmanlık sınırı", "uzman disinda", "uzman dışında",
      "yetki siniri", "yetki sınırı", "meslek siniri", "meslek sınırı",
      "saglik personeli gorevi", "sağlık personeli görevi",
      "hekim yetki", "tabip yetki"
    ],
    articleNumbers: ["3", "9"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },
  // --- private_health_facility cluster ---
  // Sağlık Hizmetleri Temel Kanunu governs private facility authorisation and obligations.
  // Tababet Kanunu Art. 1: licensing requirements apply to physicians in private settings too.
  {
    ...healthServices,
    topicCluster: "private_health_facility",
    legislationRole: "health_primary",
    healthLawPriority: 10,
    selectionReason:
      "Özel sağlık kuruluşlarının hizmet koşulları, yetkilendirme ve denetimi Sağlık Hizmetleri Temel Kanunu kapsamındadır.",
    terms: [
      "ozel hastane", "özel hastane", "ozel saglik kurulusu", "özel sağlık kuruluşu",
      "ozel klinik", "özel klinik", "muayenehane", "poliklinik",
      "ozel saglik", "özel sağlık", "saglik kurulusu rutbesi", "sağlık kuruluşu"
    ],
    articleNumbers: ["1", "3", "9"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },
  {
    ...tababet,
    topicCluster: "private_health_facility",
    legislationRole: "supporting_general",
    healthLawPriority: 20,
    selectionReason:
      "Tababet Kanunu md.1: lisans şartları özel kuruluşta çalışan hekimler için de geçerlidir.",
    terms: [
      "ozel hastane", "özel hastane", "ozel saglik kurulusu", "özel sağlık kuruluşu",
      "ozel klinik", "özel klinik", "muayenehane"
    ],
    articleNumbers: ["1"],
    dimensions: ["professional_ethics"]
  },

  // ── v0.29.0: newly verified legislation (sourceIds confirmed via live search) ─────

  // Aile Hekimliği Kanunu (5258) — family medicine scope of practice
  {
    ...aileHekimligi,
    topicCluster: "professional_scope_of_practice",
    legislationRole: "supporting_general",
    healthLawPriority: 60,
    selectionReason:
      "Aile Hekimliği Kanunu md.3 ve md.8: birinci basamak hekim görevleri ve uygulama kapsamı.",
    terms: [
      "aile hekimi", "aile hekimliği", "birinci basamak", "pratisyen hekim"
    ],
    articleNumbers: ["3", "8"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },

  // İş Sağlığı ve Güvenliği Kanunu (6331) — occupational medicine scope
  {
    ...isSagligiGuvenligi,
    topicCluster: "professional_scope_of_practice",
    legislationRole: "supporting_general",
    healthLawPriority: 65,
    selectionReason:
      "İSG Kanunu md.8: işyeri hekiminin görev, yetki ve sorumlulukları; mesleki bağımsızlık güvencesi.",
    terms: [
      "işyeri hekimi", "is yeri hekimi", "iş sağlığı", "is sagligi", "6331",
      "işyeri sağlık", "mesleki bağımsızlık"
    ],
    articleNumbers: ["8", "9"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },

  // Organ ve Doku Nakli Kanunu (2238) — organ donation consent
  {
    ...organDokuNakli,
    topicCluster: "informed_consent",
    legislationRole: "supporting_general",
    healthLawPriority: 70,
    selectionReason:
      "Organ Nakli Kanunu md.6 ve md.14: organ bağışında rıza şartları ve donörün aydınlatılması.",
    terms: [
      "organ nakli", "organ bağışı", "doku nakli", "2238", "donör rızası", "beyin ölümü"
    ],
    articleNumbers: ["6", "14"],
    dimensions: ["patient_rights", "professional_ethics"]
  },

  {
    ...organDokuNakli,
    topicCluster: "medical_intervention",
    legislationRole: "supporting_general",
    healthLawPriority: 75,
    selectionReason:
      "Organ Nakli Kanunu md.9: nakil operasyonunda hekim yetkileri ve müdahale sınırları.",
    terms: [
      "organ nakli operasyonu", "nakil cerrahisi", "doku alinmasi", "doku alınması"
    ],
    articleNumbers: ["9"],
    dimensions: ["professional_ethics", "civil_compensation"]
  },

  // ÜYTE Yönetmeliği (mevzuat:7.5.20085) — ART consent and procedure rules
  {
    ...uyteTedavi,
    topicCluster: "informed_consent",
    legislationRole: "supporting_general",
    healthLawPriority: 80,
    selectionReason:
      "ÜYTE Yönetmeliği: yardımcı üreme teknolojisi prosedürlerinde detaylı aydınlatma ve rıza zorunluluğu.",
    terms: [
      "tüp bebek", "IVF", "üremeye yardımcı", "ÜYTE", "embriyo", "yumurta bağışı"
    ],
    articleNumbers: ["10", "11"],
    dimensions: ["patient_rights", "professional_ethics"]
  },

  {
    ...uyteTedavi,
    topicCluster: "medical_intervention",
    legislationRole: "supporting_general",
    healthLawPriority: 85,
    selectionReason:
      "ÜYTE Yönetmeliği: yardımcı üreme merkezlerinde tıbbi müdahale standartları.",
    terms: [
      "tüp bebek prosedürü", "IVF işlemi", "üremeye yardımcı tedavi merkezi"
    ],
    articleNumbers: ["5", "12"],
    dimensions: ["professional_ethics"]
  },

  // GETAT Yönetmeliği (mevzuat:7.5.45117) — complementary/traditional medicine scope
  {
    ...getat,
    topicCluster: "professional_scope_of_practice",
    legislationRole: "supporting_general",
    healthLawPriority: 90,
    selectionReason:
      "GETAT Yönetmeliği: geleneksel ve tamamlayıcı tıp uygulamalarında hekim yetki sınırları.",
    terms: [
      "GETAT", "geleneksel tıp", "tamamlayıcı tıp", "akupunktur", "fitoterapi",
      "ozon terapi", "hipnoterapi", "geleneksel ve tamamlayıcı"
    ],
    articleNumbers: ["5", "7"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },

  // ── v0.31.0: Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği ──────
  // SourceId mevzuat:7.5.19696 verified by direct PDF fetch from mevzuat.gov.tr.
  {
    ...saglikMeslek,
    topicCluster: "professional_scope_of_practice",
    legislationRole: "health_primary",
    healthLawPriority: 5,
    selectionReason:
      "İş ve görev tanımları yönetmeliği: hekim yardımcı sağlık personelinin yetki sınırlarını, ekip hizmeti kurallarını ve branş dışı uygulama yasaklarını doğrudan düzenler.",
    terms: [
      "görev tanımı", "iş tanımı", "gorev tanimi",
      "yetki sınırı", "yetki siniri", "branş dışı", "brans disi",
      "ekip hizmeti", "yardımcı sağlık personeli",
      "yardimci saglik", "gorevlendirme"
    ],
    articleNumbers: ["5", "6", "7", "8"],
    dimensions: ["professional_ethics", "disciplinary_administrative"]
  },
  {
    ...saglikMeslek,
    topicCluster: "professional_ethics",
    legislationRole: "supporting_general",
    healthLawPriority: 50,
    selectionReason:
      "Görev tanımı ihlalleri disiplin sürecini tetikler; yönetmelik yetki aşımı ve usulsüz uygulama yasakları bağlamında destekleyici kaynak.",
    terms: [
      "yetki aşımı", "yetki asimi", "görev ihlali", "gorev ihlali",
      "usulsüz uygulama", "usulsuz uygulama", "disiplin"
    ],
    articleNumbers: ["12", "13"],
    dimensions: ["disciplinary_administrative", "professional_ethics"]
  },

  // ── v0.44.0: Public employment and discipline legislation ──────────────────
  // T8.1 — 6 new public-employment/discipline entries

  // Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği
  // sourceId: mevzuat:7.5.17232 (from ROADMAP; needs live verification)
  {
    topicCluster: "public_employment" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 30,
    selectionReason: "Kamu hekiminin tayin ve atama işlemleri bu yönetmeliğe tabidir.",
    terms: ["tayin", "atama", "yer değiştirme", "yer degistirme", "nakil", "mazeret"],
    query: "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği",
    title: "Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği",
    sourceId: "mevzuat:7.5.17232",
    legislationNumber: "17232",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["5", "8"],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // sourceId needs_manual_review — use live search to confirm
  // Search query: "Görevde Yükselme ve Unvan Değişikliği Yönetmeliği"
  {
    topicCluster: "public_employment" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 35,
    selectionReason: "Kamu sağlık personelinin terfi ve unvan değişikliği bu yönetmelikle düzenlenir.",
    terms: ["görevde yükselme", "unvan değişikliği", "gorevde yukselme", "terfi", "kadro"],
    query: "Görevde Yükselme ve Unvan Değişikliği Yönetmeliği",
    title: "Sağlık Bakanlığı Personeli Görevde Yükselme ve Unvan Değişikliği Yönetmeliği",
    sourceId: "needs_manual_review:gorevde-yukselme",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["3", "5"],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // sourceId needs_manual_review — use live search to confirm
  // Search query: "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği"
  {
    topicCluster: "disciplinary_administrative" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 25,
    selectionReason: "Sağlık Bakanlığı'nda disiplin soruşturmaları ve disiplin amirlerinin görevleri bu yönetmelikle düzenlenir.",
    terms: ["disiplin amiri", "disiplin soruşturması", "disiplin cezası", "soruşturma izni", "disiplin kurulu"],
    query: "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği",
    title: "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği",
    sourceId: "needs_manual_review:disiplin-amirleri",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["4", "7"],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // sourceId needs_manual_review — use live search to confirm
  // Search query: "Sözleşmeli Sağlık Personeli Disiplin"
  {
    topicCluster: "disciplinary_administrative" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 32,
    selectionReason: "Sözleşmeli sağlık personeline ilişkin disiplin usul ve esasları bu yönetmelikte düzenlenir.",
    terms: ["sözleşmeli personel disiplin", "sözleşmeli sağlık disiplin", "disiplin kurulu sözleşmeli"],
    query: "Sözleşmeli Sağlık Personeli Disiplin",
    title: "Sözleşmeli Sağlık Personeli Disiplin ile Disiplin Kurulları Hakkında Yönetmelik",
    sourceId: "needs_manual_review:sozlesmeli-disiplin",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["5", "8"],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // sourceId needs_manual_review — use live search to confirm
  // Search query: "4924 sayılı Kanuna Tabi Sözleşmeli Sağlık"
  {
    topicCluster: "transfer_assignment" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 28,
    selectionReason: "4924 sayılı kanuna tabi sözleşmeli sağlık personelinin atama ve yer değiştirme usulleri bu yönetmelikle düzenlenir.",
    terms: ["4924", "sözleşmeli atama", "sözleşmeli yer değiştirme", "sözleşmeli tayin"],
    query: "4924 sayılı Kanuna Tabi Sözleşmeli Sağlık",
    title: "4924 sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Atama ve Yer Değiştirme Yönetmeliği",
    sourceId: "needs_manual_review:4924-sozlesmeli",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["6", "10"],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // sourceId needs_manual_review — use live search to confirm
  // Search query: "Açıktan Kura ile Atanacak Sağlık Personeli"
  {
    topicCluster: "public_employment" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 38,
    selectionReason: "Kamu kurumlarına açıktan kura ile atanacak bazı sağlık personelinin atama esasları bu yönetmelikte düzenlenir.",
    terms: ["açıktan kura", "kura ile atama", "sağlık personeli atama", "kamu kurum atama"],
    query: "Açıktan Kura ile Atanacak Sağlık Personeli",
    title: "Kamu Kurum ve Kuruluşlarına Açıktan Kura ile Atanacak Bazı Sağlık Personelinin Atama Esas ve Usulleri Yönetmeliği",
    sourceId: "needs_manual_review:aciktan-kura",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["3", "5"],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // ── T8.3: Education / Service Quality / Financial / Clinical-Forensic ──────

  // Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği (TUEY)
  // sourceId: mevzuat:7.5.39700 (from ROADMAP; needs live verification)
  {
    topicCluster: "medical_education" as any,
    legislationRole: "health_primary" as any,
    healthLawPriority: 32,
    selectionReason: "Uzmanlık eğitimi, asistan hakları ve eğitim süreci bu yönetmelikle düzenlenir.",
    terms: ["tuey", "uzmanlık", "ihtisas", "asistan", "asistanlık", "tıpta uzmanlık"],
    query: "Tıpta Uzmanlık Eğitimi Yönetmeliği",
    title: "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği",
    sourceId: "needs_manual_review:tuey",
    legislationNumber: "39700",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: [],
    dimensions: ["professional_ethics"] as any
  } as any,

  // Sağlık Uzmanlığı Yönetmeliği
  // sourceId needs_manual_review — use live search to confirm
  // Search query: "Sağlık Uzmanlığı Yönetmeliği"
  {
    topicCluster: "medical_education" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 40,
    selectionReason: "Sağlık dışı hekim uzmanlık alanlarında eğitim süreci bu yönetmelikle düzenlenir.",
    terms: ["sağlık uzmanlığı", "uzmanlık yönetmeliği", "sağlık uzmanı"],
    query: "Sağlık Uzmanlığı Yönetmeliği",
    title: "Sağlık Uzmanlığı Yönetmeliği",
    sourceId: "needs_manual_review:saglik-uzmanligi",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: [],
    dimensions: ["professional_ethics"] as any
  } as any,

  // Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik
  // sourceId needs_manual_review — RG 06.04.2011 / 27897
  {
    topicCluster: "patient_safety" as any,
    legislationRole: "health_primary" as any,
    healthLawPriority: 20,
    selectionReason: "Hasta ve çalışan güvenliği standartları, kaza önleme ve olay bildirme usulleri bu yönetmelikle düzenlenir.",
    terms: ["hasta güvenliği", "çalışan güvenliği", "kazanın önlenmesi", "olay bildirimi", "güvenlik culture"],
    query: "Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik",
    title: "Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik",
    sourceId: "needs_manual_review:hasta-calisan-guvenligi",
    legislationNumber: "27897",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: [],
    dimensions: ["patient_rights"] as any
  } as any,

  // Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik
  // sourceId needs_manual_review — use live search to confirm
  {
    topicCluster: "healthcare_quality" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 35,
    selectionReason: "Sağlık hizmeti kalite geliştirme ve değerlendirme standartları bu yönetmelikle düzenlenir.",
    terms: ["kalite geliştirme", "kalite değerlendirme", "sağlık kalitesi", "kalite standartları"],
    query: "Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik",
    title: "Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik",
    sourceId: "needs_manual_review:saglik-kalitesi",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: [],
    dimensions: ["patient_rights"] as any
  } as any,

  // Ek Ödeme Yönetmeliği
  // sourceId needs_manual_review — use live search to confirm
  {
    topicCluster: "public_employment" as any,
    legislationRole: "supporting_general" as any,
    healthLawPriority: 35,
    selectionReason: "Kamu hekimlerinin ek ödeme ve performans hakları bu yönetmelikle belirlenir.",
    terms: ["ek ödeme", "ek odeme", "performans", "döner sermaye", "doner sermaye"],
    query: "Ek Ödeme Yönetmeliği Sağlık Tesisleri",
    title: "Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği",
    sourceId: "needs_manual_review:ek-odeme",
    legislationNumber: "",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: [],
    dimensions: ["disciplinary_administrative"] as any
  } as any,

  // Umumi Hıfzıssıhha Kanunu (1593) — kanun katmanı
  // sourceId: mevzuat:1.3.1593 (from ROADMAP; needs live verification)
  {
    topicCluster: "public_health" as any,
    legislationRole: "health_primary" as any,
    healthLawPriority: 25,
    selectionReason: "Umumi hıfzıssıhha, salgın hastalık ve karantina tedbirleri bu kanunla düzenlenir.",
    terms: ["hıfzıssıhha", "umumi hıfzıssıhha", "salgın", "karantina", "bulaşıcı hastalık", "aşı zorunluluğu"],
    query: "Umumi Hıfzıssıhha Kanunu",
    title: "Umumi Hıfzıssıhha Kanunu",
    sourceId: "needs_manual_review:hifzissihha",
    legislationNumber: "1593",
    legislationType: "1",
    legislationArrangement: "3",
    articleNumbers: [],
    dimensions: ["disciplinary_administrative"] as any
  } as any
];
