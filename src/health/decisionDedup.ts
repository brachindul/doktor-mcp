import type { CourtDecision } from "../contracts/legal.js";

/**
 * Build a deduplication key for a court decision.
 * Uses document/case identifiers that are likely shared across sources
 * (e.g. same Yargitay case returned by both Yargitay and Bedesten adapters).
 */
export function buildDecisionKey(decision: CourtDecision): string {
  const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

  // Prefer the pre-computed normalizedDecisionKey if present
  if (decision.normalizedDecisionKey) return `nkey:${normalize(decision.normalizedDecisionKey)}`;

  // Use evidence.documentId as a strong cross-source signal
  if (decision.evidence?.documentId) return `docid:${normalize(decision.evidence.documentId)}`;

  // Combine meritsNumber + decisionNumber as a case-level key
  const merits = decision.meritsNumber ? normalize(decision.meritsNumber) : "";
  const decisionNo = decision.decisionNumber ? normalize(decision.decisionNumber) : "";
  if (merits || decisionNo) return `case:${merits}/${decisionNo}/${normalize(decision.court)}`;

  // Fallback: court + date
  const date = decision.decisionDate ?? "";
  return `fallback:${normalize(decision.court)}/${date}`;
}

/**
 * Score the richness of a decision (higher = more complete).
 * Prefers decisions with full text and reasoning.
 */
export function decisionRichnessScore(decision: CourtDecision): number {
  let score = 0;
  if (decision.fullText && decision.fullText.length > 100) score += 3;
  if (decision.legalReasoning && decision.legalReasoning.length > 50) score += 2;
  if (decision.factSummary && decision.factSummary.length > 20) score += 1;
  if (decision.evidence?.sourceUrl) score += 1; // has official URL
  return score;
}

export interface DedupResult {
  /** The deduplicated list with richest decision kept. */
  decisions: CourtDecision[];
  /** Number of duplicates removed. */
  dedupedCount: number;
}

/**
 * Deduplicate decisions by key, keeping the richest version.
 * When the same case appears from multiple sources (e.g. Yargitay and Bedesten),
 * the decision with the richest content (full text + reasoning) is retained.
 */
export function deduplicateDecisions(decisions: CourtDecision[]): DedupResult {
  const seen = new Map<string, { decision: CourtDecision; score: number }>();

  for (const decision of decisions) {
    const key = buildDecisionKey(decision);
    const score = decisionRichnessScore(decision);

    const existing = seen.get(key);
    if (existing) {
      if (score > existing.score) {
        seen.set(key, { decision, score });
      }
      // else: keep existing richer version — this duplicate is dropped
    } else {
      seen.set(key, { decision, score });
    }
  }

  const result = Array.from(seen.values()).map((v) => v.decision);
  const dedupedCount = decisions.length - result.length;

  return { decisions: result, dedupedCount };
}
