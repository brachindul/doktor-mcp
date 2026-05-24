/**
 * Cross-source provenance utilities for CourtDecision (v0.27.0).
 *
 * Handles:
 * - Deriving ContentStatus from decision fields
 * - Determining quote usability
 * - Building stable dedup keys
 * - Merging duplicate decisions across sources
 * - Building provenance metrics
 */

import type {
  CourtDecision,
  ContentStatus,
  FetchStatus,
  DecisionSourceProvenance
} from "../contracts/legal.js";

// Re-export types so callers can import from this module
export type { FetchStatus, DecisionSourceProvenance };

// ──────────────────────────────────────────────────────────────
// Return types
// ──────────────────────────────────────────────────────────────

export interface MergeResult {
  merged: CourtDecision[];
  duplicateCount: number;
  uniqueCount: number;
  mergedPairsLog: Array<{ kept: string; absorbed: string; matchReason: string }>;
}

export interface ProvenanceMetrics {
  totalDecisions: number;
  uniqueDecisions: number;
  duplicateDecisionCount: number;
  mergedDecisionCount: number;
  provenanceSourceDistribution: Record<string, number>;
  contentStatusDistribution: Record<string, number>;
  fetchStatusDistribution: Record<string, number>;
  quoteUsableCount: number;
  quoteUnusableCount: number;
  metadataOnlyDecisionCount: number;
  pdfLinkOnlyDecisionCount: number;
  unavailableDecisionCount: number;
  perSourceFetchStatusDistribution: Record<string, Record<string, number>>;
}

// ──────────────────────────────────────────────────────────────
// ContentStatus strength ordering (higher index = stronger)
// ──────────────────────────────────────────────────────────────

const CONTENT_STATUS_STRENGTH: ContentStatus[] = [
  "unavailable",
  "metadata_only",
  "pdf_link_only",
  "html_markdown",
  "full_text"
];

function strengthOf(status: ContentStatus): number {
  const idx = CONTENT_STATUS_STRENGTH.indexOf(status);
  return idx === -1 ? 0 : idx;
}

// ──────────────────────────────────────────────────────────────
// deriveContentStatus
// ──────────────────────────────────────────────────────────────

/**
 * Derive ContentStatus from a CourtDecision's fields.
 * If `contentStatus` is already set on the decision, it is returned as-is.
 */
export function deriveContentStatus(decision: CourtDecision): ContentStatus {
  if (decision.contentStatus !== undefined) {
    return decision.contentStatus;
  }
  if (decision.fullText) {
    return "full_text";
  }
  if (decision.evidence.fullText === true) {
    return "html_markdown";
  }
  return "metadata_only";
}

// ──────────────────────────────────────────────────────────────
// isQuoteUsable
// ──────────────────────────────────────────────────────────────

/**
 * Returns true only when the decision has rich enough content to be quoted
 * and is not flagged with an ineligible eligibility status.
 */
export function isQuoteUsable(decision: CourtDecision): boolean {
  const cs = deriveContentStatus(decision);
  if (cs !== "full_text" && cs !== "html_markdown") {
    return false;
  }
  const eligibility = decision.decisionSourceTrace?.eligibilityStatus;
  if (
    eligibility === "metadata_only" ||
    eligibility === "procedural_only" ||
    eligibility === "no_reasoning"
  ) {
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// buildDecisionKey
// ──────────────────────────────────────────────────────────────

/**
 * Build a stable dedup key for a CourtDecision.
 *
 * Priority:
 *   1. `doc::<documentId>` when evidence.documentId is non-empty
 *   2. Court-based strong key when court + meritsNumber + decisionNumber are present
 *   3. null (insufficient data)
 */
export function buildDecisionKey(decision: CourtDecision): string | null {
  const docId = decision.evidence.documentId;
  if (docId && docId.trim() !== "") {
    return `doc::${docId.trim()}`;
  }
  const court = decision.court;
  const meritsNumber = decision.meritsNumber;
  const decisionNumber = decision.decisionNumber;
  if (court && meritsNumber && decisionNumber) {
    const chamber = decision.chamber ?? "";
    const date = decision.decisionDate ?? "";
    return `${court}::${chamber}::${date}::${meritsNumber}::${decisionNumber}`;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// chooseStrongestContentStatus
// ──────────────────────────────────────────────────────────────

/**
 * Given a list of ContentStatus values, return the strongest one.
 * Order: full_text > html_markdown > pdf_link_only > metadata_only > unavailable.
 */
export function chooseStrongestContentStatus(statuses: ContentStatus[]): ContentStatus {
  if (statuses.length === 0) return "unavailable";
  return statuses.reduce<ContentStatus>((best, current) => {
    return strengthOf(current) > strengthOf(best) ? current : best;
  }, "unavailable");
}

// ──────────────────────────────────────────────────────────────
// mergeDuplicateDecisions
// ──────────────────────────────────────────────────────────────

/**
 * Merge duplicate decisions.
 * Two decisions are duplicates if they share the same non-null buildDecisionKey.
 * The winner keeps the strongest contentStatus; loser's provenance is merged in.
 */
export function mergeDuplicateDecisions(decisions: CourtDecision[]): MergeResult {
  const keyMap = new Map<string, CourtDecision>();
  const mergedPairsLog: MergeResult["mergedPairsLog"] = [];
  let duplicateCount = 0;

  // Decisions without a key are kept as-is (no dedup possible)
  const noKeyDecisions: CourtDecision[] = [];

  for (const decision of decisions) {
    const key = buildDecisionKey(decision);
    if (key === null) {
      noKeyDecisions.push(decision);
      continue;
    }

    const existing = keyMap.get(key);
    if (!existing) {
      keyMap.set(key, decision);
    } else {
      duplicateCount++;
      const existingCs = deriveContentStatus(existing);
      const incomingCs = deriveContentStatus(decision);
      const winner = strengthOf(incomingCs) > strengthOf(existingCs) ? decision : existing;
      const loser = winner === decision ? existing : decision;

      // Merge provenance arrays
      const winnerProv: DecisionSourceProvenance[] = winner.provenance ?? [];
      const loserProv: DecisionSourceProvenance[] = loser.provenance ?? [];
      const mergedProvenance = [...winnerProv, ...loserProv];

      const mergedDecision: CourtDecision = {
        ...winner,
        provenance: mergedProvenance,
        contentStatus: chooseStrongestContentStatus([existingCs, incomingCs])
      };

      keyMap.set(key, mergedDecision);

      const matchReason = key.startsWith("doc::")
        ? `documentId match: ${key.slice(5)}`
        : `court+meritsNumber+decisionNumber match: ${key}`;

      mergedPairsLog.push({
        kept: winner.id,
        absorbed: loser.id,
        matchReason
      });
    }
  }

  const merged = [...keyMap.values(), ...noKeyDecisions];

  return {
    merged,
    duplicateCount,
    uniqueCount: merged.length,
    mergedPairsLog
  };
}

// ──────────────────────────────────────────────────────────────
// buildProvenanceMetrics
// ──────────────────────────────────────────────────────────────

/**
 * Build aggregate provenance metrics from a list of CourtDecisions.
 * Can be called before or after mergeDuplicateDecisions — caller decides.
 */
export function buildProvenanceMetrics(decisions: CourtDecision[]): ProvenanceMetrics {
  const contentStatusDistribution: Record<string, number> = {};
  const fetchStatusDistribution: Record<string, number> = {};
  const provenanceSourceDistribution: Record<string, number> = {};
  const perSourceFetchStatusDistribution: Record<string, Record<string, number>> = {};

  let quoteUsableCount = 0;
  let quoteUnusableCount = 0;
  let metadataOnlyDecisionCount = 0;
  let pdfLinkOnlyDecisionCount = 0;
  let unavailableDecisionCount = 0;
  let mergedDecisionCount = 0;

  for (const decision of decisions) {
    const cs = deriveContentStatus(decision);
    contentStatusDistribution[cs] = (contentStatusDistribution[cs] ?? 0) + 1;

    if (cs === "metadata_only") metadataOnlyDecisionCount++;
    if (cs === "pdf_link_only") pdfLinkOnlyDecisionCount++;
    if (cs === "unavailable") unavailableDecisionCount++;

    const quoteOk = decision.quoteUsable ?? isQuoteUsable(decision);
    if (quoteOk) quoteUsableCount++;
    else quoteUnusableCount++;

    const provArr: DecisionSourceProvenance[] = decision.provenance ?? [];
    if (provArr.length > 1) mergedDecisionCount++;

    for (const prov of provArr) {
      const src = prov.source;
      provenanceSourceDistribution[src] = (provenanceSourceDistribution[src] ?? 0) + 1;

      const fs = prov.fetchStatus;
      fetchStatusDistribution[fs] = (fetchStatusDistribution[fs] ?? 0) + 1;

      if (!perSourceFetchStatusDistribution[src]) {
        perSourceFetchStatusDistribution[src] = {};
      }
      perSourceFetchStatusDistribution[src][fs] = (perSourceFetchStatusDistribution[src][fs] ?? 0) + 1;
    }
  }

  return {
    totalDecisions: decisions.length,
    uniqueDecisions: decisions.length,
    duplicateDecisionCount: 0, // caller should pass post-merge list and pre-merge count separately
    mergedDecisionCount,
    provenanceSourceDistribution,
    contentStatusDistribution,
    fetchStatusDistribution,
    quoteUsableCount,
    quoteUnusableCount,
    metadataOnlyDecisionCount,
    pdfLinkOnlyDecisionCount,
    unavailableDecisionCount,
    perSourceFetchStatusDistribution
  };
}
