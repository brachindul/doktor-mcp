import type {
  QueryAttemptTelemetry,
  SourceReliabilityMetrics,
  IssueProfileReliabilityMetrics
} from "../contracts/queryTelemetry.js";
import {
  computePercentile,
  computeAverage
} from "../contracts/queryTelemetry.js";
import type { VerifiedPrecedentAuditEntry } from "./benchmarkRunner.js";

export function buildSourceReliabilityMetrics(
  allTelemetry: QueryAttemptTelemetry[],
  verifiedAuditEntries: Array<{ source: string | null; entry: VerifiedPrecedentAuditEntry }>
): SourceReliabilityMetrics[] {
  const sources = [...new Set(allTelemetry.map((t) => t.source))];

  return sources.map((source) => {
    const sourceTelemetry = allTelemetry.filter((t) => t.source === source);
    const successes = sourceTelemetry.filter((t) => t.success);
    const failures = sourceTelemetry.filter((t) => !t.success && !t.sourceUnavailable);
    const unavailable = sourceTelemetry.filter((t) => t.sourceUnavailable);
    const durations = sourceTelemetry.map((t) => t.durationMs).sort((a, b) => a - b);

    const sourceVerifiedEntries = verifiedAuditEntries.filter((v) =>
      (v.source ?? v.entry.court ?? "") === source
    );
    const relevanceScores = sourceVerifiedEntries
      .map((v) => v.entry.healthLawRelevanceScore)
      .filter((s): s is number => typeof s === "number");

    return {
      source,
      attempts: sourceTelemetry.length,
      successes: successes.length,
      failures: failures.length,
      unavailableCount: unavailable.length,
      avgDurationMs: computeAverage(durations),
      p50DurationMs: computePercentile(durations, 50),
      p95DurationMs: computePercentile(durations, 95),
      verifiedPrecedentsProduced: sourceVerifiedEntries.length,
      averageRelevance: relevanceScores.length > 0
        ? Math.round((relevanceScores.reduce((s, v) => s + v, 0) / relevanceScores.length) * 100) / 100
        : null
    };
  });
}

export function buildIssueProfileReliabilityMetrics(
  allTelemetry: QueryAttemptTelemetry[],
  itemResults: Array<{
    issueProfile: string;
    fallbackUsed: boolean;
    verifiedCount: number;
    queryTelemetry: QueryAttemptTelemetry[];
    weakRelevanceCount: number;
  }>
): IssueProfileReliabilityMetrics[] {
  const profiles = [...new Set(allTelemetry.map((t) => t.issueProfile))];

  return profiles.map((profile) => {
    const profileTelemetry = allTelemetry.filter((t) => t.issueProfile === profile);
    const durations = profileTelemetry.map((t) => t.durationMs).sort((a, b) => a - b);
    const profileItems = itemResults.filter((r) => r.issueProfile === profile);

    const allRelevanceScores: number[] = [];
    for (const item of profileItems) {
      for (const t of item.queryTelemetry) {
        if (t.issueProfile === profile) {
          // No per-attempt relevance; relevance is computed post-selection
          void t;
        }
      }
    }
    void allRelevanceScores; // Will be populated from verified entries when available

    return {
      issueProfile: profile,
      attempts: profileTelemetry.length,
      verifiedPrecedentsProduced: profileItems.reduce((sum, r) => sum + r.verifiedCount, 0),
      fallbackUsedCount: profileItems.filter((r) => r.fallbackUsed).length,
      avgDurationMs: computeAverage(durations),
      p95DurationMs: computePercentile(durations, 95),
      averageRelevance: null, // Populated by caller from verified audit entries
      weakRelevanceCount: profileItems.reduce((sum, r) => sum + r.weakRelevanceCount, 0)
    };
  });
}

export function buildGlobalQueryMetrics(allTelemetry: QueryAttemptTelemetry[]): {
  totalQueryAttempts: number;
  successfulQueryAttempts: number;
  failedQueryAttempts: number;
  sourceUnavailableAttempts: number;
  averageQueryDurationMs: number | null;
  p50QueryDurationMs: number | null;
  p95QueryDurationMs: number | null;
  p99QueryDurationMs: number | null;
} {
  const durations = allTelemetry.map((t) => t.durationMs).sort((a, b) => a - b);
  return {
    totalQueryAttempts: allTelemetry.length,
    successfulQueryAttempts: allTelemetry.filter((t) => t.success).length,
    failedQueryAttempts: allTelemetry.filter((t) => !t.success && !t.sourceUnavailable).length,
    sourceUnavailableAttempts: allTelemetry.filter((t) => t.sourceUnavailable).length,
    averageQueryDurationMs: computeAverage(durations),
    p50QueryDurationMs: computePercentile(durations, 50),
    p95QueryDurationMs: computePercentile(durations, 95),
    p99QueryDurationMs: computePercentile(durations, 99)
  };
}
