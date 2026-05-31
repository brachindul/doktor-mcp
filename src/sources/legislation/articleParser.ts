export type ArticleStatus = "in_force" | "repealed" | "amended";

export interface ExtractedArticle {
  articleNumber: string;
  text: string;
  articleStatus: ArticleStatus;
}

const MIN_ARTICLE_LENGTH = 25;

const REPEALED_PATTERN = /\(\s*M[üu]lga\s*[:;]/i;
const AMENDED_PATTERN = /\(\s*De[ğg]i[sş]ik\s*[:;]/i;

function detectArticleStatus(text: string): ArticleStatus {
  // If any amendment marker appears, mark as amended.
  if (AMENDED_PATTERN.test(text)) {
    return "amended";
  }
  // If a repeal marker appears, check whether the article still has substantive text
  // outside the marker. A "real word" heuristic: at least one word of 4+ letters
  // outside the marker means the article still carries active legal text → amended.
  const repealMatch = text.match(REPEALED_PATTERN);
  if (repealMatch) {
    const beforeRepeal = text.slice(0, repealMatch.index ?? 0).trim();
    const afterRepeal = text.slice((repealMatch.index ?? 0) + repealMatch[0].length).trim();
    const outside = (beforeRepeal + " " + afterRepeal).replace(/\s+/g, " ").trim();
    // Require at least one real word (4+ letters) outside the marker for "amended"
    const hasRealWord = /\b[a-zçğıöşü]{4,}\b/i.test(outside);
    if (hasRealWord) {
      return "amended";
    }
    return "repealed";
  }
  return "in_force";
}

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
    const text = trimNextArticleHeading(cleaned.slice(start, end).trim());

    return {
      articleNumber: match[1],
      text,
      articleStatus: detectArticleStatus(text)
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
