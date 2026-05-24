/**
 * Official Health Legislation RG Lead SourceId Resolver (v0.35.0)
 *
 * Takes RG-only legislation leads (expectedRgNumber without confirmed
 * candidateLegacySourceId) and attempts to resolve an official mevzuat.gov.tr
 * sourceId or PDF URL candidate using RG-number-based and title-combined
 * search variants.
 *
 * Design rules:
 * - RG lead ≠ verified mevzuat. RG lead is only a signal for discovery.
 * - Candidates are routed through the existing verifier (verifyBySourceIdDirect).
 * - Active coverage activation requires verifier approval; no auto-promotion.
 * - gov.tr dışı kaynaklar ignored — never become candidates.
 * - No risk levels, urgent actions, or definitive legal opinions.
 * - local-yargi NOT imported.
 */

import type { HealthLegislationInventoryEntry } from "./healthLegislationInventory.js";
import type { LegislationSearchAdapter } from "./healthLegislationAccessVerifier.js";
import { scoreTitleMatch, verifyBySourceIdDirect } from "./healthLegislationAccessVerifier.js";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type RgLeadResolutionStatus =
  | "not_attempted"
  | "candidate_found"
  | "verified"
  | "rejected"
  | "needs_manual_review"
  | "no_candidate_found";

export interface RgLeadResolutionCandidate {
  sourceId: string;
  officialUrl: string;
  title: string;
  matchScore: number;
  queryVariant: string;
}

export interface RgLeadPerEntryResult {
  entryKey: string;
  entryTitle: string;
  expectedRgNumber: string;
  expectedRgDate?: string;
  queryVariantsAttempted: string[];
  candidatesFound: RgLeadResolutionCandidate[];
  bestCandidate?: RgLeadResolutionCandidate;
  verificationStatus: RgLeadResolutionStatus;
  verifierStatus?: string;
  titleScore?: number;
  markerScore?: number;
  rgScore?: number;
  rejectReason?: string;
  recommendedNextAction: string;
}

export interface HealthLegislationRgResolutionResult {
  entriesScanned: number;
  rgLeadsProcessed: number;
  sourceIdCandidatesFound: number;
  officialPdfCandidatesFound: number;
  candidatesSentToVerifier: number;
  verifiedCount: number;
  rejectedCount: number;
  needsManualReviewCount: number;
  nonGovIgnoredCount: number;
  entries: RgLeadPerEntryResult[];
  generatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function isGovTrUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".gov.tr") || hostname === "gov.tr";
  } catch {
    return false;
  }
}

/**
 * Build query variants for RG-only entry discovery.
 * Variants combine RG number with title fragments to improve
 * mevzuat.gov.tr search recall.
 */
function buildRgQueryVariants(entry: HealthLegislationInventoryEntry): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();

  const add = (q: string) => {
    if (!seen.has(q)) {
      seen.add(q);
      variants.push(q);
    }
  };

  const rg = entry.expectedRgNumber;
  if (!rg) return variants;

  // A. RG number alone
  add(rg);

  // B. RG number + short title (first meaningful words)
  const shortTitle = entry.title
    .replace(/Hakkında|Hakkinda|Dair|ve|ile|bir|İlgili|ilgili/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const titleWords = shortTitle.split(/\s+/).filter((w) => w.length >= 4);
  const shortSnip = titleWords.slice(0, 3).join(" ");
  if (shortSnip) {
    add(`${rg} ${shortSnip}`);
  }

  // C. RG number + first alias
  if (entry.aliases && entry.aliases.length > 0) {
    const aliasShort = entry.aliases[0]
      .replace(/Hakkında|Hakkinda|Dair|ve|ile|bir|İlgili|ilgili/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    if (aliasShort) {
      add(`${rg} ${aliasShort}`);
    }
  }

  // D. Full title alone
  add(entry.title.slice(0, 80));

  // E. Full title + RG number
  add(`${entry.title.slice(0, 80)} ${rg}`);

  return variants;
}

/**
 * Score a search result title against the inventory entry metadata.
 * Returns 0–1 composite score.
 */
function scoreCandidate(
  entry: HealthLegislationInventoryEntry,
  resultTitle: string
): number {
  const titleScore = scoreTitleMatch(entry.title, resultTitle);
  const aliasScore = (entry.aliases ?? []).reduce(
    (best, alias) => Math.max(best, scoreTitleMatch(alias, resultTitle)),
    0
  );
  const bestTitleOrAlias = Math.max(titleScore, aliasScore);

  // Bonus if RG number appears in title
  let rgBonus = 0;
  if (entry.expectedRgNumber && resultTitle.includes(entry.expectedRgNumber)) {
    rgBonus = 0.15;
  }

  return Math.min(1.0, bestTitleOrAlias + rgBonus);
}

// ──────────────────────────────────────────────────────────────
// Per-entry resolver
// ──────────────────────────────────────────────────────────────

/**
 * Resolve sourceId candidates for a single RG-only inventory entry.
 * Generates query variants, searches mevzuat.gov.tr, scores results,
 * and routes best candidate through the verifier.
 */
export async function resolveRgEntry(
  entry: HealthLegislationInventoryEntry,
  adapter: LegislationSearchAdapter
): Promise<RgLeadPerEntryResult> {
  const rgNumber = entry.expectedRgNumber ?? "";
  const base: Pick<RgLeadPerEntryResult, "entryKey" | "entryTitle" | "expectedRgNumber" | "expectedRgDate"> = {
    entryKey: entry.key,
    entryTitle: entry.title,
    expectedRgNumber: rgNumber,
    expectedRgDate: entry.expectedRgDate
  };

  if (!rgNumber) {
    return {
      ...base,
      queryVariantsAttempted: [],
      candidatesFound: [],
      verificationStatus: "not_attempted",
      recommendedNextAction: "No RG number available for this entry."
    };
  }

  const queryVariants = buildRgQueryVariants(entry);
  const candidates: RgLeadResolutionCandidate[] = [];
  const nonGovIgnored: string[] = [];

  for (const query of queryVariants) {
    const rawResults = await adapter.searchOfficialLegislation(query);
    if (!Array.isArray(rawResults)) continue;

    for (const result of rawResults) {
      // gov.tr guard
      if (!isGovTrUrl(result.sourceUrl) && !isGovTrUrl(result.documentUrl)) {
        nonGovIgnored.push(result.sourceUrl);
        continue;
      }

      const score = scoreCandidate(entry, result.title);
      if (score <= 0) continue;

      const existing = candidates.findIndex((c) => c.sourceId === result.sourceId);
      const candidate: RgLeadResolutionCandidate = {
        sourceId: result.sourceId,
        officialUrl: result.documentUrl,
        title: result.title,
        matchScore: score,
        queryVariant: query
      };

      if (existing >= 0) {
        if (score > candidates[existing].matchScore) {
          candidates[existing] = candidate;
        }
      } else {
        candidates.push(candidate);
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.matchScore - a.matchScore);

  if (candidates.length === 0) {
    return {
      ...base,
      queryVariantsAttempted: queryVariants,
      candidatesFound: [],
      verificationStatus: "no_candidate_found",
      recommendedNextAction: `No sourceId candidate found for RG ${rgNumber}. Manual mevzuat.gov.tr search needed.`
    };
  }

    // Route best candidate through verifier
  const best = candidates[0];
  if (!adapter.fetchOfficialDocument) {
    return {
      ...base,
      queryVariantsAttempted: queryVariants,
      candidatesFound: candidates,
      bestCandidate: best,
      verificationStatus: "candidate_found",
      recommendedNextAction: `Best candidate: ${best.sourceId} (score ${best.matchScore.toFixed(3)}). Needs verifier to confirm.`
    };
  }

  // Create scoped entry with discovered sourceId for verifier
  const scopedEntry: HealthLegislationInventoryEntry = {
    ...entry,
    candidateLegacySourceId: best.sourceId,
    officialSourceStatus: "candidate"
  };

  let verifierResult: Awaited<ReturnType<typeof verifyBySourceIdDirect>>;
  try {
    verifierResult = await verifyBySourceIdDirect(scopedEntry, adapter);
  } catch {
    return {
      ...base,
      queryVariantsAttempted: queryVariants,
      candidatesFound: candidates,
      bestCandidate: best,
      verificationStatus: "needs_manual_review",
      recommendedNextAction: `Verifier threw for candidate ${best.sourceId}. Manual review needed.`
    };
  }

  if (verifierResult && verifierResult.status === "verified_via_source_id_direct") {
    return {
      ...base,
      queryVariantsAttempted: queryVariants,
      candidatesFound: candidates,
      bestCandidate: best,
      verificationStatus: "verified",
      verifierStatus: verifierResult.status,
      titleScore: verifierResult.titleScore,
      markerScore: verifierResult.markerScore,
      rgScore: verifierResult.rgScore,
      recommendedNextAction: `Verified! SourceId: ${best.sourceId}, URL: ${best.officialUrl}. Can promote to active coverage.`
    };
  }

  if (verifierResult) {
    return {
      ...base,
      queryVariantsAttempted: queryVariants,
      candidatesFound: candidates,
      bestCandidate: best,
      verificationStatus: "rejected",
      verifierStatus: verifierResult.status,
      titleScore: verifierResult.titleScore,
      markerScore: verifierResult.markerScore,
      rgScore: verifierResult.rgScore,
      rejectReason: verifierResult.rejectReason ?? `Verifier rejected: ${verifierResult.status}`,
      recommendedNextAction: `Best candidate ${best.sourceId} rejected by verifier. Manual review needed.`
    };
  }

  return {
    ...base,
    queryVariantsAttempted: queryVariants,
    candidatesFound: candidates,
    bestCandidate: best,
    verificationStatus: "needs_manual_review",
    recommendedNextAction: `Verifier returned inconclusive for candidate ${best.sourceId}. Manual review needed.`
  };
}

// ──────────────────────────────────────────────────────────────
// Report builder
// ──────────────────────────────────────────────────────────────

/**
 * Filter inventory entries that are RG-only (have expectedRgNumber but no
 * confirmed sourceId) and are not yet verified or deferred.
 */
export function filterRgOnlyLeads(
  entries: HealthLegislationInventoryEntry[]
): HealthLegislationInventoryEntry[] {
  return entries.filter(
    (e) =>
      e.expectedRgNumber &&
      !e.mevzuatSourceId &&
      e.officialSourceStatus !== "verified" &&
      e.officialSourceStatus !== "deferred" &&
      e.coverageStatus !== "deferred"
  );
}

/**
 * Resolve RG-only leads across multiple inventory entries.
 * Returns a structured report with per-entry details.
 */
export async function buildRgResolutionReport(
  entries: HealthLegislationInventoryEntry[],
  adapter: LegislationSearchAdapter
): Promise<HealthLegislationRgResolutionResult> {
  const rgEntries = filterRgOnlyLeads(entries);
  const results: RgLeadPerEntryResult[] = [];

  let sourceIdCandidatesFound = 0;
  let pdfCandidatesFound = 0;
  let candidatesSentToVerifier = 0;
  let verifiedCount = 0;
  let rejectedCount = 0;
  let needsManualReviewCount = 0;
  let nonGovIgnoredCount = 0;

  for (const entry of rgEntries) {
    const result = await resolveRgEntry(entry, adapter);
    results.push(result);

    if (result.candidatesFound.length > 0) {
      const hasSourceIdCandidates = result.candidatesFound.some((c) => c.sourceId.startsWith("mevzuat:"));
      const hasPdfCandidates = result.candidatesFound.some((c) => c.officialUrl.includes(".pdf"));
      if (hasSourceIdCandidates) sourceIdCandidatesFound++;
      if (hasPdfCandidates) pdfCandidatesFound++;
    }

    if (result.verificationStatus === "verified") {
      candidatesSentToVerifier++;
      verifiedCount++;
    } else if (result.verificationStatus === "rejected") {
      candidatesSentToVerifier++;
      rejectedCount++;
    } else if (
      result.verificationStatus === "needs_manual_review" ||
      result.verificationStatus === "candidate_found"
    ) {
      needsManualReviewCount++;
    } else if (result.verificationStatus === "no_candidate_found") {
      needsManualReviewCount++;
    }
  }

  return {
    entriesScanned: entries.length,
    rgLeadsProcessed: rgEntries.length,
    sourceIdCandidatesFound,
    officialPdfCandidatesFound: pdfCandidatesFound,
    candidatesSentToVerifier,
    verifiedCount,
    rejectedCount,
    needsManualReviewCount,
    nonGovIgnoredCount,
    entries: results,
    generatedAt: new Date().toISOString()
  };
}
