import type { FilteredPrecedent } from "../contracts/legal.js";
import { assessPrecedentRelevance } from "./precedentRelevance.js";

export interface RerankResult {
  preRerankTopId: string | null;
  postRerankTopId: string | null;
  rerankChangedSelection: boolean;
  usableCount: number;
}

/**
 * Reranks the usable (precedent_usable) entries in `filtered` by issue relevance score
 * before the final verified-precedent selection step.
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

  const scored = usable.map((entry, originalIndex) => ({
    entry,
    relevanceScore: assessPrecedentRelevance(question, entry.decision).score,
    originalIndex
  }));

  // Stable descending sort: higher score first, ties keep original order
  scored.sort((a, b) =>
    b.relevanceScore !== a.relevanceScore
      ? b.relevanceScore - a.relevanceScore
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
