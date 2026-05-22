import type { ProvisionRanking } from "../../contracts/legal.js";
import type { ExtractedArticle } from "./articleParser.js";
import type { HealthLegislationHint } from "./liveTypes.js";

export const PROVISION_RANKING_METHOD = "deterministic-health-provision-ranking-v1";
export const MAX_RANKED_PROVISIONS_PER_LEGISLATION = 3;

export interface RankedExtractedArticle {
  article: ExtractedArticle;
  ranking: ProvisionRanking;
}

export interface ProvisionRankingResult {
  selected: RankedExtractedArticle[];
  ranked: RankedExtractedArticle[];
  rejected: RankedExtractedArticle[];
}

export function rankExtractedArticles(
  query: string,
  hint: HealthLegislationHint,
  articles: ExtractedArticle[],
  limit = MAX_RANKED_PROVISIONS_PER_LEGISLATION
): ProvisionRankingResult {
  const ranked = articles
    .map((article) => ({ article, ranking: rankArticle(query, hint, article) }))
    .sort(compareRankedArticles);
  const rankedMappedArticles = ranked.filter(({ ranking }) => ranking.fromMappedArticleList);
  const eligible = rankedMappedArticles.length > 0
    ? rankedMappedArticles
    : ranked.filter(({ ranking }) => ranking.score >= 80);
  const selected = eligible.slice(0, limit);

  return {
    selected,
    ranked,
    rejected: ranked.filter((candidate) => !selected.includes(candidate))
  };
}

export function rankArticle(query: string, hint: HealthLegislationHint, article: ExtractedArticle): ProvisionRanking {
  const normalizedText = normalize(article.text);
  const normalizedHeading = normalize(articleHeading(article.text));
  const queryTerms = keywordCandidates(query);
  const mappingTerms = [...new Set(hint.terms.flatMap(keywordCandidates))];
  const matchedTerms = new Set<string>();
  const rankingReasons: string[] = [];
  let score = roleBonus(hint);

  if (score > 0) rankingReasons.push(`Legislation role ${hint.legislationRole} priority ${hint.healthLawPriority} retained ordering bonus.`);

  if (hint.articleNumbers.includes(article.articleNumber)) {
    score += 100;
    rankingReasons.push(`Article ${article.articleNumber} is in the mapped article list.`);
  }

  score += termScore("Query term", queryTerms, normalizedText, normalizedHeading, matchedTerms, rankingReasons, 14, 24);
  score += termScore("Mapping search term", mappingTerms, normalizedText, normalizedHeading, matchedTerms, rankingReasons, 6, 12);

  const topicTerms = topicClusterTerms(hint.topicCluster);
  score += termScore("Topic cluster term", topicTerms, normalizedText, normalizedHeading, matchedTerms, rankingReasons, 5, 10);

  if (rankingReasons.length === 0) {
    rankingReasons.push("No deterministic ranking signal matched this article.");
  }

  return {
    score,
    matchedTerms: [...matchedTerms],
    rankingReasons,
    fromMappedArticleList: hint.articleNumbers.includes(article.articleNumber)
  };
}

function termScore(
  label: string,
  terms: string[],
  normalizedText: string,
  normalizedHeading: string,
  matchedTerms: Set<string>,
  rankingReasons: string[],
  textPoints: number,
  headingPoints: number
) {
  let score = 0;

  for (const term of terms) {
    if (!term || matchedTerms.has(term)) continue;
    if (normalizedHeading.includes(term)) {
      score += headingPoints;
      matchedTerms.add(term);
      rankingReasons.push(`${label} "${term}" matched the article heading.`);
      continue;
    }

    if (normalizedText.includes(term)) {
      score += textPoints;
      matchedTerms.add(term);
      rankingReasons.push(`${label} "${term}" matched the article text.`);
    }
  }

  return score;
}

function compareRankedArticles(left: RankedExtractedArticle, right: RankedExtractedArticle) {
  return right.ranking.score - left.ranking.score ||
    Number(right.ranking.fromMappedArticleList) - Number(left.ranking.fromMappedArticleList) ||
    compareArticleNumbers(left.article.articleNumber, right.article.articleNumber);
}

function compareArticleNumbers(left: string, right: string) {
  return left.localeCompare(right, "tr-TR", { numeric: true });
}

function roleBonus(hint: HealthLegislationHint) {
  const role = hint.legislationRole === "health_primary" ? 8 : 2;
  return role + Math.max(0, 6 - Math.floor(hint.healthLawPriority / 20));
}

function keywordCandidates(value: string) {
  const normalized = normalize(value);
  const phrases = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 2);

  return [...new Set([
    normalized.trim(),
    ...phrases
  ].filter((term) => term.length > 2))];
}

function articleHeading(text: string) {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  return firstLine.split(/[.:;]/)[0] ?? firstLine;
}

function topicClusterTerms(topicCluster: HealthLegislationHint["topicCluster"]) {
  return keywordCandidates(topicCluster.replaceAll("_", " "));
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/g, "i");
}
