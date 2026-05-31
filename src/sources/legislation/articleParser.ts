export interface ExtractedArticle {
  articleNumber: string;
  text: string;
}

const MIN_ARTICLE_LENGTH = 25;

const FOOTER_PATTERNS = [
  /Eki için tıklayınız\./i,
  /Yönetmeliğin\s+Yayımlandığı\s+Resm[iî]\s*Gazete/i,
  /Yönetmelikte\s+Değişiklik\s+Yapan\s+Yönetmeliklerin\s+Yayımlandığı\s+Resm[iî]\s*Gazetelerin/i,
  /Kanunun\s+Yayımlandığı\s+Resm[iî]\s*Gazete/i,
  /Yönetmeliğin\s+Yayınlandığı\s+Düstur/i,
  /Yönetmeliğin\s+Yayınlandığı\s+Resm[iî]\s*Gazete/i,
];

function stripTrailingMetadata(text: string): string {
  // Find the earliest footer pattern match and cut from there
  let cutIndex = text.length;
  for (const pattern of FOOTER_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }
  return text.slice(0, cutIndex).trimEnd();
}

function removePageMarkers(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n?--\s*\d+\s+of\s+\d+\s*--\n?/g, "\n")
    .replace(/^[ \t]+$/gm, "")
    .replace(/_{3,}/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function extractArticlesFromOfficialText(text: string): ExtractedArticle[] {
  let cleaned = removePageMarkers(text);
  cleaned = stripTrailingMetadata(cleaned);
  cleaned = cleaned.replace(/[ \t]+\n/g, "\n").trim();

  const articleMarker = /^\s*MADDE\s+(\d+[A-Za-z]?)\s*[-–—:]\s*/gim;
  const matches = [...cleaned.matchAll(articleMarker)];

  const articles = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? cleaned.length;

    return {
      articleNumber: match[1],
      text: trimNextArticleHeading(cleaned.slice(start, end).trim())
    };
  });

  // Filter out empty or fragment articles
  return articles.filter((a) => a.text.length >= MIN_ARTICLE_LENGTH);
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
