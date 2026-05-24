/**
 * Official Health Legislation Access Verifier (v0.30.0)
 *
 * Searches mevzuat.gov.tr for each candidate/gap inventory entry using a
 * multi-variant query plan (exact title, aliases, RG number, legacy sourceId
 * probe, keyword terms) and scores results via F1 word-overlap + metadata
 * signals to determine if an official sourceId can be confirmed.
 *
 * Design rules:
 * - Conservative: only accept via Path A (title/alias score ≥ 0.75) or
 *   Path B (candidateLegacySourceId exact match + title/alias score ≥ 0.50).
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
  | "verified_via_source_id_probe" // Path B: sourceId match + title/alias ≥ 0.50
  | "rejected_no_match"           // No search results at all
  | "rejected_ambiguous"          // Top two results too close in score
  | "rejected_non_gov_tr"         // Best result is on a non-gov.tr domain
  | "rejected_low_score"          // Score below threshold
  | "rejected_wrong_document"     // Wrong legislation type (type mismatch)
  | "search_error";               // Adapter returned an error

export interface CompositeMatchScore {
  titleScore: number;
  aliasScore: number;
  metadataScore: number;
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
  if (entry.expectedLegislationType) {
    const inferred = inferLegislationType(result.sourceId);
    if (inferred === entry.expectedLegislationType) metadataScore = 0.05;
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
    sourceIdProbeBonus,
    finalScore,
    probePathEligible
  };
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
 * Executes all query plan variants in order, aggregates results,
 * then applies conservative acceptance rules.
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

  const queryPlan = buildQueryPlan(entry);
  const searchTermsAttempted: string[] = [];
  const candidateMap = new Map<string, CandidateEntry>();

  for (const variant of queryPlan.variants) {
    searchTermsAttempted.push(variant.query);

    const results = await adapter.searchOfficialLegislation(variant.query);
    if (!Array.isArray(results)) {
      return {
        ...base,
        status: "search_error",
        allCandidates: [],
        searchTermsAttempted,
        attemptedQueries: queryPlan.variants,
        sourceIdProbeUsed: false,
        topCandidates: [],
        rejectReason: `Search failed for query "${variant.query}" (kind: ${variant.kind}): ${results.message}`
      };
    }

    for (const result of results) {
      const composite = computeCompositeScore(entry, result, variant);
      const existing = candidateMap.get(result.sourceId);

      // Keep the candidate entry with the best finalScore (or probePathEligible if scores tie)
      const isBetter = !existing ||
        composite.finalScore > existing.bestScore.finalScore ||
        (!existing.bestScore.probePathEligible && composite.probePathEligible);

      if (isBetter) {
        candidateMap.set(result.sourceId, { result, bestScore: composite, bestVariant: variant });
      }
    }
  }

  // Sort: probe-eligible first among ties, then by finalScore
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

  // ── No results at all ────────────────────────────────────────
  if (sorted.length === 0) {
    return {
      ...base,
      status: "rejected_no_match",
      allCandidates: [],
      searchTermsAttempted,
      attemptedQueries: queryPlan.variants,
      sourceIdProbeUsed: false,
      topCandidates: [],
      rejectReason: "No results returned from any search variant."
    };
  }

  const best = sorted[0];
  const second = sorted[1];
  const bestScore = best.bestScore;

  // Shared accept helper
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
      metadataScore: bestScore.metadataScore,
      sourceIdProbeUsed: bestScore.probePathEligible,
      topCandidates,
      mevzuatSourceId: best.result.sourceId,
      officialUrl
    };
  };

  // Shared reject helper
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
    metadataScore: bestScore.metadataScore,
    sourceIdProbeUsed: bestScore.probePathEligible,
    topCandidates,
    rejectReason
  });

  // ── Ambiguity guard (shared for both paths) ───────────────────
  const checkAmbiguous = (pathBestScore: number) => {
    if (!second) return false;
    // For probe path, only the non-probe second is a concern
    const secondScore = second.bestScore.finalScore;
    return pathBestScore - secondScore < AMBIGUITY_MARGIN;
  };

  // ── Path A: strong title/alias score ─────────────────────────
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

  // ── Path B: sourceId probe + moderate title ───────────────────
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

  // ── Wrong document type ───────────────────────────────────────
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

  // ── Low score ─────────────────────────────────────────────────
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
    (a) => a.status === "verified" || a.status === "verified_via_source_id_probe"
  );
  const searchErrorEntries = attempts.filter((a) => a.status === "search_error");
  const rejectedEntries = attempts.filter(
    (a) => a.status !== "verified" && a.status !== "verified_via_source_id_probe" && a.status !== "search_error"
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
