import { type BenchmarkQuestion, FORBIDDEN_FIELDS_LIST } from "./doctorQuestions.js";

export const realWorldPhysicianQuestions: BenchmarkQuestion[] = [
  {
    id: "real-consent-lack",
    category: "aydınlatılmış onam eksikliği",
    question: "Hasta aydınlatılmış onam formunu imzalamadan ameliyata alındı. Bu durum malpraktis davasında aleyhime rıza eksikliği olarak nasıl değerlendirilir?",
    expectedTopicClusters: ["informed_consent", "medical_intervention"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires standard patient rights consent rules."
  },
  {
    id: "real-complication-malpractice",
    category: "ameliyat komplikasyonu / malpraktis iddiası",
    question: "Kolesistektomi ameliyatı sonrası koledok yaralanması gelişti. Hasta malpraktis davası açacağını söylüyor. Komplikasyon yönetimi ve hekimin özen yükümlülüğü sınırları nedir?",
    expectedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Focuses on diligence standard under deontology rules."
  },
  {
    id: "real-records-epicrisis",
    category: "hasta dosyası / epikriz / kayıt düzeltme",
    question: "Hasta taburcu edildikten sonra epikriz raporundaki eksiklikler ve yanlış tıbbi kayıtların düzeltilmesi talebinde bulundu. Hekim olarak kayıt düzeltme ve epikriz verme yükümlülüğüm nedir?",
    expectedTopicClusters: ["records_epicrisis", "patient_rights"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires patient rights access to records."
  },
  {
    id: "real-privacy-share",
    category: "hasta verisinin üçüncü kişiye paylaşılması",
    question: "Bir hastanın yakınlarına, kendisinin haberi olmadan tıbbi durumu hakkında bilgi verdim. Hasta verisinin üçüncü kişilerle paylaşılması KVKK ve hasta mahremiyeti açısından suç teşkil eder mi?",
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
    notes: "Privacy sharing maps to patient rights and KVKK."
  },
  {
    id: "real-social-media-privacy",
    category: "sosyal medyada hasta görüntüsü / mahremiyet",
    question: "Hastalardan ameliyat öncesi aldığım izinle estetik operasyonların öncesi/sonrası fotoğraflarını sosyal medyada paylaşıyorum. Mahremiyet ihlali ve KVKK rızası sınırları nedir?",
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
    notes: "Requires patient rights and KVKK rules."
  },
  {
    id: "real-emergency-no-consent",
    category: "acil serviste rıza alınamaması",
    question: "Acil servise bilinci kapalı getirilen ve hayati tehlikesi olan hastaya rızası alınamadan yapılan acil müdahalenin hukuki sorumluluğu ve acil durum onam istisnası nedir?",
    expectedTopicClusters: ["emergency_exception", "informed_consent", "medical_intervention"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary",
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi", "Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi", "Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "ER emergency exception is covered by patient rights and deontology."
  },
  {
    id: "real-referral-delay",
    category: "sevk / konsültasyon gecikmesi",
    question: "Kritik durumdaki bir hastayı yoğun bakım yatağı olmaması sebebiyle sevk edemedim ve konsültasyon isteminde gecikme yaşandı. Sevk ve konsültasyon yükümlülüğünün sınırları nelerdir?",
    expectedTopicClusters: ["referral_consultation", "physician_duty_of_care"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Standard referral/consultation logic."
  },
  {
    id: "real-private-hospital-liability",
    category: "özel hastane yükümlülüğü",
    question: "Özel hastanede çalışan bir hekim olarak hastane yönetiminin sunduğu tıbbi cihazların yetersizliği sebebiyle hastaya müdahale edemedim. Özel hastane işletmecisinin ve hekimin sorumluluğu nedir?",
    expectedTopicClusters: ["private_health_facility", "professional_scope_of_practice"],
    expectedPrimaryLegislationRoles: {
      "Saglik Hizmetleri Temel Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Saglik Hizmetleri Temel Kanunu"],
    shouldIncludeLegislation: ["Saglik Hizmetleri Temel Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Checks for Özel Hastaneler Yönetmeliği coverage gap."
  },
  {
    id: "real-outpatient-clinic-gap",
    category: "ayakta teşhis / tıp merkezi bağlamı",
    question: "Ayakta teşhis ve tedavi yapılan bir tıp merkezinde hastaya uygulanan enjeksiyon sonrası apse gelişti. Tıp merkezi ortamının sterilizasyon yükümlülüğü ve sorumluluk sınırları nedir?",
    expectedTopicClusters: ["private_health_facility", "physician_duty_of_care"],
    expectedPrimaryLegislationRoles: {
      "Saglik Hizmetleri Temel Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Saglik Hizmetleri Temel Kanunu"],
    shouldIncludeLegislation: ["Saglik Hizmetleri Temel Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Checks for Ayakta Teşhis Yönetmeliği coverage gap."
  },
  {
    id: "real-scope-violation",
    category: "uzmanlık dışı işlem / görev tanımı",
    question: "Kendi uzmanlık branşımın dışındaki bir tıbbi işlemi acil olmayan bir hastada uyguladım. Görev tanımı ve branş dışı işlem yasağı kapsamındaki disiplin sorumluluğu nedir?",
    expectedTopicClusters: ["professional_scope_of_practice", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik": "health_primary",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": "health_primary"
    },
    expectedPrimaryLegislationNames: [
      "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"
    ],
    shouldIncludeLegislation: [
      "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"
    ],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Focuses on professional scope boundaries."
  },
  {
    id: "real-team-responsibility",
    category: "yardımcı sağlık personeline talimat / ekip sorumluluğu",
    question: "Ameliyathanede çalışan hemşireye verdiğim talimatın yanlış uygulanması sonucu hastada sinir hasarı oluşti. Hekimin ekibi denetleme ve yardımcı personele talimat verme sorumluluğu nedir?",
    expectedTopicClusters: ["professional_scope_of_practice", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik"],
    shouldIncludeLegislation: ["Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay", "danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires duty definitions regulation."
  },
  {
    id: "real-workplace-physician-report",
    category: "işyeri hekimi raporu",
    question: "İşyeri hekimi olarak bir çalışanın işe uygun olmadığına dair sağlık raporu verdim. İSG Kanunu kapsamında işyeri hekiminin mesleki bağımsızlığı ve rapor verme yetkisi nedir?",
    expectedTopicClusters: ["professional_scope_of_practice", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Is Sagligi ve Guvenligi Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Is Sagligi ve Guvenligi Kanunu"],
    shouldIncludeLegislation: ["Is Sagligi ve Guvenligi Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Uses İSG Kanunu md. 8."
  },
  {
    id: "real-organ-transplant-consent",
    category: "organ/doku nakli rıza ve mevzuat bağlamı",
    question: "Yaşayan bir donörden böbrek nakli yapılması için gerekli olan aydınlatılmış rıza koşulları ve Organ Nakli Kanunu kapsamında rızanın geri alınması sınırları nedir?",
    expectedTopicClusters: ["informed_consent", "medical_intervention"],
    expectedPrimaryLegislationRoles: {
      "Organ ve Doku Nakli Kanunu": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Organ ve Doku Nakli Kanunu"],
    shouldIncludeLegislation: ["Organ ve Doku Nakli Kanunu"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires Organ Nakli Kanunu (2238) primary."
  },
  {
    id: "real-art-treatment-consent",
    category: "üremeye yardımcı tedavi",
    question: "Tüp bebek tedavisi (ÜYTE) uygulanan bir hastada eşlerin rızası olmadan embriyo transferi yapılması iddiası var. Yardımcı üreme teknolojilerinde rıza ve yasal sınırlar nelerdir?",
    expectedTopicClusters: ["informed_consent", "medical_intervention"],
    expectedPrimaryLegislationRoles: {
      "Uremeye Yardimci Tedavi Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Uremeye Yardimci Tedavi Yonetmeligi"],
    shouldIncludeLegislation: ["Uremeye Yardimci Tedavi Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires ÜYTE Yönetmeliği (20085) primary."
  },
  {
    id: "real-getat-scope",
    category: "geleneksel/tamamlayıcı tıp",
    question: "GETAT yönetmeliği kapsamında kliniğimde akupunktur ve ozon tedavisi uyguluyorum. Hekimin tamamlayıcı tıp uygulamalarındaki yetki sınırları ve sorumluluğu nedir?",
    expectedTopicClusters: ["professional_scope_of_practice", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi"],
    shouldIncludeLegislation: ["Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires GETAT Yönetmeliği (45117) primary."
  },
  {
    id: "real-patient-rights-complaint",
    category: "hasta hakları başvurusu",
    question: "Hasta, hasta hakları birimine hekimin ilgisizliği ve kötü muamelesi gerekçesiyle şikayet başvurusunda bulundu. Bu idari sürecin yasal dayanakları ve hekimin savunma hakkı nedir?",
    expectedTopicClusters: ["patient_rights", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Patient rights complaint procedure."
  },
  {
    id: "real-disciplinary-investigation",
    category: "idari/disiplin soruşturması",
    question: "Kamu hastanesindeki bir ameliyat gecikmesi nedeniyle hakkında görevi ihmal iddiasıyla disiplin soruşturması başlatıldı. Disiplin soruşturmasında özen yükümlülüğü ve sorumluluk sınırları nelerdir?",
    expectedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary",
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi", "Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Requires state physician deontology and patient rights standard."
  },
  {
    id: "real-criminal-liability",
    category: "ceza sorumluluğu iddiası",
    question: "Tedavi ettiğim hastanın kaybedilmesi üzerine hakkımda taksirle ölüme sebebiyet vermekten ceza soruşturması açıldı. Hekimin cezai sorumluluk sınırları ve illiyet bağı nasıl kurulur?",
    expectedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Criminal liability assessment."
  },
  {
    id: "real-civil-compensation",
    category: "maddi/manevi tazminat iddiası",
    question: "Malpraktis iddiasıyla aleyhime maddi ve manevi tazminat davası açıldı. Hukuki tazminat sorumluluğu ve hekimin özen borcu kapsamı nedir?",
    expectedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Civil compensation assessment."
  },
  {
    id: "real-adli-vaka-gap",
    category: "ölüm bildirimi / adli vaka bağlamı",
    question: "Acile getirildikten sonra vefat eden şüpheli bir ölüm vakasında defin ruhsatı vermeyip adli tabipliğe ve savcılığa bildirim yapmamın yasal zorunluluğu ve sınırları nedir?",
    expectedTopicClusters: ["emergency_exception", "professional_ethics"],
    expectedPrimaryLegislationRoles: {
      "Tibbi Deontoloji Nizamnamesi": "health_primary",
      "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Tibbi Deontoloji Nizamnamesi", "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"],
    shouldIncludeLegislation: ["Tibbi Deontoloji Nizamnamesi", "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun"],
    shouldNotIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu"],
    expectedPrecedentSources: ["danistay", "yargitay"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Adli vaka reporting uses core practice and deontology."
  },
  {
    id: "real-health-data-reg-gap",
    category: "kişisel sağlık verileri yönetmeliği",
    question: "Kliniğimdeki hastaların e-nabız veya özel veritabanındaki kişisel sağlık verilerinin korunması ve Kişisel Sağlık Verileri Hakkında Yönetmelik kapsamındaki ikincil düzenleme yükümlülüklerim nelerdir?",
    expectedTopicClusters: ["patient_privacy", "personal_health_data"],
    expectedPrimaryLegislationRoles: {
      "Kisisel Verilerin Korunmasi Kanunu": "supporting_general",
      "Hasta Haklari Yonetmeligi": "health_primary"
    },
    expectedPrimaryLegislationNames: ["Hasta Haklari Yonetmeligi"],
    shouldIncludeLegislation: ["Kisisel Verilerin Korunmasi Kanunu", "Hasta Haklari Yonetmeligi"],
    shouldNotIncludeLegislation: [],
    expectedPrecedentSources: ["yargitay", "aym"],
    forbiddenFields: FORBIDDEN_FIELDS_LIST,
    notes: "Checks for Kişisel Sağlık Verileri Yönetmeliği gap."
  }
];

export const realWorldPhysicianLiveSmokeQuestions = realWorldPhysicianQuestions.filter(q =>
  [
    "real-consent-lack",
    "real-emergency-no-consent",
    "real-privacy-share",
    "real-scope-violation",
    "real-private-hospital-liability",
    "real-disciplinary-investigation"
  ].includes(q.id)
);

