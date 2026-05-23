import { describe, expect, it } from "vitest";
import {
  buildRunLatencyMetrics,
  buildImprovementPercent,
  buildSourceColdWarmMetrics,
  buildSlowQueryDiagnostics,
  buildRetryBackoffSummary,
  buildCacheEffectivenessMetrics,
  buildPerformanceWarnings,
  buildPerformanceBenchmarkReport
} from "../src/benchmark/performanceMetrics.js";
import type { QueryAttemptTelemetry } from "../src/contracts/queryTelemetry.js";

function makeTelemetry(overrides: Partial<QueryAttemptTelemetry> = {}): QueryAttemptTelemetry {
  return {
    source: "yargitay",
    issueProfile: "informed_consent",
    queryText: "aydınlatılmış rıza",
    queryType: "issue_profile",
    queryRank: 1,
    startedAt: "2024-01-01T00:00:00.000Z",
    durationMs: 500,
    success: true,
    resultCount: 3,
    candidateCount: 2,
    usableCandidateCount: 1,
    sourceUnavailable: false,
    cacheHit: false,
    cacheMiss: true,
    servedFromCache: false,
    networkRequestMade: true,
    cacheAgeMs: null,
    retryCount: 0,
    backoffMs: 0,
    retryAfterMs: null,
    timedOut: false,
    ...overrides
  };
}

// ── buildImprovementPercent ──────────────────────────────────────────────────

describe("buildImprovementPercent", () => {
  it("returns null when coldMs is 0", () => {
    expect(buildImprovementPercent(0, 100)).toBeNull();
  });

  it("returns 50.00 when warm is half of cold", () => {
    expect(buildImprovementPercent(1000, 500)).toBe(50);
  });

  it("returns 0.00 when cold and warm are equal", () => {
    expect(buildImprovementPercent(1000, 1000)).toBe(0);
  });

  it("returns negative value when warm is slower than cold", () => {
    const result = buildImprovementPercent(1000, 1500);
    expect(result).toBeLessThan(0);
  });

  it("rounds to two decimal places", () => {
    // 1000→333: improvement = (1000-333)/1000 = 66.7%
    const result = buildImprovementPercent(1000, 333);
    expect(result).toBeCloseTo(66.7, 1);
  });
});

// ── buildRunLatencyMetrics ───────────────────────────────────────────────────

describe("buildRunLatencyMetrics", () => {
  it("returns zero/null for empty telemetry", () => {
    const m = buildRunLatencyMetrics(5000, []);
    expect(m.queryAttempts).toBe(0);
    expect(m.p50Ms).toBeNull();
    expect(m.p95Ms).toBeNull();
    expect(m.cacheHitCount).toBe(0);
    expect(m.networkRequests).toBe(0);
  });

  it("counts network requests correctly", () => {
    const t = [
      makeTelemetry({ networkRequestMade: true }),
      makeTelemetry({ networkRequestMade: false, cacheHit: true, servedFromCache: true })
    ];
    const m = buildRunLatencyMetrics(1000, t);
    expect(m.networkRequests).toBe(1);
    expect(m.cacheHitCount).toBe(1);
  });

  it("sums totalRetries and totalBackoffMs", () => {
    const t = [
      makeTelemetry({ retryCount: 2, backoffMs: 1000 }),
      makeTelemetry({ retryCount: 1, backoffMs: 500 })
    ];
    const m = buildRunLatencyMetrics(2000, t);
    expect(m.totalRetries).toBe(3);
    expect(m.totalBackoffMs).toBe(1500);
  });

  it("computes correct p50 from known durations", () => {
    const t = [100, 200, 300, 400, 500].map((ms) => makeTelemetry({ durationMs: ms }));
    const m = buildRunLatencyMetrics(5000, t);
    expect(m.p50Ms).toBe(300);
  });

  it("preserves durationMs field from input", () => {
    const m = buildRunLatencyMetrics(99_000, [makeTelemetry()]);
    expect(m.durationMs).toBe(99_000);
  });
});

// ── buildSourceColdWarmMetrics ───────────────────────────────────────────────

describe("buildSourceColdWarmMetrics", () => {
  it("returns one entry per unique source across cold and warm", () => {
    const cold = [makeTelemetry({ source: "yargitay" }), makeTelemetry({ source: "danistay" })];
    const warm = [makeTelemetry({ source: "yargitay" }), makeTelemetry({ source: "danistay" })];
    const result = buildSourceColdWarmMetrics(cold, warm);
    const sources = result.map((r) => r.source).sort();
    expect(sources).toContain("yargitay");
    expect(sources).toContain("danistay");
  });

  it("warmCacheHits count is correct", () => {
    const cold = [makeTelemetry({ source: "yargitay", cacheHit: false })];
    const warm = [
      makeTelemetry({ source: "yargitay", cacheHit: true, servedFromCache: true, networkRequestMade: false }),
      makeTelemetry({ source: "yargitay", cacheHit: true, servedFromCache: true, networkRequestMade: false })
    ];
    const result = buildSourceColdWarmMetrics(cold, warm);
    const y = result.find((r) => r.source === "yargitay")!;
    expect(y.warmCacheHits).toBe(2);
    expect(y.coldCacheHits).toBe(0);
  });

  it("improvementPercent is null when coldAvgMs is 0", () => {
    const cold = [makeTelemetry({ source: "yargitay", durationMs: 0 })];
    const warm = [makeTelemetry({ source: "yargitay", durationMs: 100 })];
    const result = buildSourceColdWarmMetrics(cold, warm);
    const y = result.find((r) => r.source === "yargitay")!;
    expect(y.improvementPercent).toBeNull();
  });
});

// ── buildSlowQueryDiagnostics ────────────────────────────────────────────────

describe("buildSlowQueryDiagnostics", () => {
  it("returns at most topN entries", () => {
    const t = Array.from({ length: 15 }, (_, i) => makeTelemetry({ durationMs: i * 100 }));
    const result = buildSlowQueryDiagnostics(t, 10);
    expect(result).toHaveLength(10);
  });

  it("sorts by durationMs descending", () => {
    const t = [
      makeTelemetry({ durationMs: 100 }),
      makeTelemetry({ durationMs: 5000 }),
      makeTelemetry({ durationMs: 300 })
    ];
    const result = buildSlowQueryDiagnostics(t, 3);
    expect(result[0]!.durationMs).toBe(5000);
    expect(result[1]!.durationMs).toBe(300);
    expect(result[2]!.durationMs).toBe(100);
  });

  it("rank starts at 1", () => {
    const result = buildSlowQueryDiagnostics([makeTelemetry()], 1);
    expect(result[0]!.rank).toBe(1);
  });

  it("errorCode is null when not set", () => {
    const result = buildSlowQueryDiagnostics([makeTelemetry()], 1);
    expect(result[0]!.errorCode).toBeNull();
  });

  it("errorCode is populated from telemetry", () => {
    const t = makeTelemetry({ errorCode: "source_blocked", sourceUnavailable: true });
    const result = buildSlowQueryDiagnostics([t], 1);
    expect(result[0]!.errorCode).toBe("source_blocked");
    expect(result[0]!.sourceUnavailable).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(buildSlowQueryDiagnostics([], 10)).toHaveLength(0);
  });
});

// ── buildRetryBackoffSummary ─────────────────────────────────────────────────

describe("buildRetryBackoffSummary", () => {
  it("returns zeros for empty telemetry", () => {
    const s = buildRetryBackoffSummary([]);
    expect(s.totalRetries).toBe(0);
    expect(s.attemptsWithRetry).toBe(0);
    expect(s.totalBackoffMs).toBe(0);
    expect(s.sourceUnavailableCount).toBe(0);
  });

  it("counts attemptsWithRetry correctly", () => {
    const t = [
      makeTelemetry({ retryCount: 0 }),
      makeTelemetry({ retryCount: 2 }),
      makeTelemetry({ retryCount: 1 })
    ];
    const s = buildRetryBackoffSummary(t);
    expect(s.attemptsWithRetry).toBe(2);
    expect(s.totalRetries).toBe(3);
  });

  it("counts rateLimitObservedCount from errorCode source_blocked", () => {
    const t = [
      makeTelemetry({ errorCode: "source_blocked", sourceUnavailable: true }),
      makeTelemetry({ errorCode: "source_error", sourceUnavailable: true }),
      makeTelemetry()
    ];
    const s = buildRetryBackoffSummary(t);
    expect(s.rateLimitObservedCount).toBe(1);
    expect(s.networkErrorCount).toBe(1);
    expect(s.sourceUnavailableCount).toBe(2);
  });

  it("counts timeoutCount from timedOut flag", () => {
    const t = [
      makeTelemetry({ timedOut: true }),
      makeTelemetry({ timedOut: false })
    ];
    const s = buildRetryBackoffSummary(t);
    expect(s.timeoutCount).toBe(1);
  });

  it("counts retryAfterObservedCount from non-null retryAfterMs", () => {
    const t = [
      makeTelemetry({ retryAfterMs: 5000 }),
      makeTelemetry({ retryAfterMs: null }),
      makeTelemetry({ retryAfterMs: 0 }) // 0 does not count
    ];
    const s = buildRetryBackoffSummary(t);
    expect(s.retryAfterObservedCount).toBe(1);
  });
});

// ── buildCacheEffectivenessMetrics ───────────────────────────────────────────

describe("buildCacheEffectivenessMetrics", () => {
  it("returns null hitRatePercent for empty telemetry", () => {
    const m = buildCacheEffectivenessMetrics([]);
    expect(m.hitRatePercent).toBeNull();
    expect(m.totalAttempts).toBe(0);
  });

  it("hitRatePercent is 0 when no cache hits", () => {
    const t = [makeTelemetry({ cacheHit: false, cacheMiss: true })];
    const m = buildCacheEffectivenessMetrics(t);
    expect(m.hitRatePercent).toBe(0);
  });

  it("hitRatePercent is 100 when all attempts are cache hits", () => {
    const t = [
      makeTelemetry({ cacheHit: true, cacheMiss: false, servedFromCache: true, networkRequestMade: false }),
      makeTelemetry({ cacheHit: true, cacheMiss: false, servedFromCache: true, networkRequestMade: false })
    ];
    const m = buildCacheEffectivenessMetrics(t);
    expect(m.hitRatePercent).toBe(100);
    expect(m.servedFromCacheCount).toBe(2);
    expect(m.networkRequestCount).toBe(0);
  });

  it("avgCacheAgeMs computed from cacheAgeMs fields", () => {
    const t = [
      makeTelemetry({ cacheHit: true, cacheAgeMs: 1000 }),
      makeTelemetry({ cacheHit: true, cacheAgeMs: 3000 })
    ];
    const m = buildCacheEffectivenessMetrics(t);
    expect(m.avgCacheAgeMs).toBe(2000);
  });

  it("null cacheAgeMs values are excluded from average", () => {
    const t = [
      makeTelemetry({ cacheHit: true, cacheAgeMs: 2000 }),
      makeTelemetry({ cacheHit: false, cacheAgeMs: null })
    ];
    const m = buildCacheEffectivenessMetrics(t);
    expect(m.avgCacheAgeMs).toBe(2000);
  });
});

// ── buildPerformanceWarnings ─────────────────────────────────────────────────

describe("buildPerformanceWarnings", () => {
  const baseRun = (overrides = {}) => ({
    durationMs: 30_000, queryAttempts: 10, networkRequests: 10,
    cacheHitCount: 0, cacheMissCount: 10, p50Ms: 500, p95Ms: 2000, p99Ms: 5000,
    avgMs: 800, totalRetries: 0, totalBackoffMs: 0, ...overrides
  });

  const baseRetry = () => ({
    totalRetries: 0, attemptsWithRetry: 0, totalBackoffMs: 0,
    retryAfterObservedCount: 0, timeoutCount: 0, rateLimitObservedCount: 0,
    sourceUnavailableCount: 0, networkErrorCount: 0
  });

  it("returns no critical warnings when all metrics are within range", () => {
    // warm run with cache hits, p95 under 10s, clearly faster than cold
    const cold = baseRun({ durationMs: 30_000, p95Ms: 2000 });
    const warm = baseRun({ durationMs: 1_000, cacheHitCount: 5, p95Ms: 300 });
    const warnings = buildPerformanceWarnings(cold, warm, baseRetry());
    // Should have no "0 cache hits", no "p95 too high", no "not faster" warnings
    expect(warnings.some((w) => w.includes("cache hit"))).toBe(false);
    expect(warnings.some((w) => w.includes("not meaningfully faster"))).toBe(false);
  });

  it("warns when cold p95 exceeds 60s", () => {
    const cold = baseRun({ p95Ms: 70_000 });
    const warm = baseRun({ cacheHitCount: 5, p95Ms: 1000 });
    const warnings = buildPerformanceWarnings(cold, warm, baseRetry());
    expect(warnings.some((w) => w.includes("p95"))).toBe(true);
  });

  it("warns when warm run has zero cache hits", () => {
    const cold = baseRun();
    const warm = baseRun({ cacheHitCount: 0 });
    const warnings = buildPerformanceWarnings(cold, warm, baseRetry());
    expect(warnings.some((w) => w.includes("cache hit"))).toBe(true);
  });

  it("warns when warm is not faster than cold", () => {
    const cold = baseRun({ durationMs: 1000 });
    const warm = baseRun({ durationMs: 1000, cacheHitCount: 5 });
    const warnings = buildPerformanceWarnings(cold, warm, baseRetry());
    expect(warnings.some((w) => w.includes("faster"))).toBe(true);
  });

  it("warns on high retry count", () => {
    const cold = baseRun();
    const warm = baseRun({ cacheHitCount: 5 });
    const retry = { ...baseRetry(), totalRetries: 10 };
    const warnings = buildPerformanceWarnings(cold, warm, retry);
    expect(warnings.some((w) => w.includes("retry"))).toBe(true);
  });
});

// ── buildPerformanceBenchmarkReport (integration of pure functions) ──────────

describe("buildPerformanceBenchmarkReport", () => {
  const now = "2026-05-23T10:00:00.000Z";

  function makeInput(coldT: QueryAttemptTelemetry[], warmT: QueryAttemptTelemetry[]) {
    return {
      timestamp: now,
      coldRunStartedAt: now,
      coldRunCompletedAt: now,
      warmRunStartedAt: now,
      warmRunCompletedAt: now,
      coldDurationMs: 5000,
      warmDurationMs: 1000,
      coldTelemetry: coldT,
      warmTelemetry: warmT
    };
  }

  it("improvementPercent is 80 when warm is 5x faster", () => {
    const report = buildPerformanceBenchmarkReport(makeInput([makeTelemetry()], [makeTelemetry()]));
    expect(report.improvementPercent).toBe(80);
  });

  it("topSlowQueries contains at most 10 entries", () => {
    const t = Array.from({ length: 20 }, () => makeTelemetry());
    const report = buildPerformanceBenchmarkReport(makeInput(t, t));
    expect(report.topSlowQueries.length).toBeLessThanOrEqual(10);
  });

  it("JSON is serializable without undefined values", () => {
    const coldT = [makeTelemetry({ cacheHit: false, cacheMiss: true })];
    const warmT = [makeTelemetry({ cacheHit: true, servedFromCache: true, networkRequestMade: false, cacheAgeMs: 500 })];
    const report = buildPerformanceBenchmarkReport(makeInput(coldT, warmT));
    const json = JSON.stringify(report);
    expect(json).not.toContain("undefined");
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("cold and warm cache effectiveness reflect different telemetry", () => {
    const coldT = [makeTelemetry({ cacheHit: false, cacheMiss: true, networkRequestMade: true })];
    const warmT = [makeTelemetry({ cacheHit: true, servedFromCache: true, networkRequestMade: false, cacheAgeMs: 1000 })];
    const report = buildPerformanceBenchmarkReport(makeInput(coldT, warmT));
    expect(report.coldCacheEffectiveness.cacheHitCount).toBe(0);
    expect(report.warmCacheEffectiveness.cacheHitCount).toBe(1);
    expect(report.warmCacheEffectiveness.networkRequestCount).toBe(0);
  });

  it("retryBackoffSummary covers combined cold and warm telemetry", () => {
    const coldT = [makeTelemetry({ retryCount: 1, backoffMs: 250 })];
    const warmT = [makeTelemetry({ retryCount: 0, backoffMs: 0 })];
    const report = buildPerformanceBenchmarkReport(makeInput(coldT, warmT));
    expect(report.retryBackoffSummary.totalRetries).toBe(1);
    expect(report.retryBackoffSummary.totalBackoffMs).toBe(250);
  });

  it("missing cache telemetry fields default to JSON-safe values", () => {
    // Simulate older telemetry without cache fields — they should still serialize cleanly
    const t = makeTelemetry();
    const report = buildPerformanceBenchmarkReport(makeInput([t], [t]));
    const json = JSON.parse(JSON.stringify(report));
    expect(json.coldCacheEffectiveness.hitRatePercent).toBeDefined();
  });
});
