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

export type LegislationClassification =
  | "kanun"       // Statute (mevzuat type=1)
  | "yonetmelik"  // Regulation (mevzuat type=7, 21)
  | "nizamname"   // Decree (mevzuat type=2)
  | "teblig";     // Communique / other

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
  | "insurance"               // Professional liability insurance
  | "medical_education"       // Medical education and specialization training
  | "service_quality"         // Healthcare service quality and safety
  | "forensic_administrative";// Clinical-forensic and death procedures

export interface HealthLegislationInventoryEntry {
  /** Stable key for dedup and reference */
  key: string;
  /** Full official Turkish title */
  title: string;
  /** Normalized ASCII title for matching */
  titleNormalized: string;
  category: HealthLegislationCategory;
  relevanceLevel: HealthLegislationRelevanceLevel;
  /** Classification by Turkish legislative hierarchy: kanun, yonetmelik, nizamname, or teblig */
  legislationType: LegislationClassification;
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

  // ── v0.32.0 direct-access enhancement fields ──────────────────────────────
  /** Content marker terms for direct PDF verification — checks if these appear in document text */
  markerTerms?: string[];
  /** Terms that indicate a wrong document — if ANY present, reject regardless of title score */
  negativeMarkerTerms?: string[];
  /** Explicit known-wrong sourceId patterns to reject immediately */
  knownWrongMatches?: string[];
  /**
   * Unconfirmed candidate official PDF URL lead.
   * Used for direct URL probe before relying on search API.
   * MUST be gov.tr; never used as standalone verified signal.
   */
  candidateOfficialUrlLead?: string;
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
  inventoryByLegislationType: Record<LegislationClassification, number>;
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
    legislationType: "yonetmelik",
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
    legislationType: "nizamname",
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
    legislationType: "kanun",
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
    legislationType: "kanun",
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
    legislationType: "kanun",
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
    legislationType: "yonetmelik",
    officialSourceStatus: "gap",
    relatedIssueIds: ["private_health_facility"],
    relatedTopicClusters: ["private_health_facility"],
    searchTerms: ["özel hastane", "özel sağlık kuruluşu"],
    coverageStatus: "gap",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2014-03-27",
    expectedRgNumber: "29092",
    candidateLegacySourceId: "mevzuat:7.5.29092",
    candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.29092.pdf",
    aliases: [
      "Özel Hastaneler Hakkında Yönetmelik",
      "Özel Hastane Yönetmeliği",
      "Özel Hastaneler Yönetmeliği Hakkında"
    ],
    markerTerms: [
      "özel hastane",
      "ruhsat",
      "mesul müdür",
      "sağlık kuruluşu",
      "özel hastaneler"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.7191",  // Makine ve Kimya
      "mevzuat:1.5.6001",  // Karayolları
      "mevzuat:7.5.29134"  // Radyasyon Güvenliği
    ],
    notes: [
      "Known gap since v0.22.0 — mevzuat.gov.tr internal ID not confirmed.",
      "Do not add to active adapter registry until official sourceId verified.",
      "Governs licensing, staffing, and operation of private hospitals.",
      "v0.30.0: exact title and aliases added to query plan.",
      "v0.32.0: markerTerms, RG metadata, candidateLegacySourceId, knownWrongMatches added.",
      "v0.44.0 verification attempt (2026-05-30):",
      "  - candidateLegacySourceId mevzuat:7.5.29092 direct PDF fetch returned HTML (Cloudflare anti-bot).",
      "  - Search API returned mevzuat:1.5.6428 as best match (kanun, type mismatch — expected yonetmelik).",
      "  - RG resolver returned mevzuat:1.5.6428 (title match 0.200 < 0.50 threshold).",
      "  - RG document verification (resmigazete.gov.tr): content mismatch, title score 0.000.",
      "  - All 4 CLIs attempted: verify:health-legislation, verify:discovered-health-legislation,",
      "    verify:official-gazette-health-legislation, resolve:health-legislation-rg-leads.",
      "  - BLOCKER: mevzuat.gov.tr Cloudflare anti-bot blocks direct PDF download for type-7 yonetmeliks.",
      "  - Status remains gap — cannot verify without confirmed mevzuat.gov.tr sourceId."
    ]
  },

  {
    key: "ayakta-teshis-ozel-saglik",
    title: "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik",
    titleNormalized: "ayakta teshis ve tedavi yapilan ozel saglik kuruluslari hakkinda yonetmelik",
    category: "private_health_facility",
    relevanceLevel: "core",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "gap",
    relatedIssueIds: ["private_health_facility"],
    relatedTopicClusters: ["private_health_facility"],
    searchTerms: ["ayakta tedavi", "özel sağlık kuruluşu", "poliklinik"],
    coverageStatus: "gap",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2014-02-17",
    expectedRgNumber: "29058",
    aliases: [
      "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Yönetmeliği",
      "Özel Ayakta Sağlık Kuruluşları Yönetmeliği",
      "Ayakta Teşhis Tedavi Özel Sağlık Yönetmeliği"
    ],
    markerTerms: [
      "ayakta teşhis",
      "tedavi yapılan özel sağlık kuruluşları",
      "tıp merkezi",
      "poliklinik",
      "muayenehane"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.7191",  // Makine ve Kimya
      "mevzuat:7.5.29134", // Radyasyon Güvenliği
      "mevzuat:1.5.6475"   // Posta Hizmetleri
    ],
    notes: [
      "Known gap since v0.22.0 — mevzuat.gov.tr internal ID not confirmed.",
      "Do not add to active adapter registry until official sourceId verified.",
      "Governs outpatient private clinics and polyclinics.",
      "v0.30.0: exact title and aliases added to query plan.",
      "v0.32.0: markerTerms, RG metadata, knownWrongMatches added.",
      "v0.44.0 verification attempt (2026-05-30):",
      "  - No candidateLegacySourceId available.",
      "  - Search API best match: SAĞLIK RAPORLARI YÖNETMELİĞİ (mevzuat:21.5.11361, score 0.500 < 0.75 threshold).",
      "  - RG resolver returned mevzuat:21.5.7077 (title match 0.000 — wrong document).",
      "  - RG document verification (resmigazete.gov.tr): content mismatch, title score 0.000.",
      "  - BLOCKER: mevzuat.gov.tr search API does not return a close title match for this legislation.",
      "  - Status remains gap — manual mevzuat.gov.tr search needed."
    ]
  },

  {
    key: "saglik-meslek-is-gorev-tanimlari",
    title: "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
    titleNormalized: "saglik meslek mensuplari ile saglik hizmetlerinde calisan diger meslek mensuplarinin is ve gorev tanimlarina dair yonetmelik",
    category: "physician_practice",
    relevanceLevel: "core",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
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
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["emergency_intervention"],
    relatedTopicClusters: ["emergency_intervention", "emergency_exception"],
    searchTerms: ["acil sağlık", "acil servis", "acil müdahale"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2015-04-12",
    expectedRgNumber: "29332",
    aliases: [
      "Acil Sağlık Hizmetleri Hakkında Yönetmelik",
      "Acil Sağlık Hizmetleri Yönetmeliği Hakkında"
    ],
    markerTerms: [
      "acil sağlık hizmetleri",
      "acil servis",
      "ambulans",
      "komuta kontrol merkezi",
      "acil müdahale"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.6475",  // Posta Hizmetleri
      "mevzuat:1.5.6001",  // Karayolları
      "mevzuat:1.5.7191"   // Makine ve Kimya
    ],
    notes: [
      "Governs emergency care delivery obligations — highly relevant for acil intervention questions.",
      "Candidate for active coverage once mevzuat.gov.tr sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan.",
      "v0.32.0: markerTerms, RG metadata, knownWrongMatches added.",
      "v0.44.0 verification attempt (2026-05-30):",
      "  - No candidateLegacySourceId available.",
      "  - Search API returned AFET VE ACİL DURUM YÖNETİMİ BAŞKANLIĞI... (mevzuat:1.5.5902, kanun, type mismatch).",
      "  - RG resolver returned mevzuat:1.5.6475 (known wrong match: Posta Hizmetleri Kanunu).",
      "  - RG document verification (resmigazete.gov.tr): content mismatch, title score 0.000.",
      "  - BLOCKER: mevzuat.gov.tr search API does not return a close title match for this legislation.",
      "  - Status remains candidate — manual mevzuat.gov.tr search needed."
    ]
  },

  {
    key: "aile-hekimligi-kanunu",
    title: "Aile Hekimliği Kanunu",
    titleNormalized: "aile hekimligi kanunu",
    category: "physician_practice",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "kanun",
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
    legislationType: "kanun",
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
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["occupational_health"],
    relatedTopicClusters: ["professional_scope_of_practice"],
    searchTerms: ["işyeri hekimi", "iş yeri hekimi", "işyeri sağlık"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2016-08-27",
    expectedRgNumber: "29818",
    aliases: [
      "İşyeri Hekimi Yönetmeliği",
      "İşyeri Hekimi Görev Yetki Sorumluluk Yönetmeliği",
      "İşyeri Hekimi ve Diğer Sağlık Personeli Görev Yetki Sorumluluk Yönetmeliği"
    ],
    markerTerms: [
      "işyeri hekimi",
      "diğer sağlık personeli",
      "görev yetki sorumluluk",
      "iş sağlığı ve güvenliği"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.5510",  // SGK yapılandırma
      "mevzuat:1.5.6331"   // İSG Kanunu (6331) — different from the yönetmelik
    ],
    notes: [
      "Governs workplace physician duties, authority, and liability.",
      "Specialized — relevant for occupational health physician questions.",
      "Candidate for active coverage once sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan.",
      "v0.32.0: markerTerms, RG metadata, knownWrongMatches added.",
      "v0.44.0 verification attempt (2026-05-30):",
      "  - No candidateLegacySourceId available.",
      "  - Search API best match: TAPU VE KADASTRO GENEL MÜDÜRLÜĞÜ DÖNER SERMAYE İŞLETMESİ YÖNETMELİĞİ (score 0.232 — irrelevant).",
      "  - RG resolver returned mevzuat:1.5.6111 (direct PDF fetch returned HTML — Cloudflare anti-bot).",
      "  - RG document verification (resmigazete.gov.tr): content mismatch, title score 0.000.",
      "  - BLOCKER: mevzuat.gov.tr search API does not return a close title match for this legislation.",
      "  - Status remains candidate — manual mevzuat.gov.tr search needed."
    ]
  },

  {
    key: "kisisel-saglik-verileri-yonetmeligi",
    title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
    titleNormalized: "kisisel saglik verileri hakkinda yonetmelik",
    category: "data_privacy",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["personal_health_data"],
    relatedTopicClusters: ["personal_health_data"],
    searchTerms: ["kişisel sağlık verisi", "sağlık verisi yönetmelik"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2019-06-21",
    expectedRgNumber: "30867",
    aliases: [
      "Kişisel Sağlık Verileri Yönetmeliği",
      "Sağlık Verileri Hakkında Yönetmelik",
      "Kişisel Sağlık Verileri Hakkında Yönetmelik"
    ],
    negativeMarkerTerms: [
      "kişisel verilerin korunması kanunu",  // KVKK kanunu, not yönetmelik
      "6698"
    ],
    markerTerms: [
      "kişisel sağlık verileri",
      "sağlık verisi",
      "mahremiyet",
      "veri sorumlusu",
      "açık rıza"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.6698"   // KVKK kanunu — not the yönetmelik
    ],
    notes: [
      "Health-specific data regulation under KVKK framework.",
      "Should accompany KVKK in health data privacy questions.",
      "Candidate for active coverage once sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan.",
      "v0.32.0: markerTerms, negativeMarkerTerms, RG metadata, knownWrongMatches added. KVKK kanunu (1.5.6698) is a known wrong match.",
      "v0.44.0 verification attempt (2026-05-30):",
      "  - No candidateLegacySourceId available.",
      "  - Search API best match: ELEKTRİK PİYASASI LİSANS YÖNETMELİĞİ (mevzuat:7.5.18985, score 0.300 — irrelevant).",
      "  - RG resolver returned mevzuat:7.5.18985 (negative marker '6698' hit — KVKK kanunu, not this yönetmelik).",
      "  - RG document verification (resmigazete.gov.tr): content mismatch, title score 0.000.",
      "  - BLOCKER: mevzuat.gov.tr search API does not return a close title match for this legislation.",
      "  - Status remains candidate — manual mevzuat.gov.tr search needed."
    ]
  },

  {
    key: "organ-doku-nakli-kanunu",
    title: "Organ ve Doku Alınması, Saklanması, Aşılanması ve Nakli Hakkında Kanun",
    titleNormalized: "organ ve doku alinmasi saklanmasi asilanmasi ve nakli hakkinda kanun",
    category: "organ_tissue",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "kanun",
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
    legislationType: "yonetmelik",
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
    legislationType: "yonetmelik",
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
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["professional_ethics"],
    searchTerms: ["disiplin soruşturması", "disiplin kurulu", "Sağlık Bakanlığı disiplin"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2004-04-26",
    expectedRgNumber: "25450",
    aliases: [
      "Sağlık Bakanlığı Disiplin Yönetmeliği",
      "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği",
      "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları Yönetmeliği"
    ],
    markerTerms: [
      "disiplin amiri",
      "sağlık bakanlığı",
      "disiplin",
      "memur",
      "soruşturma"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri",
      "asker",
      "tsk disiplin",
      "polis"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.6413",  // TSK Disiplin Kanunu
      "mevzuat:1.5.657",   // Devlet Memurları Kanunu (genel)
      "mevzuat:1.5.6001"   // Karayolları
    ],
    notes: [
      "Governs Ministry of Health disciplinary proceedings against health staff.",
      "Relevant for all administrative disciplinary questions.",
      "Candidate for active coverage once sourceId confirmed.",
      "v0.30.0: exact title and aliases added to query plan.",
      "v0.32.0: markerTerms, negativeMarkerTerms, RG metadata, knownWrongMatches added.",
      "Dikkat: isim/güncellik değişmiş olabilir; yanlış düzenlemeyi verified yapma.",
      "v0.44.0 verification attempt (2026-05-30):",
      "  - No candidateLegacySourceId available.",
      "  - Search API returned GENEL KOLLUK DİSİPLİN HÜKÜMLERİ... (mevzuat:1.5.7068, kanun, type mismatch).",
      "  - RG resolver returned mevzuat:1.5.6413 (known wrong match: TSK Disiplin Kanunu).",
      "  - RG document verification (resmigazete.gov.tr): content mismatch, title score 0.000.",
      "  - BLOCKER: mevzuat.gov.tr search API does not return a close title match for this legislation.",
      "  - Status remains candidate — manual mevzuat.gov.tr search needed."
    ]
  },

  // ── PUBLIC EMPLOYMENT / DISCIPLINE — added in T8.1 ────────────────────────

  {
    key: "saglik-bakanligi-atama-yer-degistirme-yonetmeligi",
    title: "Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği",
    titleNormalized: "saglik bakanligi ve bagli kuruluslari atama ve yer degistirme yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "verified",
    mevzuatSourceId: "mevzuat:7.5.17232",
    legislationNumber: "17232",
    officialUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=17232&MevzuatTur=7&MevzuatTertip=5",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["public_employment", "transfer_assignment"],
    searchTerms: ["tayin", "atama", "yer değiştirme", "nakil", "mazeret tayini", "eş durumu"],
    coverageStatus: "covered",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2013-03-26",
    expectedRgNumber: "28599",
    aliases: [
      "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği",
      "Bağlı Kuruluşlar Atama ve Yer Değiştirme Yönetmeliği",
      "Sağlık Bakanlığı Tayin Yönetmeliği"
    ],
    markerTerms: [
      "atama", "yer değiştirme", "tayin", "nakil",
      "sağlık bakanlığı", "bağlı kuruluş", "mazeret"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.657"   // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs appointment and transfer of Ministry of Health and affiliated institution personnel.",
      "sourceId mevzuat:7.5.17232 verified via live mevzuat.gov.tr PDF fetch (v0.45.0 / T9.1).",
      "Full text retrieved and articles 1, 2, 5 extracted — used in mock data."
    ]
  },

  {
    key: "saglik-bakanligi-gorevde-yukselme-unvan-degisikligi",
    title: "Sağlık Bakanlığı Personeli Görevde Yükselme ve Unvan Değişikliği Yönetmeliği",
    titleNormalized: "saglik bakanligi personeli gorevde yukselme ve unvan degisikligi yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["public_employment"],
    searchTerms: ["görevde yükselme", "unvan değişikliği", "terfi", "kadro"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Sağlık Bakanlığı Görevde Yükselme Yönetmeliği",
      "Görevde Yükselme ve Unvan Değişikliği Yönetmeliği",
      "Personel Görevde Yükselme Yönetmeliği"
    ],
    markerTerms: [
      "görevde yükselme", "unvan değişikliği", "terfi",
      "sağlık bakanlığı", "kademe", "derece"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker", "polis"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.657"   // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs career advancement and title changes for Ministry of Health personnel.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Görevde Yükselme ve Unvan Değişikliği Yönetmeliği'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  {
    key: "saglik-bakanligi-disiplin-amirleri-yonetmeligi",
    title: "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği",
    titleNormalized: "saglik bakanligi disiplin amirleri yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["disciplinary_administrative"],
    searchTerms: ["disiplin amiri", "disiplin soruşturması", "disiplin kurulu", "uyarma", "kınama", "geçici görevden uzaklaştırma"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Sağlık Bakanlığı Disiplin Yönetmeliği",
      "Disiplin Amirleri ve Disiplin Kurulları Yönetmeliği",
      "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik"
    ],
    markerTerms: [
      "disiplin amiri", "disiplin kurulu", "disiplin soruşturması",
      "uyarma", "kınama", "görevden uzaklaştırma",
      "sağlık bakanlığı"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker", "tsk disiplin", "polis"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.6413",  // TSK Disiplin Kanunu
      "mevzuat:1.5.657"    // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs Ministry of Health disciplinary proceedings — discipline officers and boards.",
      "Distinct from the existing 'saglik-bakanligi-disiplin-yonetmeligi' entry which covers a broader scope.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  {
    key: "sozlesmeli-saglik-personeli-disiplin",
    title: "Sözleşmeli Sağlık Personeli Disiplin ile Disiplin Kurulları Hakkında Yönetmelik",
    titleNormalized: "sozlesmeli saglik personeli disiplin ile disiplin kurullari hakkinda yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["disciplinary_administrative"],
    searchTerms: ["sözleşmeli personel disiplin", "sözleşmeli sağlık disiplin", "disiplin kurulu sözleşmeli"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Sözleşmeli Sağlık Personeli Disiplin Yönetmeliği",
      "Sözleşmeli Personel Disiplin Kurulları Yönetmeliği",
      "Sözleşmeli Sağlık Personeli Disiplin Kurulları Hakkında Yönetmelik"
    ],
    markerTerms: [
      "sözleşmeli", "disiplin", "disiplin kurulu",
      "sağlık personeli", "soruştırma"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.657"   // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs disciplinary proceedings specifically for contract-based health personnel.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Sözleşmeli Sağlık Personeli Disiplin'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  {
    key: "4924-sozlesmeli-saglik-atama-yer-degistirme",
    title: "4924 sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Atama ve Yer Değiştirme Yönetmeliği",
    titleNormalized: "4924 sayili kanuna tabi sozlesmeli saglik personeli atama ve yer degistirme yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["public_employment", "transfer_assignment"],
    searchTerms: ["4924", "sözleşmeli atama", "sözleşmeli yer değiştirme", "sözleşmeli tayin"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "4924 Sözleşmeli Sağlık Personeli Atama Yönetmeliği",
      "Sözleşmeli 4924 Atama ve Yer Değiştirme Yönetmeliği",
      "4924 Sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Yönetmeliği"
    ],
    markerTerms: [
      "4924", "sözleşmeli", "atama", "yer değiştirme",
      "sağlık personeli", "kanun"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.657"   // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs appointment and transfer for contract-based health personnel under Law 4924.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: '4924 sayılı Kanuna Tabi Sözleşmeli Sağlık'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  {
    key: "aciktan-kura-ile-atanacak-saglik-personeli",
    title: "Kamu Kurum ve Kuruluşlarına Açıktan Kura ile Atanacak Bazı Sağlık Personelinin Atama Esas ve Usulleri Yönetmeliği",
    titleNormalized: "kamu kurum ve kuruluslarina aciktan kura ile atanacak bazi saglik personelinin atama esas ve usulleri yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["disciplinary_administrative"],
    relatedTopicClusters: ["public_employment"],
    searchTerms: ["açıktan kura", "kura ile atama", "sağlık personeli atama", "kamu kurum atama"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Açıktan Kura ile Atanacak Sağlık Personeli Yönetmeliği",
      "Kura ile Atama Esas ve Usulleri Yönetmeliği",
      "Kamu Kurumları Açıktan Kura Atama Yönetmeliği"
    ],
    markerTerms: [
      "açıktan kura", "kura ile atama", "sağlık personeli",
      "kamu kurum", "atama esasları"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.657"   // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs the lottery-based appointment of certain health personnel to public institutions.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Açıktan Kura ile Atanacak Sağlık Personeli'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
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
    legislationType: "yonetmelik",
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
    category: "service_quality",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["private_health_facility"],
    relatedTopicClusters: ["hospital_management", "healthcare_quality"],
    searchTerms: ["yataklı tedavi kurumu", "hastane işletme", "yataklı tedavi işletmesi"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Yataklı Tedavi Kurumları İşletme Yönetmeliği",
      "Yataklı Tedavi İşletme Yönetmeliği",
      "Hastane İşletme Yönetmeliği"
    ],
    markerTerms: [
      "yataklı tedavi", "hastane işletme", "yatak kapasitesi",
      "hemşirelik hizmeti", "taburcu"
    ],
    negativeMarkerTerms: [
      "özel hastane",
      "özel sağlık kuruluşu"
    ],
    knownWrongMatches: [
      "mevzuat:7.5.29092"   // Özel Hastaneler Yönetmeliği — different regulation
    ],
    notes: [
      "Governs inpatient facility operations — may be partially superseded by newer regulations.",
      "v0.44.0: Activated from deferred to candidate. sourceId needs manual review.",
      "Search query for verification: 'Yataklı Tedavi Kurumları İşletme Yönetmeliği'",
      "needs live verification: sourceId unknown; blocked by Cloudflare anti-bot.",
      "Dikkat: Yeni hastane yönetmelikleriyle çakışabilir; kaynak doğrulaması gerekli."
    ]
  },

  {
    key: "hekim-mesleki-sorumluluk-sigortasi",
    title: "Tıbbi Kötü Uygulamaya İlişkin Zorunlu Mali Sorumluluk Sigortası Genel Şartları",
    titleNormalized: "tibbi kotu uygulamaya iliskin zorunlu mali sorumluluk sigortasi genel sartlari",
    category: "insurance",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["financial_liability", "malpractice_insurance"],
    relatedTopicClusters: ["financial_liability"],
    searchTerms: ["tıbbi kötü uygulama", "mali sorumluluk sigortası", "zorunlu sigorta", "malpractice insurance"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Tıbbi Kötü Uygulama Zorunlu Mali Sorumluluk Sigortası",
      "Zorunlu Mali Sorumluluk Sigortası Genel Şartları",
      "Tıbbi Kötü Uygulama Sigortası"
    ],
    markerTerms: [
      "tıbbi kötü uygulama", "mali sorumluluk", "sigorta",
      "zorunlu sigorta", "poliçe", "teminat"
    ],
    negativeMarkerTerms: [
      "aracılık", "acente", "trafik sigortası"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.5684"   // Karayolu Trafik Sigortası — different insurance type
    ],
    notes: [
      "Multiple scattered regulatory instruments; no single canonical mevzuat entry identified.",
      "v0.44.0: Activated from deferred to candidate. sourceId needs manual review.",
      "needs live verification: sourceId unknown; blocked by Cloudflare anti-bot.",
      "Search query for verification: 'Tıbbi Kötü Uygulama Zorunlu Mali Sorumluluk Sigortası'",
      "Requires dedicated sourceId research before activation."
    ]
  },

  {
    key: "radyoloji-hizmetleri-yonetmeligi",
    title: "Radyoloji Hizmetleri Yönetmeliği",
    titleNormalized: "radyoloji hizmetleri yonetmeligi",
    category: "diagnostics",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "deferred",
    relatedIssueIds: [],
    relatedTopicClusters: [],
    searchTerms: ["radyoloji", "röntgen", "görüntüleme"],
    coverageStatus: "deferred",
    notes: [
      "Governs radiology department standards.",
      "Deferred: specialty-specific, low frequency in benchmark questions."
    ]
  },

  // ── T8.3: Education / Service Quality / Financial / Clinical-Forensic ──────

  // ── B: Education ──────────────────────────────────────────────────────────

  {
    key: "tuey-uzmanlik-egitimi",
    title: "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği (TUEY)",
    titleNormalized: "tipta ve dis hekimliginde uzmanlik egitimi yonetmeligi",
    category: "medical_education",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    mevzuatSourceId: "mevzuat:7.5.39700",
    legislationNumber: "39700",
    relatedIssueIds: ["medical_education", "specialization"],
    relatedTopicClusters: ["medical_education"],
    searchTerms: ["TUEY", "uzmanlık eğitimi", "ihtisas", "asistan", "asistanlık", "tıpta uzmanlık"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Tıpta Uzmanlık Eğitimi Yönetmeliği",
      "Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği",
      "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği"
    ],
    markerTerms: [
      "uzmanlık eğitimi", "asistan", "ihtisas", "TUEY",
      "uzmanlık dalı", "eğitim programı", "yeterlik"
    ],
    negativeMarkerTerms: [
      "hemşire", "ebelik", "laborant"
    ],
    notes: [
      "Governs medical and dental specialization training programs in Turkey.",
      "sourceId mevzuat:7.5.39700 provided from ROADMAP; needs live verification.",
      "v0.44.0: Added as candidate. sourceId from ROADMAP but live search blocked by Cloudflare.",
      "needs_manual_review: sourceId mevzuat:7.5.39700 should be verified via mevzuat.gov.tr."
    ]
  },

  {
    key: "saglik-uzmanligi-yonetmeligi",
    title: "Sağlık Uzmanlığı Yönetmeliği",
    titleNormalized: "saglik uzmanligi yonetmeligi",
    category: "medical_education",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["medical_education", "specialization"],
    relatedTopicClusters: ["medical_education"],
    searchTerms: ["sağlık uzmanlığı", "uzmanlık yönetmeliği", "sağlık uzmanı"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Sağlık Uzmanlığı Yönetmeliği",
      "Sağlık Uzmanı Yönetmeliği"
    ],
    markerTerms: [
      "sağlık uzmanlığı", "uzman", "uzmanlık eğitimi",
      "yeterlik", "sağlık bakanlığı"
    ],
    negativeMarkerTerms: [
      "tıpta uzmanlık", "diş hekimliği uzmanlık"
    ],
    notes: [
      "Governs health specialization training for non-physician health professionals.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Sağlık Uzmanlığı Yönetmeliği'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  // ── C: Service Quality & Safety ───────────────────────────────────────────

  {
    key: "hasta-calisan-guvenligi-yonetmeligi",
    title: "Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik",
    titleNormalized: "hasta ve calisan guvenliginin saglanmasina dair yonetmelik",
    category: "service_quality",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["patient_safety", "employee_safety"],
    relatedTopicClusters: ["patient_safety"],
    searchTerms: ["hasta güvenliği", "çalışan güvenliği", "hasta ve çalışan güvenliği"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2011-04-06",
    expectedRgNumber: "27897",
    aliases: [
      "Hasta ve Çalışan Güvenliği Yönetmeliği",
      "Hasta Güvenliği Yönetmeliği",
      "Çalışan Güvenliği Yönetmeliği"
    ],
    markerTerms: [
      "hasta güvenliği", "çalışan güvenliği", "kazanın önlenmesi",
      "olay bildirimi", "güvenlik culture", "hasta güvensizliği"
    ],
    notes: [
      "Governs patient and employee safety measures in healthcare facilities.",
      "RG: 06.04.2011 / 27897 — needs mevzuat.gov.tr sourceId resolution.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  {
    key: "saglik-hizmeti-kalitesi-yonetmeligi",
    title: "Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik",
    titleNormalized: "saglik hizmeti kalitesinin gelistirilmesi ve degerlendirilmesine dair yonetmelik",
    category: "service_quality",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["healthcare_quality", "quality_assurance"],
    relatedTopicClusters: ["healthcare_quality"],
    searchTerms: ["sağlık hizmeti kalitesi", "kalite geliştirme", "kalite değerlendirme"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Sağlık Hizmeti Kalitesi Yönetmeliği",
      "Kalite Geliştirilmesi ve Değerlendirilmesi Yönetmeliği",
      "Sağlık Hizmeti Kalite Yönetmeliği"
    ],
    markerTerms: [
      "kalite geliştirme", "kalite değerlendirme", "sağlık hizmeti kalitesi",
      "kalite standartları", "hasta memnuniyeti", "kalite göstergeleri"
    ],
    notes: [
      "Governs healthcare service quality improvement and evaluation standards.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  // ── D: Financial / Administrative ─────────────────────────────────────────

  {
    key: "saglik-tesisleri-ek-odeme-yonetmeligi",
    title: "Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği",
    titleNormalized: "saglik bakanligina bagli saglik tesislerinde gorevli personele ek odeme yonetmeligi",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["public_employment", "financial"],
    relatedTopicClusters: ["public_employment", "financial_liability"],
    searchTerms: ["ek ödeme", "döner sermaye", "performans", "sağlık tesisleri ek ödeme"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Ek Ödeme Yönetmeliği",
      "Sağlık Tesisleri Ek Ödeme Yönetmeliği",
      "Personele Ek Ödeme Yönetmeliği"
    ],
    markerTerms: [
      "ek ödeme", "döner sermaye", "performans",
      "sağlık tesisi", "personele ödeme", "taban aylık"
    ],
    negativeMarkerTerms: [
      "memur maaş", "emekli aylık"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.657"   // Devlet Memurları Kanunu (genel)
    ],
    notes: [
      "Governs additional payment (ek ödeme) and performance-based pay for MoH staff.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  // ── E: Clinical-Forensic ──────────────────────────────────────────────────

  {
    key: "aile-hekimligi-uygulama-yonetmeligi",
    title: "Aile Hekimliği Uygulama Yönetmeliği",
    titleNormalized: "aile hekimligi uygulama yonetmeligi",
    category: "physician_practice",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["primary_care", "family_medicine", "forensic_duties"],
    relatedTopicClusters: ["primary_care"],
    searchTerms: ["aile hekimliği uygulama", "aile hekimi yönetmeliği", "birinci basamak uygulama"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Aile Hekimliği Uygulama Yönetmeliği",
      "Aile Hekimliği Yönetmeliği",
      "Aile Hekimliği Uygulama Esasları"
    ],
    markerTerms: [
      "aile hekimliği", "birinci basamak", "koruyucu sağlık",
      "aile sağlığı merkezi", "nüfus", "kayıtlı hasta"
    ],
    negativeMarkerTerms: [
      "aile hekimliği kanunu",
      "5258"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.5258"   // Aile Hekimliği Kanunu — kanun, not yönetmelik
    ],
    notes: [
      "Governs family medicine practice procedures, patient registration, and primary care scope.",
      "Distinct from Aile Hekimliği Kanunu (5258) which is the enabling statute.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Aile Hekimliği Uygulama Yönetmeliği'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  {
    key: "cenaze-nakil-defin-yonetmeligi",
    title: "Mezarlık Yerlerinin İnşaası ile Cenaze Nakil ve Defin İşlemleri Hakkında Yönetmelik",
    titleNormalized: "mezarak yerlerinin insaasi ile cenaze nakil ve defin islemleri hakkinda yonetmelik",
    category: "forensic_administrative",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["forensic_duties", "death_procedures"],
    relatedTopicClusters: ["death_procedures"],
    searchTerms: ["cenaze nakil", "defin işlemleri", "ölüm belgesi", "mezarlık"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Cenaze Nakil ve Defin İşlemleri Yönetmeliği",
      "Mezarlık Yerlerinin İnşaası Yönetmeliği",
      "Cenaze Defin Yönetmeliği"
    ],
    markerTerms: [
      "cenaze nakil", "defin", "ölüm belgesi", "mezarlık",
      "cenaze", "defin ruhsatı", "ölüm raporu"
    ],
    notes: [
      "Governs cemetery construction and body transport/burial procedures.",
      "Relevant for physicians issuing death certificates and forensic procedures.",
      "sourceId: needs_manual_review — live search blocked by Cloudflare.",
      "Search query for verification: 'Mezarlık Yerlerinin İnşaası ile Cenaze Nakil ve Defin İşlemleri Hakkında Yönetmelik'",
      "v0.44.0: Added as candidate. sourceId unknown; needs manual mevzuat.gov.tr lookup."
    ]
  },

  // ── Kanun Katmanı (yönetmelik değil — ayrı not) ───────────────────────────

  {
    key: "umumi-hifzissihha-kanunu",
    title: "Umumi Hıfzıssıhha Kanunu",
    titleNormalized: "umumi hifzissihha kanunu",
    category: "physician_practice",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "kanun",
    officialSourceStatus: "candidate",
    mevzuatSourceId: "mevzuat:1.3.1593",
    legislationNumber: "1593",
    relatedIssueIds: ["public_health", "sanitation", "epidemic"],
    relatedTopicClusters: ["public_health"],
    searchTerms: ["hıfzıssıhha", "umumi hıfzıssıhha", "1593", "salgın", "bulaşıcı hastalık"],
    coverageStatus: "candidate",
    expectedLegislationType: "kanun",
    aliases: [
      "Umumi Hıfzıssıhha Kanunu (1593)",
      "Hıfzıssıhha Kanunu",
      "Umumi Hıfzıssıhha"
    ],
    markerTerms: [
      "hıfzıssıhha", "salgın", "bulaşıcı hastalık", "karantina",
      "umumi sağlık", "izolasyon", "aşı zorunluluğu"
    ],
    notes: [
      "Kanun düzeyinde — yönetmelik envanterine değil kanun katmanına ait.",
      "Governs public health, sanitation, epidemic control, and quarantine measures.",
      "sourceId mevzuat:1.3.1593 provided from ROADMAP; needs live verification.",
      "v0.44.0: Added as candidate. sourceId from ROADMAP but live search blocked by Cloudflare.",
      "needs_manual_review: sourceId mevzuat:1.3.1593 should be verified via mevzuat.gov.tr."
    ]
  },

  {
    key: "devlet-hizmeti-yukumlulugu-dhy",
    title: "Devlet Hizmeti Yükümlülüğü (DHY) — 3359 sayılı Kanun Ek 7-8",
    titleNormalized: "devlet hizmeti yukumlulugu dhy 3359 sayili kanun ek 7 8",
    category: "physician_practice",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    legislationNumber: "3359",
    relatedIssueIds: ["public_employment", "compulsory_service"],
    relatedTopicClusters: ["public_employment"],
    searchTerms: ["DHY", "devlet hizmeti yükümlülüğü", "mecburi hizmet", "3359 ek madde", "zorunlu hizmet"],
    coverageStatus: "candidate",
    expectedLegislationType: "kanun",
    aliases: [
      "Devlet Hizmeti Yükümlülüğü",
      "DHY",
      "Mecburi Hizmet",
      "3359 Ek Madde 7-8"
    ],
    markerTerms: [
      "devlet hizmeti yükümlülüğü", "DHY", "mecburi hizmet",
      "zorunlu hizmet", "ek madde 7", "ek madde 8", "3359"
    ],
    negativeMarkerTerms: [
      "sağlık hizmetleri temel kanunu genel",
      "özel hastane"
    ],
    knownWrongMatches: [],
    notes: [
      "Kanun düzeyinde — yönetmelik envanterine değil kanun katmanına ait.",
      "Governs compulsory public health service obligations (DHY) under Ek Madde 7-8 of Law 3359.",
      "Shares sourceId with saglik-hizmetleri-temel-kanunu (mevzuat:1.5.3359) — this entry focuses specifically on DHY provisions.",
      "sourceId mevzuat:1.5.3359 confirmed via ROADMAP; DHY provisions are within the same law.",
      "v0.44.0: Added as candidate. sourceId confirmed; DHY-specific provisions documented.",
      "needs_manual_review: verify that Ek Madde 7-8 provisions are current and not superseded."
    ]
  },

  // ── Core statutes — 657 DMK and TCK 5237 ──────────────────────────────────

  {
    key: "657-dmk",
    title: "657 Sayılı Devlet Memurları Kanunu",
    titleNormalized: "657 sayili devlet memurlari kanunu",
    category: "discipline",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "kanun",
    officialSourceStatus: "candidate",
    mevzuatSourceId: "mevzuat:1.5.657",
    legislationNumber: "657",
    relatedIssueIds: ["disciplinary_administrative", "public_employment"],
    relatedTopicClusters: ["public_employment", "disciplinary_administrative"],
    searchTerms: ["657", "devlet memurları kanunu", "memur disiplin", "özlük hakları"],
    coverageStatus: "candidate",
    expectedLegislationType: "kanun",
    aliases: [
      "Devlet Memurları Kanunu",
      "Kanun 657",
      "657 sayılı kanun"
    ],
    markerTerms: [
      "devlet memuru", "disiplin cezası", "uyarma", "kınama",
      "aşağı dereceye", "bir derece", "kadro", "derece",
      "görevden uzaklaştırma"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker", "tsk"
    ],
    knownWrongMatches: [],
    notes: [
      "Kamu hekimlerinin disiplin ve özlük hakları 657 sayılı kanuna tabidir.",
      "Governs civil servant discipline, appointment, and employment rights for public physicians.",
      "v0.44.0: Added as candidate. sourceId mevzuat:1.5.657 from ROADMAP; needs live verification."
    ]
  },

  {
    key: "tck-5237",
    title: "5237 Sayılı Türk Ceza Kanunu (Hekimi İlgilendiren Maddeler)",
    titleNormalized: "5237 sayili turk ceza kanunu hekimi ilgilendiren maddeler",
    category: "physician_practice",
    relevanceLevel: "supporting",
    officialSourceRequired: true,
    legislationType: "kanun",
    officialSourceStatus: "candidate",
    mevzuatSourceId: "mevzuat:1.5.5237",
    legislationNumber: "5237",
    relatedIssueIds: ["physician_liability", "criminal_liability", "medical_intervention"],
    relatedTopicClusters: ["medical_intervention"],
    searchTerms: ["5237", "türk ceza kanunu", "tck", "görevi ihmal", "görevi kötüye kullanma"],
    coverageStatus: "candidate",
    expectedLegislationType: "kanun",
    aliases: [
      "Türk Ceza Kanunu",
      "TCK 5237",
      "Kanun 5237"
    ],
    markerTerms: [
      "görevi ihmal", "görevi kötüye kullanma", "taksir",
      "bilinçli taksir", "mevzuatı bilmemezlik",
      "sağlık hakkı", "insan vücut dokunulmazlığı"
    ],
    negativeMarkerTerms: [
      "türk silahlı kuvvetleri", "asker"
    ],
    knownWrongMatches: [],
    notes: [
      "Hekimi ilgilendiren ceza maddeleri: md.94-97 (taksirle yaralama/ölüm), md.229 (görevi kötüye kullanma).",
      "Relevant for physician criminal liability questions.",
      "v0.44.0: Added as candidate. sourceId mevzuat:1.5.5237 from ROADMAP; needs live verification."
    ]
  },

  // ── T17.1: Clinical regulations — blood products, dialysis, radiation safety ──

  {
    key: "kan-ve-kan-urunleri",
    title: "Kan ve Kan Ürünleri Yönetmeliği",
    titleNormalized: "kan ve kan urunleri yonetmeligi",
    category: "blood_products",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["blood_transfusion", "patient_safety", "informed_consent"],
    relatedTopicClusters: ["medical_intervention", "patient_safety"],
    searchTerms: ["kan transfüzyonu", "kan ürünleri", "kan bankası", "kan verme", "transfüzyon"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Kan ve Kan Ürünleri Hakkında Yönetmelik",
      "Kan Ürünleri Yönetmeliği",
      "Kan Transfüzyonu Yönetmeliği"
    ],
    markerTerms: [
      "kan ürünleri", "kan transfüzyonu", "kan bankası",
      "kan uygunluğu", "kanama", "transfüzyon reaksiyonu"
    ],
    negativeMarkerTerms: [
      "organ nakli", "doku nakli"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.2238"  // Organ ve Doku Nakli Kanunu — different scope
    ],
    notes: [
      "Governs blood collection, processing, storage, and transfusion standards.",
      "Relevant for transfusion medicine, surgical, and emergency physician questions.",
      "v0.45.0: Added as candidate (T17.1). sourceId unknown; needs manual mevzuat.gov.tr lookup.",
      "healthMappings hint: blood_transfusion cluster."
    ]
  },

  {
    key: "diyaliz-merkezleri",
    title: "Diyaliz Merkezleri Yönetmeliği",
    titleNormalized: "diyaliz merkezleri yonetmeligi",
    category: "service_quality",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["dialysis", "patient_safety", "private_health_facility"],
    relatedTopicClusters: ["medical_intervention", "patient_safety"],
    searchTerms: ["diyaliz", "diyaliz merkezi", "hemodiyaliz", "böbrek yetmezliği", "dializ"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Diyaliz Merkezleri Hakkında Yönetmelik",
      "Hemodiyaliz Merkezleri Yönetmeliği",
      "Diyaliz Merkezi Yönetmeliği"
    ],
    markerTerms: [
      "diyaliz", "hemodiyaliz", "diyaliz merkezi",
      "böbrek yetmezliği", "diyaliz hastası", "dijital filtre"
    ],
    negativeMarkerTerms: [
      "organ nakli", "transplantasyon"
    ],
    knownWrongMatches: [],
    notes: [
      "Governs dialysis center licensing, staffing, and treatment standards.",
      "Relevant for nephrology and internal medicine physician questions.",
      "v0.45.0: Added as candidate (T17.1). sourceId unknown; needs manual mevzuat.gov.tr lookup.",
      "healthMappings hint: dialysis/chronic renal failure cluster."
    ]
  },

  {
    key: "radyasyon-guvenligi",
    title: "Radyasyon Güvenliği Yönetmeliği",
    titleNormalized: "radyasyon guvenligi yonetmeligi",
    category: "diagnostics",
    relevanceLevel: "specialized",
    officialSourceRequired: true,
    legislationType: "yonetmelik",
    officialSourceStatus: "candidate",
    relatedIssueIds: ["radiation_safety", "occupational_health", "patient_safety"],
    relatedTopicClusters: ["professional_scope_of_practice", "patient_safety"],
    searchTerms: ["radyasyon", "radyoloji", "röntgen", "nükleer", "iyonize ışınım", "dozimetri"],
    coverageStatus: "candidate",
    expectedLegislationType: "yonetmelik",
    aliases: [
      "Radyasyon Güvenliği Hakkında Yönetmelik",
      "Işınım Güvenliği Yönetmeliği",
      "Radyasyon Güvenliği Yönetmeliği Hakkında"
    ],
    markerTerms: [
      "radyasyon", "radyoloji", "nükleer tıp",
      "iyonize ışınım", "dozimetri", "radyasyon güvenliği"
    ],
    negativeMarkerTerms: [
      "nükleer silah", "nükleer enerji"
    ],
    knownWrongMatches: [
      "mevzuat:7.5.29134"  // Different regulation, sometimes confused in search
    ],
    notes: [
      "Governs radiation safety standards for medical imaging and nuclear medicine.",
      "Relevant for radiology, nuclear medicine, and radiation oncology physician questions.",
      "v0.45.0: Added as candidate (T17.1). sourceId unknown; needs manual mevzuat.gov.tr lookup.",
      "healthMappings hint: radiation_safety/radiology cluster."
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
  const byLegislationType: Record<LegislationClassification, number> = {
    kanun: 0, yonetmelik: 0, nizamname: 0, teblig: 0
  };

  for (const entry of HEALTH_LEGISLATION_INVENTORY) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    byAccessStatus[entry.officialSourceStatus]++;
    byLegislationType[entry.legislationType]++;
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
    inventoryByLegislationType: byLegislationType,
    verifiedEntries: verified,
    candidateEntries: candidate,
    gapEntries: gap,
    deferredEntries: deferred,
    coverageWarnings
  };
}
