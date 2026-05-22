export interface ExtractedArticle {
  articleNumber: string;
  text: string;
}

export function extractArticlesFromOfficialText(text: string): ExtractedArticle[] {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\n-- \d+ of \d+ --\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n");
  const articleMarker = /^\s*MADDE\s+(\d+[A-Za-z]?)\s*[-–—:]\s*/gim;
  const matches = [...cleaned.matchAll(articleMarker)];

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? cleaned.length;

    return {
      articleNumber: match[1],
      text: trimNextArticleHeading(cleaned.slice(start, end).trim())
    };
  });
}

function trimNextArticleHeading(text: string) {
  const lines = text.split("\n");
  const last = lines.at(-1)?.trim() ?? "";
  const previous = lines.at(-2)?.trim() ?? "";

  if (last && previous.endsWith(".") && !/[.;:)]$/.test(last)) {
    return lines.slice(0, -1).join("\n").trim();
  }

  return text;
}
