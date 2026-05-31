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
  },
  // ── T23.1 — Kamu/özlük golden-set (public physician questions) ──
  {
    id: "public-appointment-transfer",
    category: "tayin / atama / yer değiştirme",
    question: "Sağlık Bakanlığına bağlı hastanede çalışıyorum. Tayin talebim reddedildi, yer değiştirme hakkım var mı?",
    expectedTopicClusters: ["public_employment", "appointment_transfer"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği"],
    shouldIncludeLegislation: ["Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Public physician appointment and transfer rules."
  },
  {
    id: "public-disciplinary-investigation",
    category: "disiplin soruşturması",
    question: "Kamu hastanesinde hekim olarak disiplin soruşturması açıldı. Savunma hakkım ve süreç nasıl işler?",
    expectedTopicClusters: ["public_discipline", "disciplinary_investigation"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği": "health_primary",
      "657 Sayılı Devlet Memurları Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği", "657 Sayılı Devlet Memurları Kanunu"],
    shouldIncludeLegislation: ["Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği", "657 Sayılı Devlet Memurları Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Disciplinary investigation process for public physicians."
  },
  {
    id: "contracted-staff-disciplinary",
    category: "sözleşmeli personel disiplin",
    question: "Sözleşmeli sağlık personeli olarak disiplin cezası aldım. İtiraz ve hukuki yollar nelerdir?",
    expectedTopicClusters: ["public_discipline", "contracted_staff"],
    expectedPrimaryLegislationRoles: {
      "Sözleşmeli Sağlık Personeli Disiplin ile Disiplin Kurulları Hakkında Yönetmelik": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sözleşmeli Sağlık Personeli Disiplin ile Disiplin Kurulları Hakkında Yönetmelik"],
    shouldIncludeLegislation: ["Sözleşmeli Sağlık Personeli Disiplin ile Disiplin Kurulları Hakkında Yönetmelik"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Contracted health personnel disciplinary rules."
  },
  {
    id: "promotion-exam",
    category: "görevde yükselme / unvan değişikliği",
    question: "Görevde yükselme sınavına gireceğim. Sağlık Bakanlığı personeli için sınav ve atama esasları nedir?",
    expectedTopicClusters: ["public_employment", "promotion"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Bakanlığı Personeli Görevde Yükselme ve Unvan Değişikliği Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Bakanlığı Personeli Görevde Yükselme ve Unvan Değişikliği Yönetmeliği"],
    shouldIncludeLegislation: ["Sağlık Bakanlığı Personeli Görevde Yükselme ve Unvan Değişikliği Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Promotion and title change rules for Ministry of Health staff."
  },
  {
    id: "extra-payment",
    category: "ek ödeme",
    question: "Kamu hastanesinde nöbet tutuyorum ancak ek ödemem eksik yatırıldı. Ek ödeme yönetmeliğine göre haklarım nelerdir?",
    expectedTopicClusters: ["public_employment", "extra_payment"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği"],
    shouldIncludeLegislation: ["Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Extra payment rights for on-call public health personnel."
  },
  {
    id: "on-call-duty",
    category: "nöbet",
    question: "Kamu hastanesinde hekim nöbet çizelgesi hakkında itirazım var. Nöbet planlama ve ücretlendirme kuralları nedir?",
    expectedTopicClusters: ["public_employment", "on_call_duty"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği": "health_primary",
      "657 Sayılı Devlet Memurları Kanunu": "supporting_general"
    },
    expectedPrimaryLegislationNames: ["Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği"],
    shouldIncludeLegislation: ["Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği", "657 Sayılı Devlet Memurları Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "On-call duty scheduling and payment for public physicians."
  },
  {
    id: "open-appointment-lottery",
    category: "açıktan atama / kura",
    question: "Açıktan atama kurası ile kamu hastanesine atanmak istiyorum. Sağlık personeli atama esas ve usulleri nedir?",
    expectedTopicClusters: ["public_employment", "open_appointment"],
    expectedPrimaryLegislationRoles: {
      "Kamu Kurum ve Kuruluşlarına Açıktan Kura ile Atanacak Bazı Sağlık Personelinin Atama Esas ve Usulleri Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Kamu Kurum ve Kuruluşlarına Açıktan Kura ile Atanacak Bazı Sağlık Personelinin Atama Esas ve Usulleri Yönetmeliği"],
    shouldIncludeLegislation: ["Kamu Kurum ve Kuruluşlarına Açıktan Kura ile Atanacak Bazı Sağlık Personelinin Atama Esas ve Usulleri Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Open appointment lottery rules for health personnel."
  },
  {
    id: "specialty-training",
    category: "uzmanlık eğitimi",
    question: "Tıpta uzmanlık eğitimine başlayacağım. Uzmanlık eğitimi yönetmeliğine göre hak ve yükümlülüklerim nelerdir?",
    expectedTopicClusters: ["specialty_training", "medical_education"],
    expectedPrimaryLegislationRoles: {
      "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği"],
    shouldIncludeLegislation: ["Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Specialty training rights and obligations for resident physicians."
  },
  {
    id: "health-specialist",
    category: "sağlık uzmanlığı",
    question: "Sağlık uzmanı olarak atandım. Sağlık uzmanlığı yönetmeliğine göre görev tanımım ve yetkilerim nelerdir?",
    expectedTopicClusters: ["public_employment", "health_specialist"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Uzmanlığı Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Uzmanlığı Yönetmeliği"],
    shouldIncludeLegislation: ["Sağlık Uzmanlığı Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Health specialist role definitions and authorities."
  },
  {
    id: "work-safety",
    category: "iş sağlığı ve güvenliği",
    question: "Kamu hastanesinde çalışan hekim olarak iş sağlığı ve güvenliği yükümlülüklerim nelerdir?",
    expectedTopicClusters: ["work_safety", "occupational_health"],
    expectedPrimaryLegislationRoles: {
      "Is Sagligi ve Guvenligi Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Is Sagligi ve Guvenligi Kanunu"],
    shouldIncludeLegislation: ["Is Sagligi ve Guvenligi Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Occupational health and safety duties for hospital physicians."
  },
  {
    id: "patient-staff-safety",
    category: "hasta ve çalışan güvenliği",
    question: "Hastanede hasta düşme olayları artıyor. Hasta ve çalışan güvenliği yönetmeliğine göre almam gereken önlemler nelerdir?",
    expectedTopicClusters: ["patient_safety", "staff_safety"],
    expectedPrimaryLegislationRoles: {
      "Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik"],
    shouldIncludeLegislation: ["Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Patient and staff safety regulations in health facilities."
  },
  {
    id: "quality-improvement",
    category: "sağlık hizmeti kalitesi",
    question: "Hastanemizde sağlık hizmeti kalitesi değerlendirmesi yapılacak. Kalite geliştirme yönetmeliğine göre standartlar nelerdir?",
    expectedTopicClusters: ["quality_improvement", "healthcare_quality"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik"],
    shouldIncludeLegislation: ["Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Healthcare quality improvement and evaluation standards."
  },
  {
    id: "family-medicine",
    category: "aile hekimliği",
    question: "Aile hekimi olarak görev yapıyorum. Aile hekimliği kanununa göre haklarım ve yükümlülüklerim nelerdir?",
    expectedTopicClusters: ["family_medicine", "primary_care"],
    expectedPrimaryLegislationRoles: {
      "Aile Hekimligi Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Aile Hekimligi Kanunu"],
    shouldIncludeLegislation: ["Aile Hekimligi Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Family medicine practice rights and obligations."
  },
  {
    id: "civil-servant-rights",
    category: "devlet memuru hakları",
    question: "657 sayılı Devlet Memurları Kanunu'na tabi hekim olarak izin, emeklilik ve diğer haklarım nelerdir?",
    expectedTopicClusters: ["public_employment", "civil_servant_rights"],
    expectedPrimaryLegislationRoles: {
      "657 Sayılı Devlet Memurları Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["657 Sayılı Devlet Memurları Kanunu"],
    shouldIncludeLegislation: ["657 Sayılı Devlet Memurları Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Civil servant rights for public physicians under Law 657."
  },
  {
    id: "contracted-appointment",
    category: "sözleşmeli personel atama",
    question: "4924 sayılı kanuna tabi sözleşmeli sağlık personeli olarak atandım. Atama ve yer değiştirme kuralları nedir?",
    expectedTopicClusters: ["public_employment", "contracted_staff"],
    expectedPrimaryLegislationRoles: {
      "4924 sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Atama ve Yer Değiştirme Yönetmeliği": "health_primary"
    },
    expectedPrimaryLegislationNames: ["4924 sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Atama ve Yer Değiştirme Yönetmeliği"],
    shouldIncludeLegislation: ["4924 sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Atama ve Yer Değiştirme Yönetmeliği"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Contracted health personnel appointment and transfer rules."
  }
];
