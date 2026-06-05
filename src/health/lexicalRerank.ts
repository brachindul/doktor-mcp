/**
 * T47.4 — Light lexical rerank (no persistent corpus/index).
 *
 * Simple Turkish-aware tokenization + BM25-like lexical overlap scoring.
 * Only runs on the live result set for a single query — no stored embeddings,
 * no persistent indices.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-zçğıöşü0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/**
 * Compute lexical overlap score between query tokens and document tokens.
 * Uses a simple TF-IDF-like approach: term frequency in doc weighted by
 * inverse prevalence in the result set (IDF approximation).
 */
export function computeLexicalScore(
  queryTokens: string[],
  docTokens: string[],
  allTokens: string[][]
): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  const totalDocs = allTokens.length || 1;

  // Compute IDF-like weights per query token
  const idf = new Map<string, number>();
  for (const qt of queryTokens) {
    const df = allTokens.filter((dt) => dt.includes(qt)).length;
    idf.set(qt, Math.log(1 + totalDocs / (df || 1)));
  }

  // Score = sum over query tokens of (tf_in_doc * idf)
  let score = 0;
  for (const qt of queryTokens) {
    const tf = docTokens.filter((t) => t === qt).length;
    score += tf * (idf.get(qt) ?? 0);
  }

  return score / Math.max(1, docTokens.length); // normalize by doc length
}
