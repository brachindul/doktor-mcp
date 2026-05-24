/**
 * Official Health Legislation Access Verifier (v0.32.0)
 *
 * Searches mevzuat.gov.tr for each candidate/gap inventory entry using a
 * multi-variant query plan (exact title, aliases, RG number, legacy sourceId
 * probe, keyword terms) and scores results via F1 word-overlap + metadata
 * signals to determine if an official sourceId can be confirmed.
 *
 * Design rules (v0.32.0):
 * - Path C (direct sourceId/PDF fetch) tried FIRST if candidateLegacySourceId set.
 * - Path A (title/alias score ≥ 0.75) and Path B (sourceId probe + ≥ 0.50) retained.
 * - Marker terms from entry-level markerTerms used for content verification.
 * - negativeMarkerTerms: if ANY term appears in document text, reject as wrong document.
 * - knownWrongMatches: explicit list of (sourceId, titlePattern) pairs to reject immediately.
 * - Ambiguity guard: reject if second-best is within AMBIGUITY_MARGIN of best.
 * - gov.tr guard: reject any result whose URL is not on mevzuat.gov.tr.
 * - No risk levels, urgent actions, or definitive legal opinions produced here.
 * - local-yargi is NOT imported; all HTTP is delegated to the existing live adapter.
 */

import type { HealthLegislationInventoryEntry } from "./healthLegislationInventory.js";
import type { OfficialLegislationSearchResult } from "./sources/legislation/liveTypes.js";

// ──────────────────────────────────────────────────────────────
// Scoring constants
// ──────────────────────────────────────────────────────────────

/** Minimum F1 score (title or alias) to accept via Path A. */
const ACCEPT_THRESHOLD = 0.75;

/**
 * Minimum F1 score (title or alias) to accept via Path B (sourceId probe).
 * Lower than Path A because we have the additional sourceId confirmation signal.
 */
const SOURCE_ID_PROBE_TITLE_THRESHOLD = 0.50;

/**
 * If the best and second-best final scores differ by less than this margin,
 * the result is ambiguous and we conservatively reject.
 */
const AMBIGUITY_MARGIN = 0.10;

/** Minimum marker score to accept a direct-fetched document. */
const MIN_MARKER_SCORE = 0.30;

/** Known wrong legislation patterns to reject immediately (v0.32.0). */
const KNOWN_WRONG_MATCHES: Array<{ sourceIdPattern: string; titlePattern: string; reason: string }> = [
  { sourceIdPattern: "mevzuat:1.5.7191", titlePattern: "Makine", reason: "Makine ve Kimya Endüstrisi Kanunu — not health regulation" },
  { sourceIdPattern: "mevzuat:1.5.6001", titlePattern: "Karayolları", reason: "Karayolları Hizmetleri Kanunu — not health regulation" },
  { sourceIdPattern: "mevzuat:1.5.6475", titlePattern: "Posta", reason: "Posta Hizmetleri Kanunu — not health regulation" },
  { sourceIdPattern: "mevzuat:1.5.6698", titlePattern: "Kişisel Verilerin", reason: "KVKK kanunu — only supporting context, not target yönetmelik" },
  { sourceIdPattern: "mevzuat:1.5.6413", titlePattern: "Türk Silahlı", reason: "TSK Disiplin Kanunu — not health discipline regulation" },
  { sourceIdPattern: "mevzuat:1.5.5510", titlePattern: "Sosyal Sigortalar", reason: "SGK yapılandırma kanunu — not health regulation" },
  { sourceIdPattern: "mevzuat:7.5.29134", titlePattern: "Radyasyon", reason: "Radyasyon Güvenliği Yönetmeliği — not health facility regulation" },
  { sourceIdPattern: "mevzuat:1.5.657", titlePattern: "Devlet Memurları", reason: "Devlet Memurları Kanunu — general civil service, not health-specific discipline" },
];

/** Short Turkish function words excluded from overlap scoring. */
const STOP_WORDS = new Set([
  "ve", "ile", "bir", "bu", "de", "da", "ki", "ne", "ya", "en",
  "den", "dan", "nin", "nun", "nın", "ten", "tan",
  "in", "an", "un", "on"
]);

// ──────────────────────────────────────────────────────────────
// Adapter interface (allows mocking in tests)
// ──────────────────────────────────────────────────────────────

export interface LegislationSearchAdapter {
  searchOfficialLegislation(
    query: string
  ): Promise<OfficialLegislationSearchResult[] | { status: "unavailable"; message: string }>;
  fetchOfficialDocument?(
    sourceId: string
  ): Promise<{ title: string; text: string; retrievedAt: string } | { status: "unavailable"; message: string }>;
}

// ──────────────────────────────────────────────────────────────
// Query plan types
// ──────────────────────────────────────────────────────────────

export type QueryVariantKind =
  | "exact_title"             // Full official Turkish title
  | "alias"                   // Alternative title form
  | "legacy_source_id_probe"  // Search by candidateLegacySourceId number
  | "rg_number"               // Search by Official Gazette number
  | "keyword_combo";          // Keyword combination (original searchTerms)

/** A single search query variant in the recall plan. */
export interface HealthLegislationQueryVariant {
  query: string;
  kind: QueryVariantKind;
  /** Expected legislation type — used for type-mismatch scoring */
  expectedLegislationType?: "kanun" | "yonetmelik" | "nizamname";
  /** Expected RG date (YYYY-MM-DD) */
  expectedRgDate?: string;
  /** Expected RG number */
  expectedRgNumber?: string;
  /** The candidate sourceId this probe is trying to confirm */
  candidateLegacySourceId?: string;
  /** Relative weight of this variant (0–1) */
  weight: number;
}

export type QueryRecallStrategy =
  | "exact_title_only"   // Single exact title query
  | "alias_boosted"      // Aliases supplementing the exact title
  | "source_id_probe"    // candidateLegacySourceId probe included
  | "multi_variant";     // Full recall — title + aliases + probe + rg + keywords

/** Full query plan for a single inventory entry. */
export interface HealthLegislationQueryPlan {
  entryKey: string;
  strategy: QueryRecallStrategy;
  variants: HealthLegislationQueryVariant[];
}

// ──────────────────────────────────────────────────────────────
// Result types
// ──────────────────────────────────────────────────────────────

export interface HealthLegislationVerificationMatch {
  sourceId: string;
  title: string;
  sourceUrl: string;
  documentUrl: string;
  legislationNumber: string;
  legislationType: string;
  legislationArrangement: string;
  /** Final composite score (0–1) */
  titleMatchScore: number;
  searchTerm: string;
}

export type HealthLegislationVerificationStatus =
  | "verified"                    // Path A: title/alias ≥ 0.75
  | "verified_via_source_id_probe"  // Path B: sourceId match + title/alias ≥ 0.50
  | "verified_via_source_id_direct" // Path C: direct document fetch from sourceId
  | "rejected_no_match"            // No search results at all
  | "rejected_ambiguous"           // Top two results too close in score
  | "rejected_non_gov_tr"          // Best result is on a non-gov.tr domain
  | "rejected_low_score"           // Score below threshold
  | "rejected_wrong_document"      // Wrong legislation type (type mismatch)
  | "rejected_source_id_timeout"   // Direct document fetch timed out
  | "rejected_source_id_title_mismatch" // Direct fetch title does not match expected
  | "rejected_source_id_empty_document" // Direct fetch returned empty/unparseable document
  | "rejected_source_id_fetch_failed"   // Direct fetch failed (non-timeout error)
  | "search_error";                // Adapter returned an error

export interface CompositeMatchScore {
  titleScore: number;
  aliasScore: number;
  metadataScore: number;
  markerScore: number;
  rgScore: number;
  typeScore: number;
  sourceIdProbeBonus: number;
  /** max(titleScore, aliasScore) + metadataScore */
  finalScore: number;
  /** True if result.sourceId === candidateLegacySourceId AND title/alias ≥ probe threshold */
  probePathEligible: boolean;
}

export interface HealthLegislationVerificationAttempt {
  entryKey: string;
  entryTitle: string;
  entryStatus: "candidate" | "gap";
  status: HealthLegislationVerificationStatus;
  bestMatch?: HealthLegislationVerificationMatch;
  allCandidates: HealthLegislationVerificationMatch[];
  rejectReason?: string;
  /** Queries issued (one per variant executed) */
  searchTermsAttempted: string[];
  /** Full query plan including kinds and weights */
  attemptedQueries: HealthLegislationQueryVariant[];
  /** Kind of the query variant that produced the best match */
  bestQueryKind?: QueryVariantKind;
  titleScore?: number;
  aliasScore?: number;
  metadataScore?: number;
  sourceIdProbeUsed: boolean;
  /** Top 3 candidates by score for diagnostic logging */
  topCandidates: Array<{ title: string; sourceId: string; score: number }>;
  /** Set only when status is verified or verified_via_source_id_probe */
  mevzuatSourceId?: string;
  /** Set only when status is verified or verified_via_source_id_probe */
  officialUrl?: string;

  // ── v0.31.0 direct sourceId fetch fields ─────────────────────────────────
  /** Whether direct sourceId document fetch was attempted */
  directFetchAttempted?: boolean;
  /** Whether the direct fetch timed out */
  directFetchTimedOut?: boolean;
  /** Status of the direct fetch attempt (success, timeout, title_mismatch, etc.) */
  directFetchStatus?: string;
  /** Title extracted from the fetched document */
  directFetchTitle?: string;
  /** RG date from document text (first ~500 chars scan) */
  directFetchRgDate?: string;
  /** RG number from document text (first ~500 chars scan) */
  directFetchRgNumber?: string;
  /** Content marker score (0-1): proportion of expected marker terms found in text */
  directFetchMarkerScore?: number;
  /** Length of the fetched document text in chars */
  directFetchTextLength?: number;

  // ── v0.32.0 expanded diagnostics fields ───────────────────────────────────
  /** Whether direct sourceId was attempted as first strategy */
  directSourceIdAttempted?: boolean;
  /** The official URL used for direct fetch */
  directFetchOfficialUrl?: string;
  /** Marker score computed from entry-level markerTerms (0-1) */
  markerScore?: number;
  /** RG date match score (1 if matches expectedRgDate, 0 otherwise) */
  rgScore?: number;
  /** Legislation type match score (1 if matches expectedLegislationType, 0 otherwise) */
  typeScore?: number;
  /** Whether a known wrong match pattern was hit */
  knownWrongMatchHit?: boolean;
  /** Description of why a known wrong match was rejected */
  knownWrongMatchReason?: string;
  /** Free-text reason for wrong match rejection */
  wrongMatchReason?: string;
  /** Final human-readable decision explanation */
  finalDecision?: string;
  /** Whether a negative marker term was found in the document */
  negativeMarkerHit?: boolean;
  /** Which negative marker term was found */
  negativeMarkerTerm?: string;
}

export interface HealthLegislationVerificationReport {
  attemptedCount: number;
  verifiedCount: number;
  rejectedCount: number;
  searchErrorCount: number;
  attempts: HealthLegislationVerificationAttempt[];
  verifiedEntries: HealthLegislationVerificationAttempt[];
  rejectedEntries: HealthLegislationVerificationAttempt[];
  searchErrorEntries: HealthLegislationVerificationAttempt[];
  generatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Title normalization
// ──────────────────────────────────────────────────────────────

/** Normalize a Turkish title to ASCII lowercase for word-overlap comparison. */
export function normalizeTitleForMatch(title: string): string {
  return title
    .replace(/İ/g, "i").replace(/I/g, "i")
    .replace(/Ş/g, "s").replace(/Ğ/g, "g")
    .replace(/Ü/g, "u").replace(/Ö/g, "o")
    .replace(/Ç/g, "c").replace(/Â/g, "a")
    .replace(/Î/g, "i").replace(/Û/g, "u")
    .replace(/ı/g, "i").replace(/ş/g, "s")
    .replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/â/g, "a").replace(/î/g, "i")
    .replace(/û/g, "u")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract meaningful words, filtering stop words and short tokens. */
export function titleWords(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/** F1-based word-overlap score between two legislation titles. */
export function scoreTitleMatch(inventoryTitle: string, searchResultTitle: string): number {
  const invWords = new Set(titleWords(normalizeTitleForMatch(inventoryTitle)));
  const srWords = new Set(titleWords(normalizeTitleForMatch(searchResultTitle)));

  if (invWords.size === 0 || srWords.size === 0) return 0;

  let overlap = 0;
  for (const w of invWords) {
    if (srWords.has(w)) overlap++;
  }

  if (overlap === 0) return 0;

  const precision = overlap / srWords.size;
  const recall = overlap / invWords.size;
  return (2 * precision * recall) / (precision + recall);
}

// ──────────────────────────────────────────────────────────────
// gov.tr guard
// ──────────────────────────────────────────────────────────────

export function isGovTrUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".gov.tr") || hostname === "gov.tr";
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// Known wrong match guard (v0.32.0)
// ──────────────────────────────────────────────────────────────

export interface WrongMatchCheckResult {
  isWrongMatch: boolean;
  matchedSourceIdPattern?: string;
  matchedTitlePattern?: string;
  reason?: string;
}

/**
 * Check if a search result matches a known wrong legislation pattern.
 * Returns { isWrongMatch: true } with details if it does.
 */
export function checkKnownWrongMatch(
  result: { sourceId: string; title: string }
): WrongMatchCheckResult {
  const normTitle = normalizeTitleForMatch(result.title);
  for (const wm of KNOWN_WRONG_MATCHES) {
    if (result.sourceId.startsWith(wm.sourceIdPattern)) {
      return {
        isWrongMatch: true,
        matchedSourceIdPattern: wm.sourceIdPattern,
        matchedTitlePattern: wm.titlePattern,
        reason: wm.reason
      };
    }
    if (normTitle.includes(normalizeTitleForMatch(wm.titlePattern))) {
      return {
        isWrongMatch: true,
        matchedSourceIdPattern: wm.sourceIdPattern,
        matchedTitlePattern: wm.titlePattern,
        reason: wm.reason
      };
    }
  }
  return { isWrongMatch: false };
}

/**
 * Check if any negative marker term appears in document text.
 */
export function checkNegativeMarkers(
  text: string,
  negativeTerms: string[]
): { hit: boolean; term?: string } {
  const textLower = text.toLocaleLowerCase("tr-TR");
  for (const term of negativeTerms) {
    const termLower = term.toLocaleLowerCase("tr-TR");
    if (textLower.includes(termLower)) {
      return { hit: true, term };
    }
  }
  return { hit: false };
}

// ──────────────────────────────────────────────────────────────
// Query plan builder
// ──────────────────────────────────────────────────────────────

/**
 * Build a prioritized multi-variant query plan for an inventory entry.
 *
 * Query order: exact_title → aliases → legacy_source_id_probe →
 *              rg_number → keyword_combo
 *
 * Duplicate queries are deduplicated — each unique query string is issued once.
 */
export function buildQueryPlan(entry: HealthLegislationInventoryEntry): HealthLegislationQueryPlan {
  const variants: HealthLegislationQueryVariant[] = [];
  const seen = new Set<string>();

  const add = (v: HealthLegislationQueryVariant) => {
    if (!seen.has(v.query)) {
      seen.add(v.query);
      variants.push(v);
    }
  };

  // 1. Exact full title (highest weight)
  add({
    query: entry.title,
    kind: "exact_title",
    expectedLegislationType: entry.expectedLegislationType,
    weight: 1.0
  });

  // 2. Aliases
  for (const alias of entry.aliases ?? []) {
    add({
      query: alias,
      kind: "alias",
      expectedLegislationType: entry.expectedLegislationType,
      weight: 0.9
    });
  }

  // 3. Legacy sourceId probe (search by the mevzuat internal number)
  if (entry.candidateLegacySourceId) {
    const idPart = entry.candidateLegacySourceId.replace("mevzuat:", "");
    const number = idPart.split(".")[2];
    if (number) {
      add({
        query: number,
        kind: "legacy_source_id_probe",
        candidateLegacySourceId: entry.candidateLegacySourceId,
        expectedLegislationType: entry.expectedLegislationType,
        weight: 0.8
      });
    }
  }

  // 4. RG number
  if (entry.expectedRgNumber) {
    add({
      query: entry.expectedRgNumber,
      kind: "rg_number",
      expectedRgDate: entry.expectedRgDate,
      expectedRgNumber: entry.expectedRgNumber,
      expectedLegislationType: entry.expectedLegislationType,
      weight: 0.7
    });
  }

  // 5. Original searchTerms (keyword_combo, lowest weight)
  for (const term of entry.searchTerms) {
    add({ query: term, kind: "keyword_combo", weight: 0.5 });
  }

  // Determine strategy label
  let strategy: QueryRecallStrategy = "exact_title_only";
  if (entry.candidateLegacySourceId) {
    strategy = "source_id_probe";
  } else if ((entry.aliases?.length ?? 0) > 0 && entry.expectedRgNumber) {
    strategy = "multi_variant";
  } else if ((entry.aliases?.length ?? 0) > 0) {
    strategy = "alias_boosted";
  } else if (variants.length > 1) {
    strategy = "multi_variant";
  }

  return { entryKey: entry.key, strategy, variants };
}

// ──────────────────────────────────────────────────────────────
// Composite scoring
// ──────────────────────────────────────────────────────────────

function inferLegislationType(sourceId: string): "kanun" | "yonetmelik" | "nizamname" | null {
  const type = sourceId.replace("mevzuat:", "").split(".")[0];
  if (type === "1") return "kanun";
  if (type === "7") return "yonetmelik";
  if (type === "2") return "nizamname";
  return null;
}

/**
 * Compute a composite match score for a search result against an inventory entry.
 *
 * Signals used:
 * - titleScore: F1 overlap between inventory title and search result title
 * - aliasScore: max F1 overlap across all aliases
 * - metadataScore: small bonus when expected legislation type matches
 * - sourceIdProbeBonus: Path B eligibility — result.sourceId === candidateLegacySourceId
 *   AND title/alias score ≥ SOURCE_ID_PROBE_TITLE_THRESHOLD
 */
export function computeCompositeScore(
  entry: HealthLegislationInventoryEntry,
  result: OfficialLegislationSearchResult,
  variant: HealthLegislationQueryVariant
): CompositeMatchScore {
  const titleScore = scoreTitleMatch(entry.title, result.title);

  const aliasScore = (entry.aliases ?? []).reduce(
    (best, alias) => Math.max(best, scoreTitleMatch(alias, result.title)),
    0
  );

  // Small type-match bonus (does not cross the threshold on its own)
  let metadataScore = 0;
  let typeScore = 0;
  if (entry.expectedLegislationType) {
    const inferred = inferLegislationType(result.sourceId);
    if (inferred === entry.expectedLegislationType) {
      metadataScore = 0.05;
      typeScore = 1;
    }
  }

  // Marker score: proportion of entry markerTerms found in result title
  const markerScore = (entry.markerTerms ?? []).length > 0
    ? computeMarkerOverlap(result.title, entry.markerTerms!)
    : 0;

  // RG score: metadata score based on RG number match in sourceId or title
  let rgScore = 0;
  if (entry.expectedRgNumber && (result.legislationNumber === entry.expectedRgNumber || result.title.includes(entry.expectedRgNumber))) {
    rgScore = 1;
  }

  const bestTitleOrAlias = Math.max(titleScore, aliasScore);

  // sourceId probe: result.sourceId must match the variant's candidateLegacySourceId
  // AND there must be moderate title/alias evidence
  const sourceIdProbeBonus =
    variant.candidateLegacySourceId !== undefined &&
    variant.candidateLegacySourceId === result.sourceId
      ? 0.25
      : 0;

  const probePathEligible =
    sourceIdProbeBonus > 0 &&
    bestTitleOrAlias >= SOURCE_ID_PROBE_TITLE_THRESHOLD;

  const finalScore = Math.min(1.0, bestTitleOrAlias + metadataScore);

  return {
    titleScore,
    aliasScore,
    metadataScore,
    markerScore,
    rgScore,
    typeScore,
    sourceIdProbeBonus,
    finalScore,
    probePathEligible
  };
}

// ──────────────────────────────────────────────────────────────
// Direct sourceId verification (v0.31.0)
// ──────────────────────────────────────────────────────────────

/** Default marker terms for health legislation content verification. */
const DEFAULT_MARKER_TERMS = [
  "yönetmelik", "kanun", "sağlık", "hizmet", "madde"
];

/**
 * Extract a title string from the beginning of a document text.
 * Takes the first 200 chars, cleans non-alpha chars, returns first meaningful segment.
 */
export function extractDocTitle(text: string): string {
  const cleaned = text.trim().replace(/^\uFEFF/, "").trim();
  if (!cleaned) return "";
  const firstNewline = cleaned.indexOf("\n");
  const segment = firstNewline >= 0
    ? cleaned.slice(0, firstNewline).trim()
    : cleaned.slice(0, 200).trim();
  return segment.replace(/^[\d\s\-–—.…:+*]+/, "").trim();
}

/**
 * Compute a marker score: proportion of inventory entry search terms (as word sets)
 * that appear in the document text.
 */
export function computeMarkerOverlap(
  text: string,
  terms: string[]
): number {
  const textLower = text.toLocaleLowerCase("tr-TR");
  const matched = terms.filter((term) => {
    const termLower = term.toLocaleLowerCase("tr-TR");
    return termLower.split(/\s+/).every((word) => word.length >= 3 && textLower.includes(word));
  });
  return terms.length > 0 ? matched.length / terms.length : 0;
}

/**
 * Extract RG year and number from document text (first 1500 chars).
 * Returns { date, number } if found, empty strings otherwise.
 */
export function extractRgFromDocText(text: string): { date: string; number: string } {
  const segment = text.slice(0, 1500);
  // Pattern: RG date like "22/5/2014" or "22 Mayıs 2014" and RG number like "29007"
  const datePattern = /(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4})/;
  const dateMatch = segment.match(datePattern);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}` : "";
  const numberPattern = /(\d{5,6})/;
  const numbers = segment.match(numberPattern);
  const number = numbers ? numbers[1] : "";
  return { date, number };
}

/**
 * Compute RG score based on expected RG date match with extracted document text.
 */
function computeRgScore(entry: HealthLegislationInventoryEntry, rgDate: string): number {
  if (!entry.expectedRgDate || !rgDate) return 0;
  return entry.expectedRgDate === rgDate ? 1 : 0;
}

/**
 * Verify an inventory entry by directly fetching the official document
 * through its candidateLegacySourceId. This is Path C — it bypasses the
 * mevzuat.gov.tr search API entirely and fetches the PDF directly.
 *
 * Returns null if the entry has no candidateLegacySourceId.
 */
export async function verifyBySourceIdDirect(
  entry: HealthLegislationInventoryEntry,
  adapter: LegislationSearchAdapter
): Promise<HealthLegislationVerificationAttempt | null> {
  if (!entry.candidateLegacySourceId || !adapter.fetchOfficialDocument) return null;

  const base = {
    entryKey: entry.key,
    entryTitle: entry.title,
    entryStatus: entry.officialSourceStatus as "candidate" | "gap"
  };

  // ── known wrong match check on the sourceId itself
  const wrongCheck = checkKnownWrongMatch({ sourceId: entry.candidateLegacySourceId, title: entry.title });
  if (wrongCheck.isWrongMatch) {
    return {
      ...base,
      status: "rejected_wrong_document",
      allCandidates: [],
      searchTermsAttempted: [entry.candidateLegacySourceId],
      attemptedQueries: [],
      sourceIdProbeUsed: false,
      topCandidates: [],
      directFetchAttempted: false,
      directSourceIdAttempted: true,
      knownWrongMatchHit: true,
      knownWrongMatchReason: wrongCheck.reason,
      wrongMatchReason: `Known wrong match: ${wrongCheck.reason}`,
      rejectReason: `Known wrong match: ${wrongCheck.reason}`
    };
  }

  const doc = await adapter.fetchOfficialDocument(entry.candidateLegacySourceId);
  if (!isLiveDocument(doc)) {
    const isTimeout = doc.message?.includes("timed out") ?? false;
    return {
      ...base,
      status: isTimeout ? "rejected_source_id_timeout" : "rejected_source_id_fetch_failed",
      allCandidates: [],
      searchTermsAttempted: [entry.candidateLegacySourceId],
      attemptedQueries: [],
      sourceIdProbeUsed: false,
      topCandidates: [],
      directFetchAttempted: true,
      directSourceIdAttempted: true,
      directFetchTimedOut: isTimeout,
      directFetchStatus: isTimeout ? "timeout" : "fetch_failed",
      rejectReason: doc.message
    };
  }

  // Extract document title from PDF text
  const docTitle = extractDocTitle(doc.text);
  const textLength = doc.text.length;

  // Score title vs expected title and aliases
  const titleScore = scoreTitleMatch(entry.title, docTitle);
  const aliasScore = (entry.aliases ?? []).reduce(
    (best, alias) => Math.max(best, scoreTitleMatch(alias, docTitle)),
    0
  );
  const bestTitleOrAlias = Math.max(titleScore, aliasScore);

  // Compute marker overlap score using entry-level markerTerms
  const entryMarkerTerms = entry.markerTerms ?? [];
  const effectiveMarkerTerms = entryMarkerTerms.length > 0
    ? [...entryMarkerTerms, ...DEFAULT_MARKER_TERMS]
    : [...entry.searchTerms, ...DEFAULT_MARKER_TERMS];
  const markerScore = computeMarkerOverlap(doc.text, effectiveMarkerTerms);

  // Extract RG info from document text
  const rgInfo = extractRgFromDocText(doc.text);
  const rgScore = computeRgScore(entry, rgInfo.date);
  const typeScore = entry.expectedLegislationType ? 1 : 0;

  // Check negative marker terms
  const negCheck = entry.negativeMarkerTerms
    ? checkNegativeMarkers(doc.text, entry.negativeMarkerTerms)
    : { hit: false };

  // Build the official URL
  const officialUrl = entry.candidateLegacySourceId.startsWith("mevzuat:")
    ? `https://www.mevzuat.gov.tr/mevzuatmetin/${entry.candidateLegacySourceId.replace("mevzuat:", "").replace(/\./g, ".")}.pdf`
    : "";

  // Check empty document
  if (textLength < 100) {
    return {
      ...base,
      status: "rejected_source_id_empty_document",
      allCandidates: [],
      searchTermsAttempted: [entry.candidateLegacySourceId],
      attemptedQueries: [],
      sourceIdProbeUsed: false,
      topCandidates: [],
      directFetchAttempted: true,
      directSourceIdAttempted: true,
      directFetchTimedOut: false,
      directFetchStatus: "empty_document",
      directFetchTitle: docTitle,
      directFetchOfficialUrl: officialUrl,
      directFetchRgDate: rgInfo.date,
      directFetchRgNumber: rgInfo.number,
      directFetchMarkerScore: markerScore,
      directFetchTextLength: textLength,
      markerScore,
      rgScore,
      typeScore,
      rejectReason: `Document text too short (${textLength} chars) to be a valid regulation.`
    };
  }

  // Negative marker guard
  if (negCheck.hit) {
    return {
      ...base,
      status: "rejected_wrong_document",
      allCandidates: [],
      searchTermsAttempted: [entry.candidateLegacySourceId],
      attemptedQueries: [],
      sourceIdProbeUsed: false,
      topCandidates: [{
        title: docTitle,
        sourceId: entry.candidateLegacySourceId,
        score: bestTitleOrAlias
      }],
      directFetchAttempted: true,
      directSourceIdAttempted: true,
      directFetchTimedOut: false,
      directFetchStatus: "negative_marker_hit",
      directFetchTitle: docTitle,
      directFetchOfficialUrl: officialUrl,
      directFetchRgDate: rgInfo.date,
      directFetchRgNumber: rgInfo.number,
      directFetchMarkerScore: markerScore,
      directFetchTextLength: textLength,
      markerScore,
      rgScore,
      typeScore,
      negativeMarkerHit: true,
      negativeMarkerTerm: negCheck.term,
      wrongMatchReason: `Negative marker "${negCheck.term}" found in document — indicates wrong regulation.`,
      rejectReason: `Negative marker "${negCheck.term}" found in document — not the expected regulation.`
    };
  }

  // Verification criteria for direct sourceId path:
  // 1. Title match >= 0.50 (moderate confidence)
  // 2. Marker overlap >= 0.30 (content confirms the topic)
  // 3. Document non-empty (already checked)
  // 4. No negative marker hit (already checked)
  // 5. No known wrong match (already checked)
  // No non-gov.tr check needed — the fetch URL is gov.tr by construction
  if (bestTitleOrAlias >= 0.50 && markerScore >= MIN_MARKER_SCORE) {
    return {
      ...base,
      status: "verified_via_source_id_direct",
      bestMatch: {
        sourceId: entry.candidateLegacySourceId,
        title: docTitle,
        sourceUrl: `https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=${entry.candidateLegacySourceId.split(".")[2]}&MevzuatTur=${entry.candidateLegacySourceId.split(".")[0].replace("mevzuat:", "")}&MevzuatTertip=${entry.candidateLegacySourceId.split(".")[1]}`,
        documentUrl: officialUrl,
        legislationNumber: entry.candidateLegacySourceId.split(".")[2],
        legislationType: entry.candidateLegacySourceId.split(".")[0].replace("mevzuat:", ""),
        legislationArrangement: entry.candidateLegacySourceId.split(".")[1],
        titleMatchScore: bestTitleOrAlias,
        searchTerm: entry.candidateLegacySourceId
      },
      allCandidates: [],
      searchTermsAttempted: [entry.candidateLegacySourceId],
      attemptedQueries: [],
      sourceIdProbeUsed: true,
      topCandidates: [{
        title: docTitle,
        sourceId: entry.candidateLegacySourceId,
        score: bestTitleOrAlias
      }],
      directFetchAttempted: true,
      directSourceIdAttempted: true,
      directFetchTimedOut: false,
      directFetchStatus: "success",
      directFetchTitle: docTitle,
      directFetchOfficialUrl: officialUrl,
      directFetchRgDate: rgInfo.date,
      directFetchRgNumber: rgInfo.number,
      directFetchMarkerScore: markerScore,
      directFetchTextLength: textLength,
      mevzuatSourceId: entry.candidateLegacySourceId,
      officialUrl,
      titleScore,
      aliasScore,
      markerScore,
      rgScore,
      typeScore,
      metadataScore: 0,
      finalDecision: `Direct sourceId fetch verified: title match ${bestTitleOrAlias.toFixed(3)}, marker score ${markerScore.toFixed(3)}, RG ${rgInfo.date || "—"}.`
    };
  }

  // Title mismatch — bestTitleOrAlias too low
  return {
    ...base,
    status: "rejected_source_id_title_mismatch",
    allCandidates: [],
    searchTermsAttempted: [entry.candidateLegacySourceId],
    attemptedQueries: [],
    sourceIdProbeUsed: false,
    topCandidates: [{
      title: docTitle,
      sourceId: entry.candidateLegacySourceId,
      score: bestTitleOrAlias
    }],
    directFetchAttempted: true,
    directSourceIdAttempted: true,
    directFetchTimedOut: false,
    directFetchStatus: "title_mismatch",
    directFetchTitle: docTitle,
    directFetchOfficialUrl: officialUrl,
    directFetchRgDate: rgInfo.date,
    directFetchRgNumber: rgInfo.number,
    directFetchMarkerScore: markerScore,
    directFetchTextLength: textLength,
    markerScore,
    rgScore,
    typeScore,
    wrongMatchReason: `Direct title match ${bestTitleOrAlias.toFixed(3)} < 0.50 threshold.`,
    rejectReason: `Direct title match ${bestTitleOrAlias.toFixed(3)} < 0.50 threshold (titleScore: ${titleScore.toFixed(3)}, aliasScore: ${aliasScore.toFixed(3)}). Marker score: ${markerScore.toFixed(3)}. Doc docTitle: "${docTitle.slice(0, 120)}..."`
  };
}

function isLiveDocument(
  value: unknown
): value is { title: string; text: string; retrievedAt: string } {
  return typeof value === "object" && value !== null && "text" in value && "title" in value;
}

// ──────────────────────────────────────────────────────────────
// Per-entry verification
// ──────────────────────────────────────────────────────────────

/** Internal tracking of the best score seen for a given sourceId. */
interface CandidateEntry {
  result: OfficialLegislationSearchResult;
  bestScore: CompositeMatchScore;
  bestVariant: HealthLegislationQueryVariant;
}

/**
 * Verify a single inventory entry against mevzuat.gov.tr.
 *
 * Strategy (v0.32.0):
 * 1. Run multi-variant query plan, aggregate results.
 * 2. Apply known wrong match guard on each result (filter out).
 * 3. Apply Path A (title/alias ≥ 0.75) and Path B (sourceId probe + ≥ 0.50) rules.
 * 4. If search fails or no match, try Path C (direct sourceId/PDF fetch) as fallback.
 * 5. Apply gov.tr guard, ambiguity guard.
 */
export async function verifyInventoryEntry(
  entry: HealthLegislationInventoryEntry,
  adapter: LegislationSearchAdapter
): Promise<HealthLegislationVerificationAttempt> {
  const base = {
    entryKey: entry.key,
    entryTitle: entry.title,
    entryStatus: entry.officialSourceStatus as "candidate" | "gap"
  };

  // ── Path C (direct-first): try direct sourceId fetch BEFORE search API
  // If the entry has a candidateLegacySourceId, attempt direct PDF fetch first.
  // Verified results and definitive rejections (known wrong, negative marker,
  // title mismatch, empty document) are returned immediately. Transient errors
  // (timeout, fetch_failed) fall through to the search API as a fallback,
  // with diagnostics propagated.
  let directFetchDiagnostics: Record<string, unknown> | null = null;

  if (entry.candidateLegacySourceId && adapter.fetchOfficialDocument) {
    const directResult = await verifyBySourceIdDirect(entry, adapter);
    if (directResult) {
      if (directResult.status === "verified_via_source_id_direct") return directResult;
      if (directResult.status === "rejected_wrong_document") return directResult;
      if (directResult.status === "rejected_source_id_title_mismatch") return directResult;
      if (directResult.status === "rejected_source_id_empty_document") return directResult;
      // Transient failure — store diagnostics for fallback
      directFetchDiagnostics = {
        directFetchAttempted: directResult.directFetchAttempted,
        directSourceIdAttempted: directResult.directSourceIdAttempted,
        directFetchTimedOut: directResult.directFetchTimedOut,
        directFetchStatus: directResult.directFetchStatus
      };
    }
  }

  const queryPlan = buildQueryPlan(entry);
  const searchTermsAttempted: string[] = [];
  const candidateMap = new Map<string, CandidateEntry>();

  let searchError: string | null = null;

  for (const variant of queryPlan.variants) {
    searchTermsAttempted.push(variant.query);

    const rawResults = await adapter.searchOfficialLegislation(variant.query);
    if (!Array.isArray(rawResults)) {
      searchError = rawResults?.message ?? "unknown error";
      continue;
    }

    for (const result of rawResults) {
      const wrongCheck = checkKnownWrongMatch(result);
      if (wrongCheck.isWrongMatch) continue;

      const composite = computeCompositeScore(entry, result, variant);
      const existing = candidateMap.get(result.sourceId);

      const isBetter = !existing ||
        composite.finalScore > existing.bestScore.finalScore ||
        (!existing.bestScore.probePathEligible && composite.probePathEligible);

      if (isBetter) {
        candidateMap.set(result.sourceId, { result, bestScore: composite, bestVariant: variant });
      }
    }
  }

  const sorted = [...candidateMap.values()].sort((a, b) => {
    if (a.bestScore.probePathEligible !== b.bestScore.probePathEligible) {
      return a.bestScore.probePathEligible ? -1 : 1;
    }
    return b.bestScore.finalScore - a.bestScore.finalScore;
  });

  const allCandidates: HealthLegislationVerificationMatch[] = sorted.map((e) => ({
    sourceId: e.result.sourceId,
    title: e.result.title,
    sourceUrl: e.result.sourceUrl,
    documentUrl: e.result.documentUrl,
    legislationNumber: e.result.legislationNumber,
    legislationType: e.result.legislationType,
    legislationArrangement: e.result.legislationArrangement,
    titleMatchScore: e.bestScore.finalScore,
    searchTerm: e.bestVariant.query
  }));

  const topCandidates = allCandidates.slice(0, 3).map((c) => ({
    title: c.title, sourceId: c.sourceId, score: c.titleMatchScore
  }));

  if (sorted.length === 0 && searchError !== null) {
    return {
      ...base,
      status: "search_error",
      allCandidates: [],
      searchTermsAttempted,
      attemptedQueries: queryPlan.variants,
      sourceIdProbeUsed: false,
      topCandidates: [],
      rejectReason: `Search failed: ${searchError}`,
      ...(directFetchDiagnostics ?? {})
    };
  }

  if (sorted.length === 0) {
    return {
      ...base,
      status: "rejected_no_match",
      allCandidates: [],
      searchTermsAttempted,
      attemptedQueries: queryPlan.variants,
      sourceIdProbeUsed: false,
      topCandidates: [],
      rejectReason: "No results returned from any search variant. All known wrong matches filtered.",
      ...(directFetchDiagnostics ?? {})
    };
  }

  const best = sorted[0];
  const second = sorted[1];
  const bestScore = best.bestScore;

  const buildVerified = (status: "verified" | "verified_via_source_id_probe") => {
    const officialUrl =
      `https://www.mevzuat.gov.tr/mevzuatmetin/` +
      `${best.result.legislationType}.${best.result.legislationArrangement}.${best.result.legislationNumber}.pdf`;
    return {
      ...base,
      status,
      bestMatch: allCandidates[0],
      allCandidates,
      searchTermsAttempted,
      attemptedQueries: queryPlan.variants,
      bestQueryKind: best.bestVariant.kind,
      titleScore: bestScore.titleScore,
      aliasScore: bestScore.aliasScore,
      markerScore: bestScore.markerScore,
      rgScore: bestScore.rgScore,
      typeScore: bestScore.typeScore,
      metadataScore: bestScore.metadataScore,
      sourceIdProbeUsed: bestScore.probePathEligible,
      topCandidates,
      mevzuatSourceId: best.result.sourceId,
      officialUrl,
      finalDecision: `Search verified via ${status === "verified" ? "Path A" : "Path B"}: title/alias score ${bestScore.finalScore.toFixed(3)} ≥ ${status === "verified" ? "0.75" : "0.50"} threshold.`
    };
  };

  const buildRejected = (
    status: HealthLegislationVerificationStatus,
    rejectReason: string
  ) => ({
    ...base,
    status,
    bestMatch: allCandidates[0],
    allCandidates,
    searchTermsAttempted,
    attemptedQueries: queryPlan.variants,
    bestQueryKind: best.bestVariant.kind,
    titleScore: bestScore.titleScore,
    aliasScore: bestScore.aliasScore,
    markerScore: bestScore.markerScore,
    rgScore: bestScore.rgScore,
    typeScore: bestScore.typeScore,
    metadataScore: bestScore.metadataScore,
    sourceIdProbeUsed: bestScore.probePathEligible,
    topCandidates,
    rejectReason,
    ...(directFetchDiagnostics ?? {}),
    knownWrongMatchHit: topCandidates.some(c =>
      KNOWN_WRONG_MATCHES.some(wm =>
        c.sourceId.startsWith(wm.sourceIdPattern)
      )
    )
  });

  const checkAmbiguous = (pathBestScore: number) => {
    if (!second) return false;
    const secondScore = second.bestScore.finalScore;
    return pathBestScore - secondScore < AMBIGUITY_MARGIN;
  };

  if (bestScore.finalScore >= ACCEPT_THRESHOLD) {
    if (checkAmbiguous(bestScore.finalScore)) {
      return buildRejected(
        "rejected_ambiguous",
        `Ambiguous: "${best.result.title}" (${bestScore.finalScore.toFixed(3)}) vs ` +
        `"${second!.result.title}" (${second!.bestScore.finalScore.toFixed(3)})`
      );
    }
    if (!isGovTrUrl(best.result.sourceUrl) && !isGovTrUrl(best.result.documentUrl)) {
      return buildRejected("rejected_non_gov_tr", `Non-gov.tr URL: ${best.result.sourceUrl}`);
    }
    return buildVerified("verified");
  }

  if (bestScore.probePathEligible) {
    if (checkAmbiguous(bestScore.finalScore)) {
      return buildRejected(
        "rejected_ambiguous",
        `Probe path ambiguous: "${best.result.title}" vs "${second!.result.title}"`
      );
    }
    if (!isGovTrUrl(best.result.sourceUrl) && !isGovTrUrl(best.result.documentUrl)) {
      return buildRejected("rejected_non_gov_tr", `Non-gov.tr URL on probe result: ${best.result.sourceUrl}`);
    }
    return buildVerified("verified_via_source_id_probe");
  }

  if (
    entry.expectedLegislationType !== undefined &&
    inferLegislationType(best.result.sourceId) !== null &&
    inferLegislationType(best.result.sourceId) !== entry.expectedLegislationType
  ) {
    return buildRejected(
      "rejected_wrong_document",
      `Type mismatch: expected ${entry.expectedLegislationType}, ` +
      `got ${inferLegislationType(best.result.sourceId)} for "${best.result.title}"`
    );
  }

  return buildRejected(
    "rejected_low_score",
    `Best score ${bestScore.finalScore.toFixed(3)} < threshold ${ACCEPT_THRESHOLD} ` +
    `(titleScore: ${bestScore.titleScore.toFixed(3)}, aliasScore: ${bestScore.aliasScore.toFixed(3)}). ` +
    `Best: "${best.result.title}"`
  );
}

// ──────────────────────────────────────────────────────────────
// Report builder
// ──────────────────────────────────────────────────────────────

/**
 * Verify all candidate and gap entries, returning a structured report.
 * Adds a small inter-request delay to be respectful of mevzuat.gov.tr.
 */
export async function buildAccessVerificationReport(
  entries: HealthLegislationInventoryEntry[],
  adapter: LegislationSearchAdapter,
  interRequestDelayMs = 400
): Promise<HealthLegislationVerificationReport> {
  const attempts: HealthLegislationVerificationAttempt[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && interRequestDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, interRequestDelayMs));
    }
    attempts.push(await verifyInventoryEntry(entries[i], adapter));
  }

  const verifiedEntries = attempts.filter(
    (a) => a.status === "verified" || a.status === "verified_via_source_id_probe" || a.status === "verified_via_source_id_direct"
  );
  const searchErrorEntries = attempts.filter((a) => a.status === "search_error");
  const rejectedEntries = attempts.filter(
    (a) => a.status !== "verified" && a.status !== "verified_via_source_id_probe" && a.status !== "verified_via_source_id_direct" && a.status !== "search_error"
  );

  return {
    attemptedCount: attempts.length,
    verifiedCount: verifiedEntries.length,
    rejectedCount: rejectedEntries.length,
    searchErrorCount: searchErrorEntries.length,
    attempts,
    verifiedEntries,
    rejectedEntries,
    searchErrorEntries,
    generatedAt: new Date().toISOString()
  };
}
