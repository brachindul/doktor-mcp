import type { PrecedentSource } from "./legal.js";

export type QueryType = "primary" | "issue_profile" | "fallback" | "broad" | "source_specific";

export interface QueryAttemptTelemetry {
  source: PrecedentSource;
  issueProfile: string;
  queryText: string;
  queryType: QueryType;
  queryRank: number;
  startedAt: string;
  durationMs: number;
  success: boolean;
  resultCount: number;
  candidateCount: number;
  usableCandidateCount: number;
  sourceUnavailable: boolean;
  errorCode?: string;
  // Cache telemetry (populated when adapter has PrecedentCache wired)
  cacheHit: boolean;
  cacheMiss: boolean;
  servedFromCache: boolean;
  networkRequestMade: boolean;
  cacheAgeMs: number | null;
  // HTTP retry/backoff telemetry
  retryCount: number;
  backoffMs: number;
  retryAfterMs: number | null;
  timedOut: boolean;
}

/** Telemetry emitted by an adapter after each cache lookup or network attempt. */
export interface AdapterRequestTelemetry {
  cacheHit: boolean;
  cacheMiss: boolean;
  servedFromCache: boolean;
  networkRequestMade: boolean;
  cacheAgeMs: number | null;
  retryCount: number;
  backoffMs: number;
  retryAfterMs: number | null;
  timedOut: boolean;
}

export function defaultAdapterRequestTelemetry(): AdapterRequestTelemetry {
  return {
    cacheHit: false,
    cacheMiss: false,
    servedFromCache: false,
    networkRequestMade: true,
    cacheAgeMs: null,
    retryCount: 0,
    backoffMs: 0,
    retryAfterMs: null,
    timedOut: false
  };
}

export interface QuerySessionSummary {
  source: PrecedentSource;
  issueProfile: string;
  attempts: QueryAttemptTelemetry[];
  fallbackUsed: boolean;
  fallbackAttemptCount: number;
  firstSuccessfulQueryText: string | null;
  wastedQueryCount: number;
  noResultQueryCount: number;
  totalDurationMs: number;
}

export interface SourceReliabilityMetrics {
  source: string;
  attempts: number;
  successes: number;
  failures: number;
  unavailableCount: number;
  avgDurationMs: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  verifiedPrecedentsProduced: number;
  averageRelevance: number | null;
}

export interface IssueProfileReliabilityMetrics {
  issueProfile: string;
  attempts: number;
  verifiedPrecedentsProduced: number;
  fallbackUsedCount: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  averageRelevance: number | null;
  weakRelevanceCount: number;
}

export function computePercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? null;
}

export function computeAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function buildSessionSummary(
  source: PrecedentSource,
  issueProfile: string,
  attempts: QueryAttemptTelemetry[]
): QuerySessionSummary {
  const sorted = [...attempts].sort((a, b) => a.queryRank - b.queryRank);
  const firstSuccess = sorted.find((a) => a.success);
  const fallbackAttempts = sorted.filter((a) => a.queryRank > 1 && a.success);
  const noResultAttempts = sorted.filter((a) => !a.sourceUnavailable && !a.success && a.resultCount === 0);
  const wastedAttempts = sorted.filter((a) => a.queryRank > 1 && !a.success);
  return {
    source,
    issueProfile,
    attempts: sorted,
    fallbackUsed: fallbackAttempts.length > 0,
    fallbackAttemptCount: sorted.filter((a) => a.queryRank > 1).length,
    firstSuccessfulQueryText: firstSuccess?.queryText ?? null,
    wastedQueryCount: wastedAttempts.length,
    noResultQueryCount: noResultAttempts.length,
    totalDurationMs: sorted.reduce((sum, a) => sum + a.durationMs, 0)
  };
}
