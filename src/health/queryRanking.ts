import type { ClassifiedMedicalLegalQuestion, PrecedentSource } from "../contracts/legal.js";
import type { QueryType } from "../contracts/queryTelemetry.js";
import { inferIssueProfileFromQuestion, suggestedQueriesForQuestion } from "./precedentRelevance.js";
import { pickHealthLawQueries } from "./healthLawQueryExpansion.js";
import type { IssueProfile } from "./precedentRelevance.js";

export interface RankedQuery {
  queryText: string;
  queryType: QueryType;
  rank: number;
}

/**
 * Affinity score per issue profile per source.
 * 3 = primary source for this profile (query first, most likely to yield relevant results)
 * 2 = secondary source (also capable, query after primary)
 * 1 = tertiary / low affinity (unlikely to have specific results; skip in strict mode)
 */
const SOURCE_AFFINITIES: Record<IssueProfile, Record<PrecedentSource, number>> = {
  informed_consent:         { yargitay: 3, danistay: 1, aym: 1, bedesten: 3 },
  malpractice_complication: { yargitay: 3, danistay: 1, aym: 1, bedesten: 3 },
  emergency_care:           { yargitay: 2, danistay: 2, aym: 1, bedesten: 2 },
  treatment_refusal:        { yargitay: 2, danistay: 2, aym: 1, bedesten: 2 },
  privacy_records:          { yargitay: 2, danistay: 2, aym: 2, bedesten: 2 },
  psychiatric_privacy:      { yargitay: 2, danistay: 1, aym: 2, bedesten: 2 },
  violence_threat:          { yargitay: 3, danistay: 1, aym: 1, bedesten: 3 },
  referral_consultation:    { yargitay: 2, danistay: 2, aym: 1, bedesten: 2 },
  private_hospital_fee:     { yargitay: 3, danistay: 1, aym: 1, bedesten: 3 },
  public_discipline:        { yargitay: 1, danistay: 3, aym: 2, bedesten: 1 },
  intensive_care:           { yargitay: 2, danistay: 2, aym: 1, bedesten: 2 },
  pregnancy_emergency:      { yargitay: 3, danistay: 1, aym: 1, bedesten: 3 }
};

/** Returns the affinity score (1–3) for a given issue profile + source combination. */
export function getSourceAffinity(issueProfile: IssueProfile, source: PrecedentSource): number {
  return SOURCE_AFFINITIES[issueProfile]?.[source] ?? 1;
}

/** Returns true when this source is the primary (affinity=3) source for the given profile. */
export function isPrimarySourceForProfile(issueProfile: IssueProfile, source: PrecedentSource): boolean {
  return getSourceAffinity(issueProfile, source) >= 3;
}

/**
 * Returns an ordered list of queries to try for a specific source and issue profile.
 * Issue-profile queries come first (most targeted), then expansion fallbacks.
 * Deduplicates across all slots. Returns at most `maxQueries` entries.
 */
export function rankedQueriesForSource(
  _issueProfile: IssueProfile,
  _source: PrecedentSource,
  classification: ClassifiedMedicalLegalQuestion,
  maxQueries = 2
): RankedQuery[] {
  const seen = new Set<string>();
  const result: RankedQuery[] = [];

  const issueQueries = suggestedQueriesForQuestion(classification.question, maxQueries);
  for (const q of issueQueries) {
    if (!seen.has(q)) {
      seen.add(q);
      result.push({ queryText: q, queryType: "issue_profile", rank: result.length + 1 });
    }
  }

  const expansionQueries = pickHealthLawQueries(classification, maxQueries);
  for (const q of expansionQueries) {
    if (!seen.has(q)) {
      seen.add(q);
      result.push({ queryText: q, queryType: "fallback", rank: result.length + 1 });
    }
  }

  if (result.length === 0) {
    result.push({ queryText: classification.question, queryType: "broad", rank: 1 });
  }

  return result.slice(0, maxQueries);
}

/** Infers the issue profile from the question and returns ranked queries for the source. */
export function rankedQueriesForSourceFromQuestion(
  question: string,
  source: PrecedentSource,
  classification: ClassifiedMedicalLegalQuestion,
  maxQueries = 2
): { issueProfile: IssueProfile; affinity: number; queries: RankedQuery[] } {
  const issueProfile = inferIssueProfileFromQuestion(question);
  const affinity = getSourceAffinity(issueProfile, source);
  const queries = rankedQueriesForSource(issueProfile, source, classification, maxQueries);
  return { issueProfile, affinity, queries };
}
