import type { FilteredPrecedent } from "../contracts/legal.js";
import { assessPrecedentRelevance } from "./precedentRelevance.js";
import { readConfig } from "../core/runtimeConfig.js";

export interface RerankResult {
  preRerankTopId: string | null;
  postRerankTopId: string | null;
  rerankChangedSelection: boolean;
  usableCount: number;
}

/** Extract a 4-digit year from an ISO-like date string. Returns null if unparseable. */
function extractYear(dateString: string | undefined): number | null {
  if (!dateString) return null;
  const match = dateString.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

/** Compute a recency score in [0, 1] based on decision year vs reference year.
 *  Decisions from the reference year get 1.0; linear decay back to 0 over `decayYears`.
 */
function computeRecencyScore(decisionYear: number, referenceYear: number, decayYears = 20): number {
  const delta = referenceYear - decisionYear;
  if (delta <= 0) return 1.0;
  return Math.max(0, 1 - delta / decayYears);
}

/**
 * Reranks the usable (precedent_usable) entries in `filtered` by a combined score
 * of issue relevance + recency (weighted by runtime config).
 *
 * Safety guarantees:
 * - Only `precedent_usable` entries are reranked.
 * - Non-usable entries are kept in their original positions after the usable block.
 * - A decision whose eligibility is NOT `precedent_usable` cannot be promoted by reranking.
 * - Same-score decisions retain their original relative order (stable sort).
 *
 * Returns the reranked array alongside a RerankResult that describes the effect.
 */
export function rerankByIssueRelevance(
  filtered: FilteredPrecedent[],
  question: string
): { reranked: FilteredPrecedent[]; rerankResult: RerankResult } {
  const usable = filtered.filter((e) => e.status === "precedent_usable");
  const nonUsable = filtered.filter((e) => e.status !== "precedent_usable");

  const preRerankTopId = usable[0]?.decision.id ?? null;

  if (usable.length <= 1) {
    return {
      reranked: filtered,
      rerankResult: {
        preRerankTopId,
        postRerankTopId: preRerankTopId,
        rerankChangedSelection: false,
        usableCount: usable.length
      }
    };
  }

  const config = readConfig().precedentRecency;
  const refYear = config.referenceYear;
  const recencyWeight = config.weight;
  const minYear = config.minDecisionYear;

  const scored = usable.map((entry, originalIndex) => {
    const relevanceScore = assessPrecedentRelevance(question, entry.decision).score;
    const decisionYear = extractYear(entry.decision.decisionDate);
    let recencyScore = 0;
    if (decisionYear !== null && decisionYear >= minYear) {
      recencyScore = computeRecencyScore(decisionYear, refYear);
    }
    // Combined score: relevance is integer 0-5, recency is float 0-1
    const combinedScore = relevanceScore + recencyScore * recencyWeight * 5;
    return {
      entry,
      combinedScore,
      originalIndex
    };
  });

  // Stable descending sort: higher combined score first, ties keep original order
  scored.sort((a, b) =>
    b.combinedScore !== a.combinedScore
      ? b.combinedScore - a.combinedScore
      : a.originalIndex - b.originalIndex
  );

  const rerankedUsable = scored.map((s) => s.entry);
  const postRerankTopId = rerankedUsable[0]?.decision.id ?? null;

  return {
    reranked: [...rerankedUsable, ...nonUsable],
    rerankResult: {
      preRerankTopId,
      postRerankTopId,
      rerankChangedSelection: preRerankTopId !== postRerankTopId,
      usableCount: usable.length
    }
  };
}
