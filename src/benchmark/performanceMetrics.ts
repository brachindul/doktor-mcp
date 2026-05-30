import type { QueryAttemptTelemetry } from "../contracts/queryTelemetry.js";
import { computePercentile, computeAverage } from "../contracts/queryTelemetry.js";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface RunLatencyMetrics {
  durationMs: number;
  queryAttempts: number;
  networkRequests: number;
  cacheHitCount: number;
  cacheMissCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  avgMs: number | null;
  totalRetries: number;
  totalBackoffMs: number;
}

export interface SourceColdWarmMetrics {
  source: string;
  coldAttempts: number;
  warmAttempts: number;
  coldNetworkRequests: number;
  warmNetworkRequests: number;
  coldCacheHits: number;
  warmCacheHits: number;
  coldAvgMs: number | null;
  warmAvgMs: number | null;
  coldP95Ms: number | null;
  warmP95Ms: number | null;
  improvementPercent: number | null;
}

export interface SlowQueryEntry {
  rank: number;
  source: string;
  issueProfile: string;
  queryType: string;
  queryText: string;
  durationMs: number;
  resultCount: number;
  usableCandidateCount: number;
  cacheHit: boolean;
  retryCount: number;
  servedFromCache: boolean;
  sourceUnavailable: boolean;
  errorCode: string | null;
}

export interface RetryBackoffSummary {
  totalRetries: number;
  attemptsWithRetry: number;
  totalBackoffMs: number;
  retryAfterObservedCount: number;
  timeoutCount: number;
  rateLimitObservedCount: number;
  sourceUnavailableCount: number;
  networkErrorCount: number;
}

export interface CacheEffectivenessMetrics {
  totalAttempts: number;
  cacheHitCount: number;
  cacheMissCount: number;
  hitRatePercent: number | null;
  avgCacheAgeMs: number | null;
  servedFromCacheCount: number;
  networkRequestCount: number;
}

export interface PerformanceBenchmarkReport {
  timestamp: string;
  coldRunStartedAt: string;
  coldRunCompletedAt: string;
  warmRunStartedAt: string;
  warmRunCompletedAt: string;
  coldDurationMs: number;
  warmDurationMs: number;
  improvementPercent: number | null;
  cold: RunLatencyMetrics;
  warm: RunLatencyMetrics;
  sourceComparison: SourceColdWarmMetrics[];
  topSlowQueries: SlowQueryEntry[];
  coldCacheEffectiveness: CacheEffectivenessMetrics;
  warmCacheEffectiveness: CacheEffectivenessMetrics;
  retryBackoffSummary: RetryBackoffSummary;
  performanceWarnings: string[];
}

// ─── Pure computation functions ─────────────────────────────────────────────

export function buildRunLatencyMetrics(
  durationMs: number,
  telemetry: QueryAttemptTelemetry[]
): RunLatencyMetrics {
  const durations = telemetry.map((t) => t.durationMs).sort((a, b) => a - b);
  return {
    durationMs,
    queryAttempts: telemetry.length,
    networkRequests: telemetry.filter((t) => t.networkRequestMade).length,
    cacheHitCount: telemetry.filter((t) => t.cacheHit).length,
    cacheMissCount: telemetry.filter((t) => t.cacheMiss).length,
    p50Ms: computePercentile(durations, 50),
    p95Ms: computePercentile(durations, 95),
    p99Ms: computePercentile(durations, 99),
    avgMs: computeAverage(durations),
    totalRetries: telemetry.reduce((s, t) => s + (t.retryCount ?? 0), 0),
    totalBackoffMs: telemetry.reduce((s, t) => s + (t.backoffMs ?? 0), 0)
  };
}

export function buildImprovementPercent(coldMs: number, warmMs: number): number | null {
  if (coldMs <= 0) return null;
  return Math.round(((coldMs - warmMs) / coldMs) * 10000) / 100;
}

export function buildSourceColdWarmMetrics(
  coldTelemetry: QueryAttemptTelemetry[],
  warmTelemetry: QueryAttemptTelemetry[]
): SourceColdWarmMetrics[] {
  const sources = [...new Set([
    ...coldTelemetry.map((t) => t.source),
    ...warmTelemetry.map((t) => t.source)
  ])];

  return sources.map((source) => {
    const cold = coldTelemetry.filter((t) => t.source === source);
    const warm = warmTelemetry.filter((t) => t.source === source);
    const coldDurations = cold.map((t) => t.durationMs).sort((a, b) => a - b);
    const warmDurations = warm.map((t) => t.durationMs).sort((a, b) => a - b);

    const coldAvgMs = computeAverage(coldDurations);
    const warmAvgMs = computeAverage(warmDurations);
    const improvement = coldAvgMs !== null && warmAvgMs !== null
      ? buildImprovementPercent(coldAvgMs, warmAvgMs)
      : null;

    return {
      source,
      coldAttempts: cold.length,
      warmAttempts: warm.length,
      coldNetworkRequests: cold.filter((t) => t.networkRequestMade).length,
      warmNetworkRequests: warm.filter((t) => t.networkRequestMade).length,
      coldCacheHits: cold.filter((t) => t.cacheHit).length,
      warmCacheHits: warm.filter((t) => t.cacheHit).length,
      coldAvgMs,
      warmAvgMs,
      coldP95Ms: computePercentile(coldDurations, 95),
      warmP95Ms: computePercentile(warmDurations, 95),
      improvementPercent: improvement
    };
  });
}

export function buildSlowQueryDiagnostics(
  telemetry: QueryAttemptTelemetry[],
  topN = 10
): SlowQueryEntry[] {
  return [...telemetry]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, topN)
    .map((t, i) => ({
      rank: i + 1,
      source: t.source,
      issueProfile: t.issueProfile,
      queryType: t.queryType,
      queryText: t.queryText,
      durationMs: t.durationMs,
      resultCount: t.resultCount,
      usableCandidateCount: t.usableCandidateCount,
      cacheHit: t.cacheHit,
      retryCount: t.retryCount,
      servedFromCache: t.servedFromCache,
      sourceUnavailable: t.sourceUnavailable,
      errorCode: t.errorCode ?? null
    }));
}

export function buildRetryBackoffSummary(telemetry: QueryAttemptTelemetry[]): RetryBackoffSummary {
  return {
    totalRetries: telemetry.reduce((s, t) => s + (t.retryCount ?? 0), 0),
    attemptsWithRetry: telemetry.filter((t) => (t.retryCount ?? 0) > 0).length,
    totalBackoffMs: telemetry.reduce((s, t) => s + (t.backoffMs ?? 0), 0),
    retryAfterObservedCount: telemetry.filter((t) => t.retryAfterMs !== null && t.retryAfterMs > 0).length,
    timeoutCount: telemetry.filter((t) => t.timedOut).length,
    rateLimitObservedCount: telemetry.filter((t) => t.errorCode === "source_blocked").length,
    sourceUnavailableCount: telemetry.filter((t) => t.sourceUnavailable).length,
    networkErrorCount: telemetry.filter((t) => t.errorCode === "source_error").length
  };
}

export function buildCacheEffectivenessMetrics(telemetry: QueryAttemptTelemetry[]): CacheEffectivenessMetrics {
  const hits = telemetry.filter((t) => t.cacheHit).length;
  const misses = telemetry.filter((t) => t.cacheMiss).length;
  const total = telemetry.length;
  const cacheAges = telemetry
    .filter((t) => t.cacheAgeMs !== null && t.cacheAgeMs >= 0)
    .map((t) => t.cacheAgeMs as number);

  return {
    totalAttempts: total,
    cacheHitCount: hits,
    cacheMissCount: misses,
    hitRatePercent: total > 0 ? Math.round((hits / total) * 10000) / 100 : null,
    avgCacheAgeMs: computeAverage(cacheAges),
    servedFromCacheCount: telemetry.filter((t) => t.servedFromCache).length,
    networkRequestCount: telemetry.filter((t) => t.networkRequestMade).length
  };
}

export function buildPerformanceWarnings(
  cold: RunLatencyMetrics,
  warm: RunLatencyMetrics,
  retryBackoff: RetryBackoffSummary
): string[] {
  const warnings: string[] = [];

  if (cold.p95Ms !== null && cold.p95Ms > 60_000) {
    warnings.push(`Cold run p95 is high: ${cold.p95Ms}ms. Consider increasing source timeout or reducing query count.`);
  }
  if (warm.p95Ms !== null && warm.p95Ms > 10_000) {
    warnings.push(`Warm run p95 is still high (${warm.p95Ms}ms). Cache may not be fully effective for slow queries.`);
  }
  if (warm.cacheHitCount === 0 && cold.queryAttempts > 0) {
    warnings.push("Warm run produced zero cache hits. Cache may not be enabled or TTL may have expired.");
  }
  if (cold.durationMs > 0 && warm.durationMs >= cold.durationMs * 0.9) {
    warnings.push("Warm run is not meaningfully faster than cold run. Cache effectiveness may be limited.");
  }
  if (retryBackoff.totalRetries > 5) {
    warnings.push(`High retry count: ${retryBackoff.totalRetries} total retries. Source may be throttling.`);
  }
  if (retryBackoff.sourceUnavailableCount > 0) {
    warnings.push(`${retryBackoff.sourceUnavailableCount} query attempt(s) hit source_unavailable. Check source availability.`);
  }

  return warnings;
}

export function buildPerformanceBenchmarkReport(input: {
  timestamp: string;
  coldRunStartedAt: string;
  coldRunCompletedAt: string;
  warmRunStartedAt: string;
  warmRunCompletedAt: string;
  coldDurationMs: number;
  warmDurationMs: number;
  coldTelemetry: QueryAttemptTelemetry[];
  warmTelemetry: QueryAttemptTelemetry[];
}): PerformanceBenchmarkReport {
  const cold = buildRunLatencyMetrics(input.coldDurationMs, input.coldTelemetry);
  const warm = buildRunLatencyMetrics(input.warmDurationMs, input.warmTelemetry);
  const improvementPercent = buildImprovementPercent(input.coldDurationMs, input.warmDurationMs);
  const sourceComparison = buildSourceColdWarmMetrics(input.coldTelemetry, input.warmTelemetry);
  const allTelemetry = [...input.coldTelemetry, ...input.warmTelemetry];
  const topSlowQueries = buildSlowQueryDiagnostics(allTelemetry, 10);
  const retryBackoffSummary = buildRetryBackoffSummary(allTelemetry);
  const coldCacheEffectiveness = buildCacheEffectivenessMetrics(input.coldTelemetry);
  const warmCacheEffectiveness = buildCacheEffectivenessMetrics(input.warmTelemetry);
  const performanceWarnings = buildPerformanceWarnings(cold, warm, retryBackoffSummary);

  return {
    timestamp: input.timestamp,
    coldRunStartedAt: input.coldRunStartedAt,
    coldRunCompletedAt: input.coldRunCompletedAt,
    warmRunStartedAt: input.warmRunStartedAt,
    warmRunCompletedAt: input.warmRunCompletedAt,
    coldDurationMs: input.coldDurationMs,
    warmDurationMs: input.warmDurationMs,
    improvementPercent,
    cold,
    warm,
    sourceComparison,
    topSlowQueries,
    coldCacheEffectiveness,
    warmCacheEffectiveness,
    retryBackoffSummary,
    performanceWarnings
  };
}

export function generatePerformanceMarkdownReport(report: PerformanceBenchmarkReport): string {
  const fmt = (ms: number | null) => ms === null ? "N/A" : `${ms.toLocaleString()}ms`;
  const pct = (p: number | null) => p === null ? "N/A" : `${p > 0 ? "+" : ""}${p}%`;

  const lines: string[] = [
    `# Live Performance Benchmark Report`,
    ``,
    `**Generated:** ${report.timestamp}`,
    ``,
    `---`,
    ``,
    `## Overall Cold vs Warm Summary`,
    ``,
    `| Metric | Cold Run | Warm Run | Δ |`,
    `|---|---|---|---|`,
    `| Total Duration | ${fmt(report.coldDurationMs)} | ${fmt(report.warmDurationMs)} | ${pct(report.improvementPercent)} |`,
    `| Query Attempts | ${report.cold.queryAttempts} | ${report.warm.queryAttempts} | — |`,
    `| Network Requests | ${report.cold.networkRequests} | ${report.warm.networkRequests} | — |`,
    `| Cache Hits | ${report.cold.cacheHitCount} | ${report.warm.cacheHitCount} | — |`,
    `| Cache Misses | ${report.cold.cacheMissCount} | ${report.warm.cacheMissCount} | — |`,
    `| p50 Query Latency | ${fmt(report.cold.p50Ms)} | ${fmt(report.warm.p50Ms)} | — |`,
    `| p95 Query Latency | ${fmt(report.cold.p95Ms)} | ${fmt(report.warm.p95Ms)} | — |`,
    `| p99 Query Latency | ${fmt(report.cold.p99Ms)} | ${fmt(report.warm.p99Ms)} | — |`,
    `| Avg Query Latency | ${fmt(report.cold.avgMs)} | ${fmt(report.warm.avgMs)} | — |`,
    `| Total Retries | ${report.cold.totalRetries} | ${report.warm.totalRetries} | — |`,
    `| Total Backoff | ${fmt(report.cold.totalBackoffMs)} | ${fmt(report.warm.totalBackoffMs)} | — |`,
    ``,
    `---`,
    ``,
    `## Source Performance`,
    ``,
    `| Source | Cold Avg | Warm Avg | Improvement | Cold p95 | Warm p95 | Cold Net | Warm Net | Cold Hits | Warm Hits |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
    ...report.sourceComparison.map((s) =>
      `| ${s.source} | ${fmt(s.coldAvgMs)} | ${fmt(s.warmAvgMs)} | ${pct(s.improvementPercent)} | ${fmt(s.coldP95Ms)} | ${fmt(s.warmP95Ms)} | ${s.coldNetworkRequests} | ${s.warmNetworkRequests} | ${s.coldCacheHits} | ${s.warmCacheHits} |`
    ),
    ``,
    `---`,
    ``,
    `## Cache Effectiveness`,
    ``,
    `| Metric | Cold Run | Warm Run |`,
    `|---|---|---|`,
    `| Hit Rate | ${report.coldCacheEffectiveness.hitRatePercent ?? 0}% | ${report.warmCacheEffectiveness.hitRatePercent ?? 0}% |`,
    `| Cache Hits | ${report.coldCacheEffectiveness.cacheHitCount} | ${report.warmCacheEffectiveness.cacheHitCount} |`,
    `| Cache Misses | ${report.coldCacheEffectiveness.cacheMissCount} | ${report.warmCacheEffectiveness.cacheMissCount} |`,
    `| Served From Cache | ${report.coldCacheEffectiveness.servedFromCacheCount} | ${report.warmCacheEffectiveness.servedFromCacheCount} |`,
    `| Network Requests | ${report.coldCacheEffectiveness.networkRequestCount} | ${report.warmCacheEffectiveness.networkRequestCount} |`,
    `| Avg Cache Age | ${fmt(report.coldCacheEffectiveness.avgCacheAgeMs)} | ${fmt(report.warmCacheEffectiveness.avgCacheAgeMs)} |`,
    ``,
    `---`,
    ``,
    `## Retry / Backoff Summary`,
    ``,
    `| Metric | Count |`,
    `|---|---|`,
    `| Total Retries | ${report.retryBackoffSummary.totalRetries} |`,
    `| Attempts With Retry | ${report.retryBackoffSummary.attemptsWithRetry} |`,
    `| Total Backoff Time | ${fmt(report.retryBackoffSummary.totalBackoffMs)} |`,
    `| Retry-After Headers Observed | ${report.retryBackoffSummary.retryAfterObservedCount} |`,
    `| Timeout Count | ${report.retryBackoffSummary.timeoutCount} |`,
    `| Rate Limit Events | ${report.retryBackoffSummary.rateLimitObservedCount} |`,
    `| Source Unavailable Count | ${report.retryBackoffSummary.sourceUnavailableCount} |`,
    `| Network Error Count | ${report.retryBackoffSummary.networkErrorCount} |`,
    ``,
    `---`,
    ``,
    `## Slowest Query Attempts (Combined Cold + Warm)`,
    ``,
    `| # | Source | Profile | Type | Duration | Results | Usable | Cache | Retries | Unavailable |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
    ...report.topSlowQueries.map((q) =>
      `| ${q.rank} | ${q.source} | ${q.issueProfile} | ${q.queryType} | ${fmt(q.durationMs)} | ${q.resultCount} | ${q.usableCandidateCount} | ${q.cacheHit ? "HIT" : q.servedFromCache ? "SERVED" : "MISS"} | ${q.retryCount} | ${q.sourceUnavailable ? "YES" : "no"} |`
    ),
    ``,
    `---`,
    ``,
    `## Performance Warnings`,
    ``,
    ...(report.performanceWarnings.length === 0
      ? ["_No performance warnings. Latency and cache behaviour within expected ranges._"]
      : report.performanceWarnings.map((w) => `- ⚠️ ${w}`)),
    ``,
    `---`,
    ``,
    `## Tuning Notes`,
    ``,
    `- Cold run p95 > 60s → consider Bedesten/Danıştay timeout guard`,
    `- Warm run p95 > 10s → cache TTL may have expired mid-run; increase TTL for large benchmarks`,
    `- 0 warm cache hits → ensure \`--performance\` mode uses a shared cache with sufficient TTL`,
    `- High retry count → source may be throttling; check rate limiter settings`,
    ``,
    `---`,
    ``,
    `*Report generated by doktor-mcp performance benchmark.*`
  ];

  return lines.join("\n");
}
