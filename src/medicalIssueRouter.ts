/**
 * src/medicalIssueRouter.ts
 *
 * v0.23.0 — Medical Issue Router
 *
 * Deterministic, keyword-driven router that maps a physician's free-text question
 * to one or more legal issue categories.  No LLM calls, no external network calls.
 *
 * Output is a *search/coverage profile*, not legal advice:
 *   – It identifies which issue axes are relevant.
 *   – It suggests topic clusters and court search terms.
 *   – It does NOT produce risk levels, definitive legal opinions, or action plans.
 *
 * Design:
 *   Each issue definition holds:
 *     - phrases: exact phrases that score high (each = +3)
 *     - terms:   single-keyword signals (each = +1)
 *     - minScore for confidence thresholds (high ≥ 5, medium ≥ 2, low ≥ 1)
 */

import { normalizeText } from "./health/precedentRelevance.js";

// ─── Public Types ──────────────────────────────────────────────────────────────

export type MedicalIssueId =
  | "informed_consent"
  | "medical_records"
  | "privacy_kvkk"
  | "emergency_care"
  | "referral_consultation"
  | "malpractice_complication"
  | "disciplinary_admin"
  | "patient_rights"
  | "criminal_liability"
  | "civil_compensation"
  | "private_health_facility"
  | "professional_scope_of_practice"
  | "workplace_employee_health"
  | "prescription_report"
  | "death_postmortem"
  | "public_employment"
  | "transfer_assignment"
  | "unclear_or_mixed";

export type RouteConfidence = "high" | "medium" | "low";

export interface MedicalIssueRoute {
  issueId: MedicalIssueId;
  label: string;
  confidence: RouteConfidence;
  score: number;
  matchedTerms: string[];
  reason: string;
  suggestedTopicClusters: string[];
  suggestedCourtSearchTerms: string[];
}

export interface MedicalIssueRouterResult {
  normalizedQuestion: string;
  routes: MedicalIssueRoute[];
  primaryIssueId: MedicalIssueId | null;
  missingInfoHints: string[];
  routerWarnings: string[];
}

// ─── Internal Issue Definition ─────────────────────────────────────────────────

interface IssueDefinition {
  id: MedicalIssueId;
  label: string;
  /** Multi-word phrases — matched as substring; each hit scores +3 */
  phrases: string[];
  /** Single-keyword signals; each hit scores +1 */
  terms: string[];
  suggestedTopicClusters: string[];
  suggestedCourtSearchTerms: string[];
  missingInfoHints: string[];
}

// ─── Issue Definitions ─────────────────────────────────────────────────────────

const ISSUE_DEFINITIONS: IssueDefinition[] = [
  {
    id: "informed_consent",
    label: "Aydınlatılmış Onam / Rıza",
    phrases: [
      "aydinlatilmis onam",
      "aydinlatilmis riza",
      "ameliyat onam",
      "islem onam",
      "onam belgesi",
      "riza belgesi",
      "bilgilendirme formu",
      "yazili riza",
      "sozlu riza",
      "riza alinmadan",
      "riza almadan",
      "riza alınmadan",
      "riza alınmamis",
      "onam alınmadan",
      "onam alınmamis",
      "hastanin rizasi",
      "hastanın rızası"
    ],
    terms: [
      "onam", "riza", "rıza", "aydinlat", "aydınlat", "bilgilendirme"
    ],
    suggestedTopicClusters: ["informed_consent", "patient_rights", "medical_intervention"],
    suggestedCourtSearchTerms: [
      "aydinlatilmis onam", "aydinlatilmis riza", "tibbi mudahale onam",
      "ameliyat oncesi bilgilendirme", "yazili riza"
    ],
    missingInfoHints: [
      "Müdahalenin acil olup olmadığı",
      "Yazılı onam formunun varlığı veya içeriği",
      "Hastanın ehliyeti (küçük, mahcur vb.)"
    ]
  },
  {
    id: "medical_records",
    label: "Hasta Dosyası / Kayıt Tutma",
    phrases: [
      "hasta dosyasi",
      "hasta kaydi",
      "tibbi kayit",
      "tıbbi kayıt",
      "kayit tutma",
      "kayıt tutma",
      "epikriz duzenle",
      "epikriz yazma",
      "kayit eksik",
      "kayıt eksik",
      "dosya eksik",
      "kayit hatasi",
      "kayit duzeltme"
    ],
    terms: [
      "epikriz", "kayit", "kayıt", "dosya", "arsiv", "arşiv", "taburcu ozeti", "taburcu özeti"
    ],
    suggestedTopicClusters: ["records_epicrisis", "patient_rights", "patient_privacy"],
    suggestedCourtSearchTerms: [
      "hasta dosyasi kayit tutma", "epikriz yükümlülügü", "tibbi kayit eksikligi",
      "hasta kaydi duzeltme", "taburcu ozeti"
    ],
    missingInfoHints: [
      "Kayıt eksikliğinin türü (epikriz, ameliyat notu, ilaç kaydı vb.)",
      "Kaydın kimler tarafından tutulduğu",
      "Eksik kaydın bir uyuşmazlıkta delil niteliği taşıyıp taşımadığı"
    ]
  },
  {
    id: "privacy_kvkk",
    label: "Mahremiyet / KVKK / Hasta Verisi",
    phrases: [
      "kisisel saglik verisi",
      "kişisel sağlık verisi",
      "saglik verisi paylas",
      "sağlık verisi paylaş",
      "hasta verisi paylas",
      "hasta bilgisi paylas",
      "ucuncu kisiye bilgi",
      "üçüncü kişiye bilgi",
      "goruntu paylas",
      "görüntü paylaş",
      "sosyal medyada paylas",
      "sosyal medyada paylaş",
      "hasta mahremiyeti",
      "sir saklama",
      "sır saklama",
      "veri ihlali"
    ],
    terms: [
      "kvkk", "mahremiyet", "mahrem", "gizlilik", "veri", "paylas", "paylaş",
      "sosyal medya"
    ],
    suggestedTopicClusters: ["patient_privacy", "personal_health_data", "patient_rights"],
    suggestedCourtSearchTerms: [
      "hasta mahremiyeti ihlali", "kisisel saglik verisi", "kvkk saglik",
      "sir saklama yukumlulugu", "hasta bilgisi paylasimi"
    ],
    missingInfoHints: [
      "Verinin kimlerle ve hangi amaçla paylaşıldığı",
      "Paylaşımın yazılı izninin bulunup bulunmadığı",
      "Verinin hassas nitelikte olup olmadığı (KVKK md.6 kapsamı)"
    ]
  },
  {
    id: "emergency_care",
    label: "Acil Müdahale / Hayati Tehlike",
    phrases: [
      "acil mudahale",
      "acil müdahale",
      "hayati tehlike",
      "acil servis",
      "ilk yardim",
      "ilk yardım",
      "riza alinamamasi",
      "rıza alınamaması",
      "acil durumda riza",
      "acil durumda rıza",
      "bilincsiz hasta",
      "bilinçsiz hasta",
      "acil kabulü",
      "acil kabul",
      "müdahale yükümlülügü",
      "mudahale yukumlulugu"
    ],
    terms: [
      "acil", "hayati", "bilincsiz", "bilinçsiz", "koma", "canlandirma", "canlandırma"
    ],
    suggestedTopicClusters: ["emergency_intervention", "emergency_exception", "informed_consent"],
    suggestedCourtSearchTerms: [
      "acil tibbi mudahale", "hayati tehlike riza", "acil serviste mudahale yukumlulugu",
      "riza aranmaksizin mudahale", "acil hasta kabulü"
    ],
    missingInfoHints: [
      "Hastanın bilinç durumu ve aciliyet derecesi",
      "Yasal temsilciye ulaşılıp ulaşılmadığı",
      "Müdahalenin geciktirilmesinin yaratacağı tıbbi risk"
    ]
  },
  {
    id: "referral_consultation",
    label: "Sevk / Konsültasyon",
    phrases: [
      "konsultasyon istemi",
      "konsültasyon istemi",
      "baska uzmana sevk",
      "başka uzmana sevk",
      "uzman hekime gonder",
      "uzman hekime gönder",
      "sevk yükümlülügü",
      "sevk zorunlulugu",
      "sevk gecikme",
      "konsultasyon gecikmesi",
      "konsültasyon gecikmesi",
      "yandal uzmani",
      "yandal uzmanı",
      "ikinci gorüs",
      "ikinci görüş"
    ],
    terms: [
      "sevk", "konsultasyon", "konsültasyon", "yondlendirme", "yönlendirme", "yandal"
    ],
    suggestedTopicClusters: ["referral_consultation", "physician_duty_of_care"],
    suggestedCourtSearchTerms: [
      "sevk yukumlulugu", "konsultasyon istemi", "uzman hekime sevk",
      "tibbi standarda uygun sevk", "konsultasyon gecikmesi"
    ],
    missingInfoHints: [
      "Sevk veya konsültasyonun zamanında yapılıp yapılmadığı",
      "Sevk kararının belgelenip belgelenmediği",
      "Hangi uzmanlık alanına sevk/konsültasyon önerildiği"
    ]
  },
  {
    id: "malpractice_complication",
    label: "Malpraktis / Komplikasyon / Tıbbi Hata",
    phrases: [
      "tibbi hata",
      "tıbbi hata",
      "hekim kusuru",
      "hekimin kusuru",
      "komplikasyon yonetimi",
      "komplikasyon yönetimi",
      "standart disi tedavi",
      "standart dışı tedavi",
      "ozen yukumlulugu",
      "özen yükümlülügü",
      "hizmet kusuru",
      "hatalı tedavi",
      "hatali tedavi",
      "yanlis tedavi",
      "yanlış tedavi",
      "yanlis teshis",
      "yanlış teşhis"
    ],
    terms: [
      "malpraktis", "komplikasyon", "kusur", "hata", "ozen", "özen", "ihmal", "sorumluluk"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    suggestedCourtSearchTerms: [
      "tibbi hata malpraktis", "ozen yukumlulugu", "komplikasyon malpraktis ayrimi",
      "hekim kusuru tazminat", "hizmet kusuru saglik"
    ],
    missingInfoHints: [
      "Tıbbi müdahalenin türü ve tarihi",
      "Komplikasyonun standart mı, beklenmedik mi olduğu",
      "Hastanın mevcut sağlık durumu ve risk faktörleri",
      "Yapılan müdahalenin tıbbi literatürdeki standartla uyumu"
    ]
  },
  {
    id: "disciplinary_admin",
    label: "İdari Soruşturma / Disiplin",
    phrases: [
      "idari sorusturma",
      "idari soruşturma",
      "disiplin sorusturma",
      "disiplin soruşturma",
      "disiplin cezasi",
      "disiplin cezası",
      "gorevi ihmal",
      "görevi ihmal",
      "kamu gorevlisi",
      "kamu görevlisi",
      "devlet memuru",
      "hastane yonetimi",
      "hastane yönetimi",
      "idare mahkemesi",
      "tam yargi",
      "tam yargı",
      "idari yaptırım",
      "disiplin soruşturması",
      "disiplin sorusturmasi",
      "disiplin cezası",
      "disiplin cezasi",
      "soruşturma izni",
      "sorusturma izni",
      "disiplin amiri",
      "disiplin kurulu",
      "uyarma cezası",
      "kınama cezası",
      "görevden uzaklaştırma"
    ],
    terms: [
      "disiplin", "idari", "sorusturma", "soruşturma", "kamu", "memur", "yaptirım", "yaptırım",
      "disiplin amiri", "disiplin kurulu", "disiplin sorusturmasi"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "professional_ethics", "disciplinary_administrative"],
    suggestedCourtSearchTerms: [
      "kamu gorevlisi hekim disiplin", "idari sorusturma saglik",
      "gorevi ihmal hekim", "devlet memuru disiplin saglik",
      "tam yargi davasi saglik", "disiplin amiri saglik bakanligi",
      "disiplin sorusturmasi hekim"
    ],
    missingInfoHints: [
      "Hekimin kamu veya özel kuruluşta çalışıp çalışmadığı",
      "Soruşturmanın idari mi, adli mi olduğu",
      "Varsa resmi soruşturma açılması kararının varlığı",
      "Disiplin amirinin kim olduğu ve yetki kapsamı",
      "Sözleşmeli mi, kadrolu mu personel olduğu"
    ]
  },
  {
    id: "patient_rights",
    label: "Hasta Hakları / Şikâyet Başvurusu",
    phrases: [
      "hasta haklari basvurusu",
      "hasta hakları başvurusu",
      "hasta haklari birimi",
      "hasta hakları birimi",
      "hasta sikayeti",
      "hasta şikayeti",
      "hasta haklari ihlali",
      "hasta hakları ihlali",
      "hasta dostu",
      "hak ihlali",
      "hekim reddi",
      "tedavi reddi"
    ],
    terms: [
      "hasta haklari", "hasta hakları", "sikayet", "şikayet", "basvuru", "başvuru", "hak ihlali"
    ],
    suggestedTopicClusters: ["patient_rights", "informed_consent", "records_epicrisis"],
    suggestedCourtSearchTerms: [
      "hasta haklari ihlali", "hasta sikayeti", "hasta haklari birimi",
      "hasta memnuniyetsizligi", "hasta hak ihlali"
    ],
    missingInfoHints: [
      "Şikayetin idari mi, hukuki mi olduğu",
      "Başvurulan kurumun türü (hasta hakları birimi, İl Sağlık Müdürlüğü, mahkeme)",
      "Hastanın maruz kaldığı ihlalin somut niteliği"
    ]
  },
  {
    id: "criminal_liability",
    label: "Cezai Sorumluluk / Suç İsnadı",
    phrases: [
      "taksirle yaralama",
      "taksirle oldurmek",
      "taksirle öldürmek",
      "gorevi kotüye kullanma",
      "görevi kötüye kullanma",
      "suc suclama",
      "suç suçlama",
      "ceza davasi",
      "ceza davası",
      "savciya sikayet",
      "savcıya şikayet",
      "suc duyurusu",
      "suç duyurusu",
      "kovusturma",
      "kovuşturma",
      "beraat",
      "mahkumiyet"
    ],
    terms: [
      "ceza", "taksir", "suc", "suç", "kovusturma", "kovuşturma", "savcı", "savci",
      "yargilama", "yargılama"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    suggestedCourtSearchTerms: [
      "taksirle yaralama hekim", "taksirle oldurme hekim",
      "gorevi kotüye kullanma saglik", "hekim ceza sorumlulugu",
      "tibbi taksir"
    ],
    missingInfoHints: [
      "Suç duyurusunun kim tarafından yapıldığı",
      "İsnada konu olan eylemin tıbbi mi, idari mi olduğu",
      "Hekimin kasıt mı, ihmal mi ile hareket ettiği iddiası"
    ]
  },
  {
    id: "civil_compensation",
    label: "Maddi / Manevi Tazminat",
    phrases: [
      "maddi tazminat",
      "manevi tazminat",
      "tazminat davasi",
      "tazminat davası",
      "hukuki sorumluluk",
      "vekaletsiz is gorme",
      "vekâletsiz iş görme",
      "hizmet bedeli iade",
      "zarar ziyan",
      "zarar ziyan tazminati"
    ],
    terms: [
      "tazminat", "zarar", "telafi", "hukuki sorumluluk"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "patient_rights"],
    suggestedCourtSearchTerms: [
      "maddi manevi tazminat saglik", "hekim hukuki sorumluluk",
      "hizmet kusuru tazminat", "saglik hizmeti zarar"
    ],
    missingInfoHints: [
      "Zararın türü (maddi, manevi, her ikisi)",
      "Tazminat talebinin kime yöneltildiği (hekim, hastane, sigorta)",
      "Zararla müdahale arasındaki nedensellik bağının tartışılıp tartışılmadığı"
    ]
  },
  {
    id: "private_health_facility",
    label: "Özel Sağlık Kuruluşu",
    phrases: [
      "ozel hastane",
      "özel hastane",
      "ozel klinik",
      "özel klinik",
      "tip merkezi",
      "tıp merkezi",
      "ozel saglik kurulusu",
      "özel sağlık kuruluşu",
      "ayakta teshis tedavi",
      "ayakta teşhis tedavi",
      "muayenehane",
      "poliklinik",
      "ozel saglik",
      "özel sağlık"
    ],
    terms: [
      "ozel", "özel", "klinik", "poliklinik", "muayenehane"
    ],
    suggestedTopicClusters: ["private_health_facility", "professional_scope_of_practice"],
    suggestedCourtSearchTerms: [
      "ozel hastane yukumlulugu", "ozel saglik kurulusu denetim",
      "ozel klinik lisans", "tip merkezi yetkilendirme",
      "ayakta teshis tedavi ozel"
    ],
    missingInfoHints: [
      "Kuruluşun türü (özel hastane, muayenehane, poliklinik, tıp merkezi)",
      "Ruhsat ve denetim durumu",
      "Uyuşmazlığın kuruluşun işletme koşullarından mı, tıbbi hizmetten mi kaynaklandığı"
    ]
  },
  {
    id: "professional_scope_of_practice",
    label: "Uzmanlık Sınırı / Görev Tanımı",
    phrases: [
      "uzmanlik siniri",
      "uzmanlık sınırı",
      "uzman disinda",
      "uzman dışında",
      "brans disi",
      "branş dışı",
      "yetki siniri",
      "yetki sınırı",
      "izinsiz islem",
      "izinsiz işlem",
      "yetkisiz mudahale",
      "yetkisiz müdahale",
      "gorev tanimi",
      "görev tanımı",
      "uzmanlik alani",
      "uzmanlık alanı"
    ],
    terms: [
      "uzmanlik", "uzmanlık", "brans", "branş", "yetki", "kapsam", "sinir", "sınır"
    ],
    suggestedTopicClusters: ["professional_scope_of_practice", "professional_ethics", "physician_duty_of_care"],
    suggestedCourtSearchTerms: [
      "uzmanlik siniri hekim", "brans disi mudahale",
      "yetkisiz tibbi islem", "gorev tanimi saglik personeli",
      "uzmanlik alani disinda islem"
    ],
    missingInfoHints: [
      "Hekimin uzmanlık unvanı ve sertifikası",
      "Yapılan işlemin hangi uzmanlık dalına ait olduğu",
      "İşlemi kimin talebi veya yönlendirmesiyle yapıldığı"
    ]
  },
  {
    id: "workplace_employee_health",
    label: "İşyeri Hekimi / Çalışan Sağlığı",
    phrases: [
      "isyeri hekimi",
      "işyeri hekimi",
      "isyeri hekim",
      "işyeri hekim",
      "calisma ortami",
      "çalışma ortamı",
      "is kazasi",
      "iş kazası",
      "meslek hastaligi",
      "meslek hastalığı",
      "istirahat raporu",
      "calisana rapor",
      "çalışana rapor",
      "isyeri saglik",
      "işyeri sağlık"
    ],
    terms: [
      "isyeri", "işyeri", "is kazasi", "iş kazası", "calisma", "çalışma", "istirahat"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    suggestedCourtSearchTerms: [
      "isyeri hekimi yukumlulugu", "is kazasi hekim",
      "meslek hastaligi teshis", "isyeri saglik denetim",
      "istirahat raporu duzenleme"
    ],
    missingInfoHints: [
      "Hekimin işyeri hekimi mi, tedavi hekimi mi olduğu",
      "İş kazası veya meslek hastalığı bildiriminin yapılıp yapılmadığı",
      "İşverenin ve SGK'nın sürece dahil olup olmadığı"
    ]
  },
  {
    id: "prescription_report",
    label: "Reçete / Rapor / İlaç Yazımı",
    phrases: [
      "recete yaz",
      "reçete yaz",
      "recete duzenle",
      "reçete düzenle",
      "ilac yaz",
      "ilaç yaz",
      "rapor duzenle",
      "rapor düzenle",
      "istirahat raporu",
      "sahte rapor",
      "yanlis recete",
      "yanlış reçete",
      "recete hatasi",
      "reçete hatası",
      "kontrol edilen madde",
      "uyusturucu recete",
      "uyuşturucu reçete"
    ],
    terms: [
      "recete", "reçete", "rapor", "istirahat", "ilac", "ilaç", "dozaj", "kontrendikasyon"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    suggestedCourtSearchTerms: [
      "yanlis recete hekim sorumluluğu", "sahte rapor duzenleme",
      "istirahat raporu sahtecilik", "recete yazma yukumlulugu",
      "kontrol edilen ilac recete"
    ],
    missingInfoHints: [
      "Reçete veya raporun içeriğinin uygunluğu",
      "Hastanın gerçek sağlık durumu ile rapor/reçete uyumu",
      "Üçüncü kişilerin talebiyle mi, yoksa kendi değerlendirmesiyle mi düzenlendiği"
    ]
  },
  {
    id: "death_postmortem",
    label: "Ölüm Bildirimi / Adli Vaka / Defin",
    phrases: [
      "olum bildirimi",
      "ölüm bildirimi",
      "adli vaka",
      "defin ruhsati",
      "defin ruhsatı",
      "olum sonrasi",
      "ölüm sonrası",
      "olum belgesi",
      "ölüm belgesi",
      "adli otopsi",
      "adli tabip",
      "sebebi bilinmeyen olum",
      "sebebi bilinmeyen ölüm",
      "ani olum",
      "ani ölüm",
      "olume sebebiyet",
      "ölüme sebebiyet"
    ],
    terms: [
      "olum", "ölüm", "defin", "otopsi", "adli", "morg", "cenaze"
    ],
    suggestedTopicClusters: ["physician_duty_of_care", "professional_ethics"],
    suggestedCourtSearchTerms: [
      "olum bildirimi yukumlulugu", "adli vaka bildirim",
      "defin ruhsati duzenleme", "adli tabip yonlendirme",
      "sebebi bilinmeyen olum adli"
    ],
    missingInfoHints: [
      "Ölümün adli vakaya mı, doğal ölüme mi konu olduğu",
      "Hekimin ölüm anında veya öncesinde olaydan haberdar olup olmadığı",
      "Defin ruhsatı veya ölüm belgesinin düzenlenip düzenlenmediği"
    ]
  },
  {
    id: "public_employment",
    label: "Kamu İstihdamı / Atama / Tayin",
    phrases: [
      "tayin reddi",
      "tayin islemi",
      "tayin işlemi",
      "atama islemi",
      "atama işlemi",
      "yer degistirme",
      "yer değiştirme",
      "kamu atamasi",
      "kamu ataması",
      "memur tayini",
      "hekim tayini",
      "saglik personeli atamasi",
      "sağlık personeli ataması",
      "kadro atamasi",
      "kadro ataması",
      "açıktan kura",
      "görevde yükselme",
      "unvan değişikliği",
      // v0.23.1 — public-physician query profiles
      "tayin talebim reddedildi",
      "tayin istemi",
      "atama başvurusu",
      "nakil talebi",
      "ek ödeme yapılmadı",
      "ek ödemem eksik",
      "döner sermaye ödenmedi",
      "performans puanı",
      "mecburi hizmet",
      "devlet hizmeti yükümlülüğü",
      "zorunlu hizmet"
    ],
    terms: [
      "tayin", "atama", "nakil", "yer değiştirme", "yer degistirme", "mazeret",
      "kadro", "görevde yükselme", "terfi", "açıktan kura",
      // v0.23.1 — public-physician query profiles
      "ek ödeme", "performans", "döner sermaye", "mecburi hizmet", "dhy", "zorunlu hizmet"
    ],
    suggestedTopicClusters: ["public_employment", "transfer_assignment"],
    suggestedCourtSearchTerms: [
      "tayin iptali saglik", "atama islemi hekim",
      "yer degistirme dava", "kamu gorevlisi tayin",
      "saglik personeli atama iptali",
      "ek odeme eksikligi saglik", "doner sermaye odenmedi",
      "mecburi hizmet sureci saglik", "dhy yukumlulugu hekim"
    ],
    missingInfoHints: [
      "Hekimin kamu mu, özel mi kuruluşa tabi olduğu",
      "Tayin/atamanın hangi mevzuata dayandığı (4924, 657, özel yasa)",
      "İşleme karşı idari dava açılıp açılmadığı",
      "Sözleşmeli mi, kadrolu mu personel olduğu",
      "Ek ödemeye ilişkin mevzuat dayanağı (Ek Ödeme Yönetmeliği)",
      "Mecburi hizmet süresinin ne kadar kaldığı"
    ]
  },
  {
    id: "transfer_assignment",
    label: "Yer Değiştirme / Nakil / Mazeret Tayini",
    phrases: [
      "es durumu tayini",
      "eş durumu tayini",
      "mazeret tayini",
      "mazeret atamasi",
      "mazeret ataması",
      "becayis tayini",
      "becayiş tayini",
      "nakil islemi",
      "nakil işlemi",
      "yer degistirme talebi",
      "yer değiştirme talebi",
      "tayin nakil",
      "eş durumu nakil",
      "sağlık mazereti tayini"
    ],
    terms: [
      "eş durumu", "es durumu", "mazeret tayini", "becayiş", "becayis",
      "nakil", "yer değiştirme", "yer degistirme"
    ],
    suggestedTopicClusters: ["transfer_assignment", "public_employment"],
    suggestedCourtSearchTerms: [
      "es durumu tayini saglik", "mazeret tayini hekim",
      "becayis tayini dava", "yer degistirme iptal",
      "nakil islemi saglik personeli"
    ],
    missingInfoHints: [
      "Hangi mevzuata dayalı yer değiştirme talebi olduğu",
      "Eş durumu veya sağlık mazereti olup olmadığı",
      "Talebin idare tarafından reddedilip edilmediği",
      "İdari dava açılıp açılmadığı"
    ]
  },
  {
    id: "unclear_or_mixed",
    label: "Belirsiz / Karma Konu",
    phrases: [],
    terms: [],
    suggestedTopicClusters: [],
    suggestedCourtSearchTerms: [],
    missingInfoHints: [
      "Uyuşmazlığın hukuki boyutu (ceza, tazminat, idari, etik)",
      "Müdahalenin türü ve tarihi",
      "Tarafların kimler olduğu (hekim, hasta, kurum)",
      "Herhangi bir resmi başvuru veya soruşturmanın bulunup bulunmadığı"
    ]
  }
];

// ─── Confidence Thresholds ─────────────────────────────────────────────────────

const SCORE_HIGH = 5;
const SCORE_MEDIUM = 2;
// score >= 1 → low

// ─── Routing Logic ─────────────────────────────────────────────────────────────

function scoreIssue(
  normalized: string,
  definition: IssueDefinition
): { score: number; matchedTerms: string[] } {
  const matchedTerms: string[] = [];
  let score = 0;

  // Phrase hits (+3 each)
  for (const phrase of definition.phrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (normalized.includes(normalizedPhrase)) {
      score += 3;
      matchedTerms.push(phrase);
    }
  }

  // Single-term hits (+1 each, only if phrase not already matched to avoid double-counting)
  for (const term of definition.terms) {
    const normalizedTerm = normalizeText(term);
    // Skip if a phrase containing this term already matched
    const alreadyMatchedByPhrase = matchedTerms.some((matched) =>
      normalizeText(matched).includes(normalizedTerm)
    );
    if (!alreadyMatchedByPhrase && normalized.includes(normalizedTerm)) {
      score += 1;
      matchedTerms.push(term);
    }
  }

  return { score, matchedTerms };
}

function toConfidence(score: number): RouteConfidence {
  if (score >= SCORE_HIGH) return "high";
  if (score >= SCORE_MEDIUM) return "medium";
  return "low";
}

function buildReason(definition: IssueDefinition, matchedTerms: string[], score: number): string {
  if (matchedTerms.length === 0) return `${definition.label} ile ilgili belirleyici bir sinyal bulunamadi.`;
  const termList = matchedTerms.slice(0, 4).map((t) => `"${t}"`).join(", ");
  return `Soru metni ${termList} ${matchedTerms.length > 1 ? "ifadelerini iceriyor" : "ifadesini iceriyor"} (puan: ${score}). ${definition.label} ekseni ilgili gorunuyor.`;
}

// ─── Main Export ───────────────────────────────────────────────────────────────

/**
 * Route a physician's free-text question to one or more legal issue categories.
 *
 * - Purely deterministic; no LLM, no network.
 * - Returns routes sorted by score (highest first).
 * - Returns `unclear_or_mixed` when no issue scores ≥ 1.
 * - Never produces legal opinions, risk levels, or action plans.
 */
export function routeMedicalIssue(input: string): MedicalIssueRouterResult {
  if (!input || !input.trim()) {
    return {
      normalizedQuestion: "",
      routes: [{
        issueId: "unclear_or_mixed",
        label: "Belirsiz / Karma Konu",
        confidence: "low",
        score: 0,
        matchedTerms: [],
        reason: "Soru metni bos veya yetersiz.",
        suggestedTopicClusters: [],
        suggestedCourtSearchTerms: [],
      }],
      primaryIssueId: "unclear_or_mixed",
      missingInfoHints: ISSUE_DEFINITIONS.find((d) => d.id === "unclear_or_mixed")!.missingInfoHints,
      routerWarnings: ["Soru metni bos; anlamli bir yonlendirme yapilamadi."]
    };
  }

  const normalized = normalizeText(input);

  const scored = ISSUE_DEFINITIONS
    .filter((d) => d.id !== "unclear_or_mixed")
    .map((definition) => {
      const { score, matchedTerms } = scoreIssue(normalized, definition);
      return { definition, score, matchedTerms };
    })
    .filter((entry) => entry.score >= 1)
    .sort((a, b) => b.score - a.score);

  const routerWarnings: string[] = [];

  // Safety invariants: detect forbidden patterns in the QUESTION (not generated content)
  // These are informational only — the router does not refuse to route.
  // (No risk-level output, no legal conclusions are generated by this router.)

  if (scored.length === 0) {
    return {
      normalizedQuestion: normalized,
      routes: [{
        issueId: "unclear_or_mixed",
        label: "Belirsiz / Karma Konu",
        confidence: "low",
        score: 0,
        matchedTerms: [],
        reason: "Soru metninde taninan bir hukuki issue sinyali bulunamadi.",
        suggestedTopicClusters: [],
        suggestedCourtSearchTerms: [],
      }],
      primaryIssueId: "unclear_or_mixed",
      missingInfoHints: ISSUE_DEFINITIONS.find((d) => d.id === "unclear_or_mixed")!.missingInfoHints,
      routerWarnings: ["Taninan hukuki issue sinyali yok; soru metni yetersiz olabilir."]
    };
  }

  const routes: MedicalIssueRoute[] = scored.map(({ definition, score, matchedTerms }) => ({
    issueId: definition.id,
    label: definition.label,
    confidence: toConfidence(score),
    score,
    matchedTerms,
    reason: buildReason(definition, matchedTerms, score),
    suggestedTopicClusters: definition.suggestedTopicClusters,
    suggestedCourtSearchTerms: definition.suggestedCourtSearchTerms,
  }));

  // If top route is only low-confidence and there are multiple competing routes,
  // warn that the question may be mixed.
  if (routes[0].confidence === "low" || (routes.length >= 3 && routes[0].score < SCORE_HIGH)) {
    routerWarnings.push("Birden fazla issue ekseni dusuk skorla eslesti; soru karma veya eksik bilgi iceriyor olabilir.");
  }

  // Collect missingInfoHints from all matched issues (deduplicated)
  const seenHints = new Set<string>();
  const missingInfoHints: string[] = [];
  for (const { definition } of scored) {
    for (const hint of definition.missingInfoHints) {
      if (!seenHints.has(hint)) {
        seenHints.add(hint);
        missingInfoHints.push(hint);
      }
    }
  }

  return {
    normalizedQuestion: normalized,
    routes,
    primaryIssueId: routes[0].issueId,
    missingInfoHints: missingInfoHints.slice(0, 8), // cap to avoid bloat
    routerWarnings
  };
}
