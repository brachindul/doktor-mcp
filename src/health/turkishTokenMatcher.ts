/**
 * Turkish-aware token matching infrastructure.
 *
 * Provides character folding, tokenisation, and configurable term matching
 * so that `String.includes()` false positives (e.g. "veri" inside "verilen")
 * can be avoided.
 */

// ── Character folding ────────────────────────────────────────────────────────

const FOLD_MAP: Record<string, string> = {
  ı: "i",
  İ: "i",
  I: "i",
  ş: "s",
  Ş: "s",
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ö: "o",
  Ö: "o",
  ü: "u",
  Ü: "u",
};

/** Turkish-to-ASCII character folding for case/diacritic-insensitive matching. */
export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .split("")
    .map((ch) => FOLD_MAP[ch] ?? ch)
    .join("");
}

// ── Tokenisation ─────────────────────────────────────────────────────────────

/** Convert text to lowercase Turkish and split by non-letter characters. */
export function tokenizeTr(text: string): string[] {
  const lower = text.toLocaleLowerCase("tr-TR");
  const tokens = lower.split(/[^\p{L}]+/u).filter(Boolean);
  return tokens;
}

// ── Term-rule matching ───────────────────────────────────────────────────────

export interface TermRule {
  term: string;
  matchMode: "token" | "prefix" | "substring";
  blockedPrefixes?: string[];
  allowedTokens?: string[];
}

/**
 * Valid Turkish suffix consonants + vowels.
 * After stripping a term prefix the remaining part must be ≤ 5 chars and start
 * with one of these characters to be considered a valid suffix continuation.
 */
const VALID_SUFFIX_START = new Set(
  "aeıioöuünsydtlmk".split(""),
);

/**
 * Check whether `tokens` match `term` according to the given mode.
 *
 * - **"token"**: any folded token equals folded term OR starts with folded term
 *   followed by a valid Turkish suffix (≤ 5 chars).  When `allowedTokens` is
 *   provided, a match on any folded allowed token short-circuits to `true`.
 *   When `blockedPrefixes` is provided, a match on any folded blocked prefix
 *   short-circuits to `false` (after allowedTokens have been checked).
 *
 * - **"prefix"**: any folded token starts with the folded term.
 *
 * - **"substring"**: the full original text (passed as `fullText` parameter or
 *   as `tokens[0]`) contains the folded term (for multi-word terms).
 *
 * @param tokens          Array of folded tokens (use `tokenizeTr` + `foldTr`).
 * @param term            The term to look for (plain string).
 * @param mode            Matching strategy.
 * @param blockedPrefixes Optional folded prefixes that must NOT match.
 * @param allowedTokens   Optional folded tokens that always match (checked first).
 * @param fullText        Optional full folded text for substring mode. When
 *                        provided, this is used instead of `tokens[0]`.
 */
export function matchesTermTr(
  tokens: string[],
  term: string,
  mode: "token" | "prefix" | "substring",
  blockedPrefixes?: string[],
  allowedTokens?: string[],
  fullText?: string,
): boolean {
  const foldedTerm = foldTr(term);

  // ── substring mode (uses full original text) ─────────────────────────────
  if (mode === "substring") {
    // Use fullText parameter if provided, otherwise fall back to tokens[0]
    const haystack = fullText ?? (tokens.length > 0 ? tokens[0] : "");
    return haystack.includes(foldedTerm);
  }

  // ── allowed / blocked pre-checks (token & prefix modes) ──────────────────
  const foldedBlocked = blockedPrefixes?.map(foldTr) ?? [];
  const foldedAllowed = allowedTokens?.map(foldTr) ?? [];

  for (const token of tokens) {
    // 1. allowedTokens short-circuit
    if (foldedAllowed.length > 0) {
      for (const allowed of foldedAllowed) {
        if (token === allowed) return true;
      }
    }
  }

  if (mode === "prefix") {
    for (const token of tokens) {
      if (token.startsWith(foldedTerm)) return true;
    }
    return false;
  }

  // ── token mode ────────────────────────────────────────────────────────────
  // blockedPrefixes checked per-token (after allowed check already passed)
  for (const token of tokens) {
    // blocked prefixes (checked last per token)
    let blocked = false;
    for (const bp of foldedBlocked) {
      if (token.startsWith(bp)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // exact match
    if (token === foldedTerm) return true;

    // prefix + valid suffix
    if (token.startsWith(foldedTerm) && token.length > foldedTerm.length) {
      const suffix = token.slice(foldedTerm.length);
      if (suffix.length <= 5 && VALID_SUFFIX_START.has(suffix[0])) {
        return true;
      }
    }
  }

  return false;
}
