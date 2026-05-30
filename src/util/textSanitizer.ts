/**
 * Strip HTML tags and decode entities from raw text.
 * Safe for use on physician-facing output.
 */
export function stripHtmlToText(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // 1. Decode common HTML entities BEFORE stripping tags
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&#039;/gi, "'");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#34;/gi, '"');
  // General numeric entities
  text = text.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
  // Named hex entities
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  // 2. Strip all HTML tags (including self-closing)
  text = text.replace(/<[^>]*>/g, " ");

  // 3. Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  // 4. Remove leading/trailing punctuation artifacts
  text = text.replace(/^[',;:\s]+/, "");
  text = text.replace(/[',;:\s]+$/, "");

  return text;
}

/**
 * Truncate text to a maximum length, breaking at a sentence boundary if possible.
 * Appends ellipsis if truncated.
 */
export function truncateForDisplay(text: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;

  // Try to break at the last sentence-ending punctuation before maxLen
  const truncated = text.slice(0, maxLen);
  const lastPunct = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?")
  );

  if (lastPunct > maxLen / 2) {
    return truncated.slice(0, lastPunct + 1).trim();
  }

  // Fallback: break at last space
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.7) {
    return truncated.slice(0, lastSpace).trim() + "\u2026";
  }

  return truncated.trim() + "\u2026";
}
