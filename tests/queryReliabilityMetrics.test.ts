import { describe, expect, it } from "vitest";
import {
  computePercentile,
  computeAverage,
  buildSessionSummary
} from "../src/contracts/queryTelemetry.js";
import type { QueryAttemptTelemetry } from "../src/contracts/queryTelemetry.js";
import {
  buildGlobalQueryMetrics,
  buildSourceReliabilityMetrics
} from "../src/benchmark/reliabilityMetrics.js";

function makeTelemetry(overrides: Partial<QueryAttemptTelemetry> = {}): QueryAttemptTelemetry {
  return {
    source: "yargitay",
    issueProfile: "informed_consent",
    queryText: "aydınlatılmış rıza",
    queryType: "issue_profile",
    queryRank: 1,
    startedAt: "2024-01-01T00:00:00.000Z",
    durationMs: 100,
    success: true,
    resultCount: 3,
    candidateCount: 2,
    usableCandidateCount: 1,
    sourceUnavailable: false,
    ...overrides
  };
}

describe("computePercentile", () => {
  it("returns null for empty array", () => {
    expect(computePercentile([], 50)).toBeNull();
  });

  it("returns the only value for single-element array at any percentile", () => {
    expect(computePercentile([42], 50)).toBe(42);
    expect(computePercentile([42], 95)).toBe(42);
  });

  it("returns correct p50 for [1,2,3,4,5]", () => {
    expect(computePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("returns last element for p100", () => {
    const arr = [10, 20, 30, 40, 50];
    expect(computePercentile(arr, 100)).toBe(50);
  });

  it("returns first element for p1 on small arrays", () => {
    const arr = [5, 10, 15];
    expect(computePercentile(arr, 1)).toBe(5);
  });

  it("returns deterministic result for p95 on known data", () => {
    const arr = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    // ceil(0.95 * 10) - 1 = ceil(9.5) - 1 = 10 - 1 = 9 → arr[9] = 1000
    expect(computePercentile(arr, 95)).toBe(1000);
  });
});

describe("computeAverage", () => {
  it("returns null for empty array", () => {
    expect(computeAverage([])).toBeNull();
  });

  it("returns the value for single-element array", () => {
    expect(computeAverage([100])).toBe(100);
  });

  it("returns rounded average", () => {
    expect(computeAverage([100, 200, 300])).toBe(200);
  });

  it("rounds to nearest integer", () => {
    expect(computeAverage([1, 2])).toBe(2); // 1.5 rounds to 2
  });
});

describe("buildSessionSummary", () => {
  it("fallbackUsed is false when only rank-1 query succeeds", () => {
    const attempts = [makeTelemetry({ queryRank: 1, success: true })];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.fallbackUsed).toBe(false);
    expect(summary.fallbackAttemptCount).toBe(0);
  });

  it("fallbackUsed is true when rank-2 query succeeds", () => {
    const attempts = [
      makeTelemetry({ queryRank: 1, success: false, resultCount: 0 }),
      makeTelemetry({ queryRank: 2, success: true, queryText: "fallback query", queryType: "fallback" })
    ];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.fallbackUsed).toBe(true);
    expect(summary.fallbackAttemptCount).toBe(1);
  });

  it("firstSuccessfulQueryText is null when no attempt succeeded", () => {
    const attempts = [
      makeTelemetry({ queryRank: 1, success: false, resultCount: 0 }),
      makeTelemetry({ queryRank: 2, success: false, resultCount: 0, queryType: "fallback" })
    ];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.firstSuccessfulQueryText).toBeNull();
  });

  it("firstSuccessfulQueryText is the rank-1 query when it succeeded", () => {
    const attempts = [makeTelemetry({ queryRank: 1, success: true, queryText: "primary query" })];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.firstSuccessfulQueryText).toBe("primary query");
  });

  it("noResultQueryCount counts non-unavailable failed queries", () => {
    const attempts = [
      makeTelemetry({ queryRank: 1, success: false, resultCount: 0, sourceUnavailable: false }),
      makeTelemetry({ queryRank: 2, success: false, resultCount: 0, sourceUnavailable: true, queryType: "fallback" })
    ];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    // Only the non-unavailable one counts
    expect(summary.noResultQueryCount).toBe(1);
  });

  it("wastedQueryCount counts rank>1 non-successful attempts", () => {
    const attempts = [
      makeTelemetry({ queryRank: 1, success: false, resultCount: 0 }),
      makeTelemetry({ queryRank: 2, success: false, resultCount: 0, queryType: "fallback" })
    ];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.wastedQueryCount).toBe(1);
  });

  it("totalDurationMs is the sum of all attempt durations", () => {
    const attempts = [
      makeTelemetry({ queryRank: 1, durationMs: 150 }),
      makeTelemetry({ queryRank: 2, durationMs: 200, queryType: "fallback" })
    ];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.totalDurationMs).toBe(350);
  });

  it("sorts attempts by queryRank in output regardless of input order", () => {
    const attempts = [
      makeTelemetry({ queryRank: 2, queryType: "fallback" }),
      makeTelemetry({ queryRank: 1 })
    ];
    const summary = buildSessionSummary("yargitay", "informed_consent", attempts);
    expect(summary.attempts[0]!.queryRank).toBe(1);
    expect(summary.attempts[1]!.queryRank).toBe(2);
  });
});

describe("buildGlobalQueryMetrics", () => {
  it("returns zeros/nulls for empty telemetry", () => {
    const metrics = buildGlobalQueryMetrics([]);
    expect(metrics.totalQueryAttempts).toBe(0);
    expect(metrics.averageQueryDurationMs).toBeNull();
    expect(metrics.p50QueryDurationMs).toBeNull();
    expect(metrics.p95QueryDurationMs).toBeNull();
  });

  it("counts successful, failed, and unavailable attempts", () => {
    const telemetry = [
      makeTelemetry({ success: true, sourceUnavailable: false }),
      makeTelemetry({ success: false, sourceUnavailable: false }),
      makeTelemetry({ success: false, sourceUnavailable: true })
    ];
    const metrics = buildGlobalQueryMetrics(telemetry);
    expect(metrics.totalQueryAttempts).toBe(3);
    expect(metrics.successfulQueryAttempts).toBe(1);
    expect(metrics.failedQueryAttempts).toBe(1);
    expect(metrics.sourceUnavailableAttempts).toBe(1);
  });

  it("computes p50 deterministically from known durations", () => {
    const telemetry = [100, 200, 300, 400, 500].map((ms) => makeTelemetry({ durationMs: ms }));
    const metrics = buildGlobalQueryMetrics(telemetry);
    expect(metrics.p50QueryDurationMs).toBe(300);
  });
});

describe("buildSourceReliabilityMetrics", () => {
  it("returns one entry per unique source", () => {
    const telemetry = [
      makeTelemetry({ source: "yargitay" }),
      makeTelemetry({ source: "danistay" }),
      makeTelemetry({ source: "yargitay" })
    ];
    const metrics = buildSourceReliabilityMetrics(telemetry, []);
    const sources = metrics.map((m) => m.source);
    expect(sources).toContain("yargitay");
    expect(sources).toContain("danistay");
    expect(sources).toHaveLength(2);
  });

  it("counts attempts per source correctly", () => {
    const telemetry = [
      makeTelemetry({ source: "yargitay" }),
      makeTelemetry({ source: "yargitay" }),
      makeTelemetry({ source: "danistay" })
    ];
    const metrics = buildSourceReliabilityMetrics(telemetry, []);
    const y = metrics.find((m) => m.source === "yargitay")!;
    const d = metrics.find((m) => m.source === "danistay")!;
    expect(y.attempts).toBe(2);
    expect(d.attempts).toBe(1);
  });

  it("unavailableCount only counts sourceUnavailable=true", () => {
    const telemetry = [
      makeTelemetry({ source: "yargitay", success: true, sourceUnavailable: false }),
      makeTelemetry({ source: "yargitay", success: false, sourceUnavailable: true })
    ];
    const metrics = buildSourceReliabilityMetrics(telemetry, []);
    const y = metrics.find((m) => m.source === "yargitay")!;
    expect(y.unavailableCount).toBe(1);
    expect(y.successes).toBe(1);
  });

  it("averageRelevance is null when no verified entries", () => {
    const telemetry = [makeTelemetry({ source: "yargitay" })];
    const metrics = buildSourceReliabilityMetrics(telemetry, []);
    const y = metrics.find((m) => m.source === "yargitay")!;
    expect(y.averageRelevance).toBeNull();
  });
});
