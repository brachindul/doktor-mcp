import type { FilteredPrecedent } from "../contracts/legal.js";
import { assessPrecedentRelevance } from "./precedentRelevance.js";
import { readConfig } from "../core/runtimeConfig.js";
import { rrfFuse, toRankedList } from "./precedentRrf.js";
import { tokenize, computeLexicalScore } from "./lexicalRerank.js";

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
  const minYear = config.minDecisionYear;

  // T48.1: Build RRF signal lists from relevance, recency, and lexical scores
  const idList = usable.map((e) => e.decision.id);

  // Signal 1: Issue relevance scores
  const relevanceScored = usable.map((e) => ({
    id: e.decision.id,
    score: assessPrecedentRelevance(question, e.decision).score
  }));
  const relevanceRanked = toRankedList(relevanceScored);

  // Signal 2: Recency scores
  const recencyScored = usable.map((e) => {
    const year = extractYear(e.decision.decisionDate);
    const recency = (year !== null && year >= minYear)
      ? 1 / (1 + Math.max(0, refYear - year) / 5) // 5-year half-life
      : 0.3;
    return { id: e.decision.id, score: recency * config.weight };
  });
  const recencyRanked = toRankedList(recencyScored);

  // Signal 3: Lexical overlap (T48.3) — compute per decision text vs question
  const queryTokens = tokenize(question);
  const allDocTokens = usable.map((e) => tokenize(
    (e.decision.factSummary ?? "") + " " + (e.decision.legalReasoning ?? "")
  ));
  const lexicalScored = usable.map((e, i) => ({
    id: e.decision.id,
    score: computeLexicalScore(queryTokens, allDocTokens[i], allDocTokens) * 3 // scale to ~relevance range
  }));
  const lexicalRanked = toRankedList(lexicalScored);

  // RRF fusion of all 3 signals
  const fusedOrder = rrfFuse([relevanceRanked, recencyRanked, lexicalRanked]);

  // Reorder usable entries according to RRF fused order
  const fusionMap = new Map(fusedOrder.map((id, rank) => [id, rank]));
  const scored = usable.map((entry, originalIndex) => ({
    entry,
    combinedScore: -(fusionMap.get(entry.decision.id) ?? usable.length), // lower rank = higher score
    originalIndex
  }));

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
