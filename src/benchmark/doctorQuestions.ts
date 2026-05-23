export interface BenchmarkQuestion {
  id: string;
  category: string;
  question: string;
  expectedTopicClusters: string[];
  expectedPrimaryLegislationRoles: Record<string, "health_primary" | "supporting_general">;
  expectedPrimaryLegislationNames: string[];
  expectedLegislationHints?: string[];
  shouldIncludeLegislation: string[];
  shouldNotIncludeLegislation: string[];
  expectedPrecedentSources: string[];
  forbiddenFields: string[];
  notes: string;
}

export const FORBIDDEN_FIELDS_LIST = [
  "riskLevel",
  "immediateActions",
  "finalLegalOpinion",
  "riskSeviyesi",
  "derhalYapilacaklar",
  "kesinHukukiKanaat",
  "dilekseTaslagi",
  "dilekçe/savunma taslağı",
  "dilekçe taslağı",
  "savunma taslağı"
];

export const doctorQuestions: BenchmarkQuestion[] = [
  {
    id: "refusal-noncompliance",
    category: "tedaviye uymayan hasta / hastayı reddetme",
    question: "Hasta verdiğim tedaviyi uygulamıyor, ben bu hastayı bir sonraki ziyaretinde reddedeceğim, bu konuyu araştır.",
    expectedTopicClusters: ["physician_refusal_or_withdrawal", "patient_noncompliance"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": "health_primary",
      "Hasta Haklari Yonetmeligi": "supporting_general"
    },
    expectedPrimaryLegislationNames: [
      "Tibbi Deontoloji Nizamnamesi",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"
    ],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi", "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires physician-centric deontology and practice act to take priority over patient rights. KVKK must not be included."
  },
  {
    id: "informed-consent-lack",
    category: "aydınlatılmış rıza eksikliği",
    question: "Ameliyat öncesi aydınlatılmış rıza formunu hastaya imzalatmayı unutmuşuz. Bu durum bir malpraktis davasında aydınlatma yükümlülüğü ihlali / rıza eksikliği olarak aleyhimize nasıl kullanılır?",
    expectedTopicClusters: ["informed_consent", "medical_intervention"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Focuses on patient's consent and lack of informed consent documentation. Patient rights regulation is primary."
  },
  {
    id: "emergency-intervention-duty",
    category: "acil serviste müdahale yükümlülüğü",
    question: "Acil serviste nöbetçiyim. Gelen acil hastaya ilk müdahaleyi yapmak zorunda mıyım, yoksa başka bir hastaneye sevk edebilir miyim?",
    expectedTopicClusters: ["emergency_exception", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary",
      "Hasta Haklari Yonetmeligi": "health_primary",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": "health_primary"
    },
    expectedPrimaryLegislationNames: [
      "Tibbi Deontoloji Nizamnamesi",
      "Hasta Haklari Yonetmeligi",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"
    ],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "ER obligation represents high emergency duty under deontology, practice acts, and patient rights."
  },
  {
    id: "privacy-social-media",
    category: "hasta mahremiyeti / sosyal medya paylaşımı",
    question: "Kliniğimde tedavi ettiğim bir hastanın ameliyat öncesi ve sonrası fotoğraflarını sosyal medyada paylaşmak istiyorum. KVKK ve hasta mahremiyeti açısından ne gibi yükümlülüklerim var?",
    expectedTopicClusters: ["patient_privacy", "personal_health_data"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary",
      "Kisisel Verilerin Korunmasi Kanunu": "supporting_general"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi", "Kisisel Verilerin Korunmasi Kanunu"],
    shouldNotIncludeLegislation: [],
    expectedPrecedentSources: ["yargitay", "aym"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Directly relates to health data privacy. KVKK must be present as a supporting general legislation."
  },
  {
    id: "relative-threat",
    category: "hasta yakınının tehdit/hakareti",
    question: "Poliklinikte bir hasta yakını beni tehdit etti ve hakaretlerde bulundu. Beyaz kod bildirimi dışında, hasta yakınını tedaviyi reddetme hakkım var mı?",
    expectedTopicClusters: ["physician_refusal_or_withdrawal"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "A threat and refusal scenario triggering deontology codes for refusal."
  },
  {
    id: "white-code-violence",
    category: "beyaz kod / hekime şiddet",
    question: "Acil serviste şiddet gördüm, beyaz kod verdim. Can güvenliğim tehdit altındayken bu hastaya bakmama veya tedaviyi reddetme hakkım var mı?",
    expectedTopicClusters: ["physician_refusal_or_withdrawal"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Can ve güvenlik tehdidi under deontology rules governs physician withdrawal rights."
  },
  {
    id: "epicrisis-record-access",
    category: "epikriz ve kayıt verme",
    question: "Hasta benden tüm epikriz raporlarını ve poliklinik kayıtlarını istiyor. Hekim olarak bu kayıtları verme yükümlülüğüm nedir?",
    expectedTopicClusters: ["records_epicrisis"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Access to patient records and epicrisis reports maps to patient rights documentation rules."
  },
  {
    id: "consultation-referral",
    category: "konsültasyon / sevk",
    question: "Yandal uzmanı gereken bir hastayı sevk etmek veya başka bir hekimden konsültasyon istemek için yasal prosedür nedir?",
    expectedTopicClusters: ["referral_consultation"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Referral and consultation processes map to patient rights and duty of care."
  },
  {
    id: "complication-malpractice",
    category: "komplikasyon-malpraktis ayrımı",
    question: "Bir ameliyat sonrası gelişen komplikasyon nedeniyle dava açılacağı söyleniyor. Özen yükümlülüğü / hekim yükümlülüğü sınırları nedir?",
    expectedTopicClusters: ["physician_duty_of_care"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Malpractice vs complication. The standard of care is defined strictly in medical deontology."
  },
  {
    id: "private-hospital-fees",
    category: "özel hastanede ücret/tedavi uyuşmazlığı",
    question: "Özel hastanede çalışıyorum. Hasta tedavi ücretini ödemiyor. Hekim olarak tedaviyi sonlandırma veya hastayı reddetme hakkım var mı?",
    expectedTopicClusters: ["physician_refusal_or_withdrawal", "physician_patient_relationship_termination"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Fee dispute leading to refusal or termination of care."
  },
  {
    id: "public-hospital-disciplinary",
    category: "kamu hastanesinde disiplin/idari soruşturma",
    question: "Kamu hastanesindeki disiplin soruşturması kapsamında hekim yükümlülüğü ve özen yükümlülüğü sınırları ile kayıt dosyasının incelenmesi nasıl yapılır?",
    expectedTopicClusters: ["physician_duty_of_care", "records_epicrisis"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary",
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Disciplinary and administrative investigations for state physicians."
  },
  {
    id: "preop-consent",
    category: "ameliyat öncesi onam",
    question: "Ameliyat öncesi hastadan onam alırken risklerin ne kadarını aydınlatmam ve rıza formuna yazmam gerekir?",
    expectedTopicClusters: ["informed_consent"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Standard pre-operation consent and risk notification limits."
  },
  {
    id: "icu-treatment-refusal",
    category: "yoğun bakım / tedavi reddi",
    question: "Yoğun bakımdaki hasta yakınları tedaviyi bırakmak istiyor. Hekim olarak tedaviyi sonlandırma yükümlülüğüm var mı yoksa acil müdahale mi gerekir?",
    expectedTopicClusters: ["physician_refusal_or_withdrawal", "physician_patient_relationship_termination", "emergency_intervention"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary",
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Withdrawal of care in ICU setting. High ethical and legal scrutiny."
  },
  {
    id: "pregnancy-emergency",
    category: "gebelik / acil müdahale",
    question: "Gebe hastaya acil müdahale yapılması gerekiyor ancak hastanın rızası yok. Acil durum istisnası kapsamında müdahale edebilir miyim?",
    expectedTopicClusters: ["emergency_exception", "informed_consent"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary",
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi", "Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi", "Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Emergency treatment without consent in obstetric emergencies."
  },
  {
    id: "psychiatry-privacy-consent",
    category: "psikiyatri hastasında mahremiyet ve aydınlatma",
    question: "Psikiyatri hastasının tıbbi müdahale öncesi aydınlatılmış rıza alma ve hasta mahremiyeti hakları nasıl korunmalıdır?",
    expectedTopicClusters: ["informed_consent", "medical_intervention", "patient_privacy"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Special consent and privacy issues in psychiatric treatment."
  }
];
