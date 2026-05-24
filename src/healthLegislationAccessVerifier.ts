/**
 * Official Health Legislation Access Verifier (v0.29.0)
 *
 * Searches mevzuat.gov.tr for each candidate/gap inventory entry and scores
 * title similarity to determine if an official sourceId can be confirmed.
 *
 * Design rules:
 * - Conservative: only accept if title match F1 ≥ ACCEPT_THRESHOLD.
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

/** Minimum F1 word-overlap score to accept a search result as a match. */
const ACCEPT_THRESHOLD = 0.75;

/**
 * If the best and second-best score differ by less than this margin, the
 * result is ambiguous and we conservatively reject.
 */
const AMBIGUITY_MARGIN = 0.10;

/**
 * Short words excluded from overlap scoring (common Turkish function words).
 * These words don't distinguish legislation titles.
 */
const STOP_WORDS = new Set([
  "ve", "ile", "bir", "bu", "de", "da", "ki", "ne", "ya", "en",
  "den", "dan", "nin", "nun", "nun", "nun", "nın", "ten", "tan",
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
// Types
// ──────────────────────────────────────────────────────────────

export interface HealthLegislationVerificationMatch {
  sourceId: string;
  title: string;
  sourceUrl: string;
  documentUrl: string;
  legislationNumber: string;
  legislationType: string;
  legislationArrangement: string;
  titleMatchScore: number;
  searchTerm: string;
}

export type HealthLegislationVerificationStatus =
  | "verified"
  | "rejected_no_match"
  | "rejected_ambiguous"
  | "rejected_non_gov_tr"
  | "rejected_low_score"
  | "search_error";

export interface HealthLegislationVerificationAttempt {
  entryKey: string;
  entryTitle: string;
  entryStatus: "candidate" | "gap";
  status: HealthLegislationVerificationStatus;
  bestMatch?: HealthLegislationVerificationMatch;
  allCandidates: HealthLegislationVerificationMatch[];
  rejectReason?: string;
  searchTermsAttempted: string[];
  /** Set only when status === "verified" */
  mevzuatSourceId?: string;
  /** Set only when status === "verified" */
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

/**
 * Normalize a Turkish legislation title for case-insensitive word-overlap comparison.
 * Converts Turkish characters to ASCII equivalents, lowercases, collapses whitespace.
 */
export function normalizeTitleForMatch(title: string): string {
  return title
    // Turkish uppercase letters first (before toLowerCase)
    .replace(/İ/g, "i")
    .replace(/I/g, "i")  // treat dotless-I as i for matching purposes
    .replace(/Ş/g, "s")
    .replace(/Ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/Â/g, "a")
    .replace(/Î/g, "i")
    .replace(/Û/g, "u")
    // Turkish lowercase letters
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .toLowerCase()
    // Replace non-alphanumeric chars with space
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract meaningful words from a normalized title, filtering stop words and
 * short tokens.
 */
export function titleWords(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * F1-based word-overlap score between two legislation titles.
 * Returns 0–1; 1.0 means identical word sets.
 *
 * Uses recall (what fraction of the inventory title's words appear in the
 * search result) and precision (what fraction of the search result's words
 * appear in the inventory title).
 */
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
// Per-entry verification
// ──────────────────────────────────────────────────────────────

/**
 * Try to verify a single inventory entry against mevzuat.gov.tr search.
 *
 * Searches using each of the entry's searchTerms in turn. Collects all
 * gov.tr results, scores by title overlap, then applies accept/reject rules.
 */
export async function verifyInventoryEntry(
  entry: HealthLegislationInventoryEntry,
  adapter: LegislationSearchAdapter
): Promise<HealthLegislationVerificationAttempt> {
  const base: Pick<HealthLegislationVerificationAttempt, "entryKey" | "entryTitle" | "entryStatus"> = {
    entryKey: entry.key,
    entryTitle: entry.title,
    entryStatus: entry.officialSourceStatus as "candidate" | "gap"
  };

  const searchTermsAttempted: string[] = [];
  // Map keyed by sourceId — keeps the best score per candidate
  const candidateMap = new Map<string, HealthLegislationVerificationMatch>();

  for (const term of entry.searchTerms) {
    searchTermsAttempted.push(term);

    const results = await adapter.searchOfficialLegislation(term);

    // Detect search failure
    if (!Array.isArray(results)) {
      return {
        ...base,
        status: "search_error",
        allCandidates: [],
        searchTermsAttempted,
        rejectReason: `Search failed for term "${term}": ${results.message}`
      };
    }

    for (const result of results) {
      const score = scoreTitleMatch(entry.title, result.title);
      const existing = candidateMap.get(result.sourceId);

      if (!existing || score > existing.titleMatchScore) {
        candidateMap.set(result.sourceId, {
          sourceId: result.sourceId,
          title: result.title,
          sourceUrl: result.sourceUrl,
          documentUrl: result.documentUrl,
          legislationNumber: result.legislationNumber,
          legislationType: result.legislationType,
          legislationArrangement: result.legislationArrangement,
          titleMatchScore: score,
          searchTerm: term
        });
      }
    }
  }

  const allCandidates = [...candidateMap.values()].sort((a, b) => b.titleMatchScore - a.titleMatchScore);
  const best = allCandidates[0];
  const second = allCandidates[1];

  // No results at all
  if (!best) {
    return {
      ...base,
      status: "rejected_no_match",
      allCandidates: [],
      searchTermsAttempted,
      rejectReason: "No results returned from any search term."
    };
  }

  // Score too low
  if (best.titleMatchScore < ACCEPT_THRESHOLD) {
    return {
      ...base,
      status: "rejected_low_score",
      bestMatch: best,
      allCandidates,
      searchTermsAttempted,
      rejectReason:
        `Best match score ${best.titleMatchScore.toFixed(3)} < threshold ${ACCEPT_THRESHOLD}. ` +
        `Best: "${best.title}"`
    };
  }

  // Ambiguity guard
  if (second && best.titleMatchScore - second.titleMatchScore < AMBIGUITY_MARGIN) {
    return {
      ...base,
      status: "rejected_ambiguous",
      bestMatch: best,
      allCandidates,
      searchTermsAttempted,
      rejectReason:
        `Ambiguous: "${best.title}" (${best.titleMatchScore.toFixed(3)}) vs ` +
        `"${second.title}" (${second.titleMatchScore.toFixed(3)}) — margin ${(best.titleMatchScore - second.titleMatchScore).toFixed(3)} < ${AMBIGUITY_MARGIN}`
    };
  }

  // gov.tr final guard (belt-and-suspenders; should already be filtered above)
  if (!isGovTrUrl(best.sourceUrl) && !isGovTrUrl(best.documentUrl)) {
    return {
      ...base,
      status: "rejected_non_gov_tr",
      bestMatch: best,
      allCandidates,
      searchTermsAttempted,
      rejectReason: `Non-gov.tr URL in best match: ${best.sourceUrl}`
    };
  }

  // VERIFIED
  const officialUrl =
    `https://www.mevzuat.gov.tr/mevzuatmetin/` +
    `${best.legislationType}.${best.legislationArrangement}.${best.legislationNumber}.pdf`;

  return {
    ...base,
    status: "verified",
    bestMatch: best,
    allCandidates,
    searchTermsAttempted,
    mevzuatSourceId: best.sourceId,
    officialUrl
  };
}

// ──────────────────────────────────────────────────────────────
// Report builder
// ──────────────────────────────────────────────────────────────

/**
 * Verify all candidate and gap entries, returning a structured report.
 *
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

    const attempt = await verifyInventoryEntry(entries[i], adapter);
    attempts.push(attempt);
  }

  const verifiedEntries = attempts.filter((a) => a.status === "verified");
  const searchErrorEntries = attempts.filter((a) => a.status === "search_error");
  const rejectedEntries = attempts.filter((a) => a.status !== "verified" && a.status !== "search_error");

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
