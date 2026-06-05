/**
 * T47.2 — Reciprocal Rank Fusion (RRF) for multi-signal ranking.
 *
 * Pure function: takes ranked lists from different signals,
 * fuses them via 1/(k+rank) scoring. Deterministic, no
 * score normalization needed. Ported from emsal-mcp RRF pattern.
 *
 * @param rankedLists - Array of signal rankings (each is an item ID list, best first)
 * @param k - Constant (default 60, standard RRF value)
 * @returns Sorted list of item IDs by RRF score (highest first)
 */
export function rrfFuse(rankedLists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const current = scores.get(item) ?? 0;
      scores.set(item, current + 1 / (k + rank + 1));
    }
  }

  return [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([item]) => item);
}

/**
 * Create a ranked list from scored items.
 * @param items - Array of {id, score} pairs
 * @param descending - true if higher score = better
 */
export function toRankedList(
  items: { id: string; score: number }[],
  descending = true
): string[] {
  return [...items]
    .sort((a, b) => descending ? b.score - a.score : a.score - b.score)
    .map((i) => i.id);
}

/**
 * T47.3 — Recency score with half-life decay.
 * 5-year half-life: score = 1 / (1 + (ageYears / 5))
 * Recent decisions (0 years) → score ≈ 1.0
 * 5 years old → score ≈ 0.5
 * 10 years → score ≈ 0.33
 */
export function computeRecencyScore(
  decisionDate: string | null | undefined,
  referenceYear?: number
): number {
  if (!decisionDate) return 0.5; // neutral for unknown dates
  const year = parseInt(decisionDate.slice(0, 4), 10);
  if (isNaN(year)) return 0.5;
  const refYear = referenceYear ?? new Date().getFullYear();
  const ageYears = Math.max(0, refYear - year);
  return 1 / (1 + ageYears / 5);
}

/**
 * T47.3 — Quote-safe boost: if decision is precedent_usable
 * and has full text / reasoning, give a boost.
 */
export function computeQuoteSafeBoost(
  isUsable: boolean,
  hasReasoning: boolean
): number {
  if (isUsable && hasReasoning) return 1.5;
  if (isUsable) return 1.2;
  return 1.0;
}
