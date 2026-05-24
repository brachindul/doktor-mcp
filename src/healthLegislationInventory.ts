/**
 * Official Health Legislation Inventory (v0.28.0)
 *
 * Canonical list of physician-relevant Turkish health legislation with
 * access-status classification and coverage tracking.
 *
 * Design rules:
 * - Only `verified` entries may be added to the active HealthLegislationHint registry.
 * - `candidate` entries are awaiting official source ID confirmation.
 * - `gap` entries are known important legislation whose mevzuat.gov.tr IDs
 *   could not be confirmed; documented for transparency.
 * - `deferred` entries are out of scope for the current release.
 * - No gov.tr-external URLs are accepted as `verified`.
 * - No risk levels, urgent actions, or definitional legal opinions produced here.
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type HealthLegislationAccessStatus =
  | "verified"      // Official sourceId confirmed; active in HealthLegislationHint registry
  | "candidate"     // Likely official source exists; ID/URL not yet confirmed in this codebase
  | "gap"           // Known important legislation; official source ID unconfirmed
  | "deferred";     // Out of scope for this release cycle

export type HealthLegislationRelevanceLevel =
  | "core"          // Directly governs physician duties, rights, and liability
  | "supporting"    // Frequently relevant but not primary authority
  | "specialized";  // Relevant only in specific clinical/specialty contexts

export type HealthLegislationCategory =
  | "physician_practice"      // Core practice and competence statutes
  | "patient_rights"          // Patient rights and informed consent regulations
  | "professional_ethics"     // Deontology and ethics rules
  | "data_privacy"            // KVKK and health data regulations
  | "private_health_facility" // Private hospital and clinic regulations
  | "emergency_services"      // Emergency care and ambulance regulations
  | "occupational_health"     // Workplace medicine regulations
  | "organ_tissue"            // Organ/tissue donation and transplant
  | "blood_products"          // Blood and blood product regulations
  | "reproductive_medicine"   // Assisted reproductive technology
  | "home_health"             // Home health care regulations
  | "complementary_medicine"  // GETAT and alternative medicine
  | "diagnostics"             // Laboratory and radiology regulations
  | "discipline"              // Disciplinary and administrative proceedings
  | "insurance";              // Professional liability insurance

export interface HealthLegislationInventoryEntry {
  /** Stable key for dedup and reference */
  key: string;
  /** Full official Turkish title */
  title: string;
  /** Normalized ASCII title for matching */
  titleNormalized: string;
  category: HealthLegislationCategory;
  relevanceLevel: HealthLegislationRelevanceLevel;
  officialSourceRequired: boolean;
  officialSourceStatus: HealthLegislationAccessStatus;
  /** mevzuat.gov.tr sourceId (format: type.arrangement.number) — only set for verified */
  mevzuatSourceId?: string;
  /** Official URL on mevzuat.gov.tr — only set for verified */
  officialUrl?: string;
  /** Legislation number (kanun/yönetmelik no) */
  legislationNumber?: string;
  /** Medical issue IDs this legislation is relevant to */
  relatedIssueIds: string[];
  /** Topic clusters this legislation maps to */
  relatedTopicClusters: string[];
  /** Search terms for retrieval */
  searchTerms: string[];
  /** Coverage status relative to active adapter registry */
  coverageStatus: "covered" | "candidate" | "gap" | "deferred";
  /** Free-text notes for transparency */
  notes: string[];

  // ── v0.30.0 query-recall fields ──────────────────────────────────────────
  /** Alternative title forms for alias matching during verification */
  aliases?: string[];
  /** Expected legislation type — used for type-mismatch rejection */
  expectedLegislationType?: "kanun" | "yonetmelik" | "nizamname";
  /** Expected Official Gazette date (YYYY-MM-DD) — used for metadata scoring */
  expectedRgDate?: string;
  /** Expected Official Gazette number — used for metadata scoring */
  expectedRgNumber?: string;
  /**
   * Unconfirmed candidate mevzuat sourceId lead.
   * Enables sourceId-probe verification path when title match ≥ 0.50.
   * MUST be validated by title match before activation; never used as standalone verified signal.
   */
  candidateLegacySourceId?: string;
}

export interface HealthLegislationInventoryReport {
  inventoryTotalCount: number;
  coreInventoryCount: number;
  supportingInventoryCount: number;
  specializedInventoryCount: number;
  verifiedOfficialSourceCount: number;
  candidateOfficialSourceCount: number;
  gapCount: number;
  deferredCount: number;
  coveredByActiveHintsCount: number;
  uncoveredCoreCount: number;
  inventoryByCategory: Record<HealthLegislationCategory, number>;
  inventoryByAccessStatus: Record<HealthLegislationAccessStatus, number>;
  verifiedEntries: HealthLegislationInventoryEntry[];
  candidateEntries: HealthLegislationInventoryEntry[];
  gapEntries: HealthLegislationInventoryEntry[];
  deferredEntries: HealthLegislationInventoryEntry[];
  coverageWarnings: string[];
}

// ──────────────────────────────────────────────────────────────
// Inventory data
// ──────────────────────────────────────────────────────────────

/**
 * Canonical inventory of physician-relevant Turkish health legislation.
 * Ordered: verified first, then candidate, gap, deferred.
 */
export const HEALTH_LEGISLATION_INVENTORY: HealthLegislationInventoryEntry[] = [

  // ── VERIFIED — active in HealthLegislationHint registry ─────────────────

  {
    key: "hasta-haklari-yonetmeligi",
    title: "Hasta Hakları Yönetmeliği",
    titleNormalized: "hasta haklari yonetmeligi",
    category: "patient_rights",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:7.5.4847",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.4847.pdf",
    legislationNumber: "4847",
    relatedIssueIds: ["informed_consent", "patient_rights", "emergency_intervention", "records_epicrisis"],
    relatedTopicClusters: ["informed_consent", "medical_intervention", "patient_rights", "patient_privacy", "records_epicrisis", "emergency_intervention", "referral_consultation"],
    searchTerms: ["hasta haklari", "hasta hakları", "rıza", "onam", "aydınlatma"],
    coverageStatus: "covered",
    notes: ["sourceId confirmed; active in healthMappings.ts"]
  },

  {
    key: "tibbi-deontoloji-nizamnamesi",
    title: "Tıbbi Deontoloji Nizamnamesi",
    titleNormalized: "tibbi deontoloji nizamnamesi",
    category: "professional_ethics",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:2.3.412578",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/2.3.412578.pdf",
    legislationNumber: "412578",
    relatedIssueIds: ["physician_duty_of_care", "professional_ethics", "physician_refusal_or_withdrawal"],
    relatedTopicClusters: ["physician_duty_of_care", "professional_ethics", "physician_refusal_or_withdrawal", "patient_noncompliance"],
    searchTerms: ["deontoloji", "mesleki etik", "hekim yükümlülüğü", "özen"],
    coverageStatus: "covered",
    notes: ["sourceId confirmed; active in healthMappings.ts"]
  },

  {
    key: "tababet-kanunu",
    title: "Tababet ve Şuabatı San'atlarının Tarzı İcrasına Dair Kanun",
    titleNormalized: "tababet ve suabati sanatlarinin tarzi icrasina dair kanun",
    category: "physician_practice",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:1.3.1219",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.3.1219.pdf",
    legislationNumber: "1219",
    relatedIssueIds: ["medical_intervention", "professional_scope_of_practice", "physician_refusal_or_withdrawal"],
    relatedTopicClusters: ["medical_intervention", "professional_scope_of_practice", "private_health_facility"],
    searchTerms: ["tababet", "hekimlik", "1219", "tıbbi müdahale"],
    coverageStatus: "covered",
    notes: ["sourceId confirmed; active in healthMappings.ts"]
  },

  {
    key: "saglik-hizmetleri-temel-kanunu",
    title: "Sağlık Hizmetleri Temel Kanunu",
    titleNormalized: "saglik hizmetleri temel kanunu",
    category: "physician_practice",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:1.5.3359",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.3359.pdf",
    legislationNumber: "3359",
    relatedIssueIds: ["patient_rights", "professional_scope_of_practice", "private_health_facility"],
    relatedTopicClusters: ["patient_rights", "professional_scope_of_practice", "private_health_facility", "patient_noncompliance"],
    searchTerms: ["sağlık hizmetleri", "3359", "sağlık hizmet kanunu"],
    coverageStatus: "covered",
    notes: ["sourceId confirmed; active in healthMappings.ts"]
  },

  {
    key: "kvkk",
    title: "Kişisel Verilerin Korunması Kanunu",
    titleNormalized: "kisisel verilerin korunmasi kanunu",
    category: "data_privacy",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:1.5.6698",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6698.pdf",
    legislationNumber: "6698",
    relatedIssueIds: ["personal_health_data"],
    relatedTopicClusters: ["personal_health_data"],
    searchTerms: ["KVKK", "kişisel sağlık verisi", "veri koruma"],
    coverageStatus: "covered",
    notes: ["sourceId confirmed; active in healthMappings.ts; supporting role only"]
  },

  // ── GAP — important but mevzuat.gov.tr ID unconfirmed ────────────────────

  {
    key: "ozel-hastaneler-yonetmeligi",
    title: "Özel Hastaneler Yönetmeliği",
    titleNormalized: "ozel hastaneler yonetmeligi",
    category: "private_health_facility",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "gap",
    relatedIssueIds: ["private_health_facility"],
    relatedTopicClusters: ["private_health_facility"],
    searchTerms: ["özel hastane", "özel sağlık kuruluşu"],
    coverageStatus: "gap",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Özel Hastaneler Hakkında Yönetmelik",
      "Özel Hastane Yönetmeliği"
    ],
    notes: [
      "Known gap since v0.22.0 — mevzuat.gov.tr internal ID not confirmed.",
      "Do not add to active adapter registry until official sourceId verified.",
      "Governs licensing, staffing, and operation of private hospitals.",
      "v0.30.0: exact title and aliases added to query plan."
    ]
  },

  {
    key: "ayakta-teshis-ozel-saglik",
    title: "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik",
    titleNormalized: "ayakta teshis ve tedavi yapilan ozel saglik kuruluslari hakkinda yonetmelik",
    category: "private_health_facility",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "gap",
    relatedIssueIds: ["private_health_facility"],
    relatedTopicClusters: ["private_health_facility"],
    searchTerms: ["ayakta tedavi", "özel sağlık kuruluşu", "poliklinik"],
    coverageStatus: "gap",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Yönetmeliği",
      "Özel Ayakta Sağlık Kuruluşları Yönetmeliği"
    ],
    notes: [
      "Known gap since v0.22.0 — mevzuat.gov.tr internal ID not confirmed.",
      "Do not add to active adapter registry until official sourceId verified.",
      "Governs outpatient private clinics and polyclinics.",
      "v0.30.0: exact title and aliases added to query plan."
    ]
  },

  {
    key: "saglik-meslek-is-gorev-tanimlari",
    title: "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
    titleNormalized: "saglik meslek mensuplari ile saglik hizmetlerinde calisan diger meslek mensuplarinin is ve gorev tanimlarina dair yonetmelik",
    category: "physician_practice",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:7.5.19696",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf",
    legislationNumber: "19696",
    relatedIssueIds: ["professional_scope_of_practice", "disciplinary_administrative", "patient_rights"],
    relatedTopicClusters: ["professional_scope_of_practice"],
    searchTerms: [
      "görev tanımı", "sağlık meslek mensubu", "iş tanımı",
      "yetki sınırı", "branş dışı", "ekip hizmeti", "yardımcı sağlık personeli"
    ],
    coverageStatus: "covered",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2014-05-22",
    expectedRgNumber: "29007",
    candidateLegacySourceId: "mevzuat:7.5.19696",
    aliases: [
      "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
      "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      "Sağlık Meslek Mensupları ile Diğer Meslek Mensupları Görev Tanımları"
    ],
    notes: [
      "v0.31.0: sourceId mevzuat:7.5.19696 confirmed via direct sourceId PDF fetch (mevzuat.gov.tr).",
      "Title match: 0.778; markerScore: 0.750; RG 29007 (22.05.2014).",
      "active in healthMappings.ts — professional_scope_of_practice cluster."
    ]
  },

  // ── CANDIDATE — awaiting official source ID confirmation ──────────────────

  {
    key: "acil-saglik-hizmetleri-yonetmeligi",
    title: "Acil Sağlık Hizmetleri Yönetmeliği",
    titleNormalized: "acil saglik hizmetleri yonetmeligi",
    category: "emergency_services",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "candidate",
    relatedIssueIds: ["emergency_intervention"],
    relatedTopicClusters: ["emergency_intervention", "emergency_exception"],
    searchTerms: ["acil sağlık", "acil servis", "acil müdahale"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Acil Sağlık Hizmetleri Hakkında Yönetmelik"
    ],
    notes: [
      "Governs emergency care delivery obligations — highly relevant for acil intervention questions.",
      "Candidate for active coverage once mevzuat.gov.tr sourceId confirmed.",
      "v0.30.0: exact title and alias added to query plan."
    ]
  },

  {
    key: "aile-hekimligi-kanunu",
    title: "Aile Hekimliği Kanunu",
    titleNormalized: "aile hekimligi kanunu",
    category: "physician_practice",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:1.5.5258",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.5258.pdf",
    legislationNumber: "5258",
    relatedIssueIds: ["professional_scope_of_practice"],
    relatedTopicClusters: ["professional_scope_of_practice"],
    searchTerms: ["aile hekimi", "aile hekimliği", "5258"],
    coverageStatus: "covered",
    notes: [
      "Kanun 5258 — governs family medicine practice.",
      "Relevant primarily for primary care physician questions.",
      "v0.29.0: sourceId mevzuat:1.5.5258 confirmed via live mevzuat.gov.tr search (score 1.000)."
    ]
  },

  {
    key: "is-sagligi-guvenligi-kanunu",
    title: "İş Sağlığı ve Güvenliği Kanunu",
    titleNormalized: "is sagligi ve guvenligi kanunu",
    category: "occupational_health",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:1.5.6331",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6331.pdf",
    legislationNumber: "6331",
    relatedIssueIds: ["occupational_health"],
    relatedTopicClusters: ["professional_scope_of_practice"],
    searchTerms: ["iş sağlığı", "6331", "işyeri hekimi"],
    coverageStatus: "covered",
    notes: [
      "Kanun 6331 — governs workplace health and safety.",
      "Relevant for workplace physician duty questions.",
      "v0.29.0: sourceId mevzuat:1.5.6331 confirmed via live mevzuat.gov.tr search (score 1.000)."
    ]
  },

  {
    key: "isyeri-hekimi-yonetmeligi",
    title: "İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
    titleNormalized: "isyeri hekimi ve diger saglik personelinin gorev yetki sorumluluk egitim yonetmeligi",
    category: "occupational_health",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "candidate",
    relatedIssueIds: ["occupational_health"],
    relatedTopicClusters: ["professional_scope_of_practice"],
    searchTerms: ["işyeri hekimi", "iş yeri hekimi", "işyeri sağlık"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "İşyeri Hekimi Yönetmeliği",
      "İşyeri Hekimi Görev Yetki Sorumluluk Yönetmeliği"
    ],
    notes: [
      "Governs workplace physician duties, authority, and liability.",
      "Specialized — relevant for occupational health physician questions.",
      "Candidate for active coverage once sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan."
    ]
  },

  {
    key: "kisisel-saglik-verileri-yonetmeligi",
    title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
    titleNormalized: "kisisel saglik verileri hakkinda yonetmelik",
    category: "data_privacy",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    officialSourceStatus: "candidate",
    relatedIssueIds: ["personal_health_data"],
    relatedTopicClusters: ["personal_health_data"],
    searchTerms: ["kişisel sağlık verisi", "sağlık verisi yönetmelik"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Kişisel Sağlık Verileri Yönetmeliği",
      "Sağlık Verileri Hakkında Yönetmelik"
    ],
    notes: [
      "Health-specific data regulation under KVKK framework.",
      "Should accompany KVKK in health data privacy questions.",
      "Candidate for active coverage once sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan."
    ]
  },

  {
    key: "organ-doku-nakli-kanunu",
    title: "Organ ve Doku Alınması, Saklanması, Aşılanması ve Nakli Hakkında Kanun",
    titleNormalized: "organ ve doku alinmasi saklanmasi asilanmasi ve nakli hakkinda kanun",
    category: "organ_tissue",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:1.5.2238",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.2238.pdf",
    legislationNumber: "2238",
    relatedIssueIds: ["organ_tissue", "informed_consent"],
    relatedTopicClusters: ["informed_consent", "medical_intervention"],
    searchTerms: ["organ nakli", "2238", "doku nakli"],
    coverageStatus: "covered",
    notes: [
      "Kanun 2238 — governs organ/tissue donation and transplant.",
      "Specialized — relevant for transplant surgeon and ICU questions.",
      "v0.29.0: sourceId mevzuat:1.5.2238 confirmed via live mevzuat.gov.tr search (score 1.000).",
      "Arrangement=5 as returned by live search (mevzuat.gov.tr canonical classification)."
    ]
  },

  {
    key: "uyeye-yardimci-tedavi-yonetmeligi",
    title: "Üremeye Yardımcı Tedavi Uygulamaları ve Üremeye Yardımcı Tedavi Merkezleri Hakkında Yönetmelik",
    titleNormalized: "uremeye yardimci tedavi uygulamalari yonetmeligi",
    category: "reproductive_medicine",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:7.5.20085",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.20085.pdf",
    relatedIssueIds: ["reproductive_medicine", "informed_consent"],
    relatedTopicClusters: ["informed_consent", "medical_intervention"],
    searchTerms: ["tüp bebek", "IVF", "üremeye yardımcı", "ÜYTE"],
    coverageStatus: "covered",
    notes: [
      "Governs assisted reproductive technology centers and procedures.",
      "Specialized — relevant for reproductive medicine physician questions.",
      "v0.29.0: sourceId mevzuat:7.5.20085 confirmed via live mevzuat.gov.tr search (score 1.000)."
    ]
  },

  {
    key: "geleneksel-tamamlayici-tip-yonetmeligi",
    title: "Geleneksel ve Tamamlayıcı Tıp Uygulamaları Yönetmeliği",
    titleNormalized: "geleneksel ve tamamlayici tip uygulamalari yonetmeligi",
    category: "complementary_medicine",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:7.5.45117",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.45117.pdf",
    relatedIssueIds: ["professional_scope_of_practice"],
    relatedTopicClusters: ["professional_scope_of_practice"],
    searchTerms: ["GETAT", "geleneksel tıp", "tamamlayıcı tıp", "akupunktur"],
    coverageStatus: "covered",
    notes: [
      "Governs GETAT practices — relevant for scope-of-practice questions.",
      "v0.29.0: sourceId mevzuat:7.5.45117 confirmed via live mevzuat.gov.tr search (score 1.000)."
    ]
  },

  {
    key: "saglik-bakanligi-disiplin-yonetmeligi",
    title: "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik",
    titleNormalized: "saglik bakanligi disiplin amirleri disiplin kurullari ile ilgili yonetmelik",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["professional_ethics"],
    searchTerms: ["disiplin soruşturması", "disiplin kurulu", "Sağlık Bakanlığı disiplin"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Sağlık Bakanlığı Disiplin Yönetmeliği",
      "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği"
    ],
    notes: [
      "Governs Ministry of Health disciplinary proceedings against health staff.",
      "Relevant for all administrative disciplinary questions.",
      "Candidate for active coverage once sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan."
    ]
  },

  // ── DEFERRED — out of scope for this release ──────────────────────────────

  {
    key: "ambulans-acil-araclar-yonetmeligi",
    title: "Ambulanslar ve Acil Sağlık Araçları ile Ambulans Hizmetleri Yönetmeliği",
    titleNormalized: "ambulanslar ve acil saglik araclari ile ambulans hizmetleri yonetmeligi",
    category: "emergency_services",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "deferred",
    relatedIssueIds: [],
    relatedTopicClusters: [],
    searchTerms: ["ambulans", "acil araç"],
    coverageStatus: "deferred",
    notes: [
      "Governs ambulance vehicle standards — not primarily physician-facing.",
      "Deferred: low relevance for physician liability questions.",
      "May be revisited if emergency transport physician questions emerge."
    ]
  },

  {
    key: "yatakli-tedavi-isletme-yonetmeligi",
    title: "Yataklı Tedavi Kurumları İşletme Yönetmeliği",
    titleNormalized: "yatakli tedavi kurumlari isletme yonetmeligi",
    category: "private_health_facility",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    officialSourceStatus: "deferred",
    relatedIssueIds: ["private_health_facility"],
    relatedTopicClusters: ["private_health_facility"],
    searchTerms: ["yataklı tedavi kurumu", "hastane işletme"],
    coverageStatus: "deferred",
    notes: [
      "Governs inpatient facility operations — partially superseded by newer regulations.",
      "Deferred: official currency and sourceId unverified; may overlap with Özel Hastaneler Yönetmeliği."
    ]
  },

  {
    key: "hekim-mesleki-sorumluluk-sigortasi",
    title: "Hekim Mesleki Mali Sorumluluk Sigortası İlgili Düzenlemeler",
    titleNormalized: "hekim mesleki mali sorumluluk sigortasi",
    category: "insurance",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "deferred",
    relatedIssueIds: [],
    relatedTopicClusters: [],
    searchTerms: ["mesleki sorumluluk sigortası", "hekim sigortası", "tıbbi kötü uygulama sigortası"],
    coverageStatus: "deferred",
    notes: [
      "Multiple scattered regulatory instruments; no single canonical mevzuat entry identified.",
      "Deferred: requires dedicated sourceId research before activation."
    ]
  },

  {
    key: "radyoloji-hizmetleri-yonetmeligi",
    title: "Radyoloji Hizmetleri Yönetmeliği",
    titleNormalized: "radyoloji hizmetleri yonetmeligi",
    category: "diagnostics",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    officialSourceStatus: "deferred",
    relatedIssueIds: [],
    relatedTopicClusters: [],
    searchTerms: ["radyoloji", "röntgen", "görüntüleme"],
    coverageStatus: "deferred",
    notes: [
      "Governs radiology department standards.",
      "Deferred: specialty-specific, low frequency in benchmark questions."
    ]
  }
];

// ──────────────────────────────────────────────────────────────
// Helper: set of active mevzuatSourceIds (for cross-referencing with healthMappings)
// ──────────────────────────────────────────────────────────────

export const VERIFIED_MEVZUAT_SOURCE_IDS: ReadonlySet<string> = new Set(
  HEALTH_LEGISLATION_INVENTORY
    .filter((e) => e.officialSourceStatus === "verified" && e.mevzuatSourceId)
    .map((e) => e.mevzuatSourceId!)
);

// ──────────────────────────────────────────────────────────────
// buildInventoryReport
// ──────────────────────────────────────────────────────────────

/**
 * Build a summary report from the inventory.
 * Pure function — no network calls, no adapter dependencies.
 */
export function buildInventoryReport(): HealthLegislationInventoryReport {
  const verified = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "verified");
  const candidate = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "candidate");
  const gap = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "gap");
  const deferred = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.officialSourceStatus === "deferred");

  const byCategory: Record<HealthLegislationCategory, number> = {} as Record<HealthLegislationCategory, number>;
  const byAccessStatus: Record<HealthLegislationAccessStatus, number> = {
    verified: 0, candidate: 0, gap: 0, deferred: 0
  };

  for (const entry of HEALTH_LEGISLATION_INVENTORY) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    byAccessStatus[entry.officialSourceStatus]++;
  }

  const coreCount = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.relevanceLevel === "core").length;
  const supportingCount = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.relevanceLevel === "supporting").length;
  const specializedCount = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.relevanceLevel === "specialized").length;

  const coveredByActiveHints = verified.filter((e) => e.coverageStatus === "covered").length;
  const uncoveredCore = HEALTH_LEGISLATION_INVENTORY.filter(
    (e) => e.relevanceLevel === "core" && e.coverageStatus !== "covered"
  ).length;

  const coverageWarnings: string[] = [];
  if (gap.length > 0) {
    coverageWarnings.push(
      `${gap.length} gap entry/entries — official sourceId unconfirmed; not active in adapter registry: ` +
      gap.map((e) => e.titleNormalized).join("; ")
    );
  }
  if (candidate.length > 0) {
    coverageWarnings.push(
      `${candidate.length} candidate entry/entries awaiting sourceId confirmation: ` +
      candidate.map((e) => e.titleNormalized).join("; ")
    );
  }
  const govTrViolations = verified.filter(
    (e) => e.officialUrl && !e.officialUrl.includes("mevzuat.gov.tr")
  );
  if (govTrViolations.length > 0) {
    coverageWarnings.push(
      `INTEGRITY ERROR: ${govTrViolations.length} verified entry/entries have non-gov.tr URLs — ` +
      govTrViolations.map((e) => e.key).join(", ")
    );
  }

  return {
    inventoryTotalCount: HEALTH_LEGISLATION_INVENTORY.length,
    coreInventoryCount: coreCount,
    supportingInventoryCount: supportingCount,
    specializedInventoryCount: specializedCount,
    verifiedOfficialSourceCount: verified.length,
    candidateOfficialSourceCount: candidate.length,
    gapCount: gap.length,
    deferredCount: deferred.length,
    coveredByActiveHintsCount: coveredByActiveHints,
    uncoveredCoreCount: uncoveredCore,
    inventoryByCategory: byCategory,
    inventoryByAccessStatus: byAccessStatus,
    verifiedEntries: verified,
    candidateEntries: candidate,
    gapEntries: gap,
    deferredEntries: deferred,
    coverageWarnings
  };
}
