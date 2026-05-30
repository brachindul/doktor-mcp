/**
 * Tests for the extracted precedent phase executor.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchPrecedents,
  prioritizeSourcesByIssue
} from "../src/app/precedentPhase.js";
import type { ClassifiedMedicalLegalQuestion, PrecedentSource } from "../src/contracts/legal.js";
import type { PrecedentAdapters } from "../src/app/precedentPhase.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeClassification(question = "Hasta rızası nasıl alınır?"): ClassifiedMedicalLegalQuestion {
  return {
    question,
    dimensions: ["patient_rights"],
    searchTerms: ["hasta", "rıza"],
    missingInformation: []
 };
}

function makeMockAdapters(overrides: Partial<PrecedentAdapters> = {}): PrecedentAdapters {
  return {
    liveYargitay: {
      searchAndNormalize: vi.fn().mockResolvedValue({ status: "ok", decisions: [], searchResultsCount: 0 }),
      lastRequestTelemetry: { cacheHit: false, cacheMiss: false, servedFromCache: false, networkRequestMade: false, cacheAgeMs: null, retryCount: 0, backoffMs: 0, retryAfterMs: null, timedOut: false }
    } as never,
    liveDanistay: {
      searchAndNormalize: vi.fn().mockResolvedValue({ status: "ok", decisions: [], searchResultsCount: 0 }),
      lastRequestTelemetry: { cacheHit: false, cacheMiss: false, servedFromCache: false, networkRequestMade: false, cacheAgeMs: null, retryCount: 0, backoffMs: 0, retryAfterMs: null, timedOut: false }
    } as never,
    liveBedesten: {
      searchHealthPrecedents: vi.fn().mockResolvedValue([])
    } as never,
    mockAdapters: [
      { searchHealthPrecedents: vi.fn().mockResolvedValue([]) },
      { searchHealthPrecedents: vi.fn().mockResolvedValue([]) },
      { searchHealthPrecedents: vi.fn().mockResolvedValue([]) }
    ],
    ...overrides
  };
}

// ─── Tests: prioritizeSourcesByIssue ────────────────────────────────────────

describe("precedentPhase — prioritizeSourcesByIssue", () => {
  it("returns yargitay-first for default/generic issues", () => {
    const sources: PrecedentSource[] = ["yargitay", "danistay", "aym"];
    const result = prioritizeSourcesByIssue("informed_consent", sources);
    expect(result[0]).toBe("yargitay");
  });

  it("returns danistay-first for disciplinary/administrative issues", () => {
    const sources: PrecedentSource[] = ["yargitay", "danistay"];
    const result = prioritizeSourcesByIssue("disciplinary_administrative", sources);
    expect(result[0]).toBe("danistay");
  });

  it("returns danistay-first for administrative_liability issues", () => {
    const sources: PrecedentSource[] = ["yargitay", "danistay"];
    const result = prioritizeSourcesByIssue("administrative_liability", sources);
    expect(result[0]).toBe("danistay");
  });

  it("returns danistay-first for public_employment issues", () => {
    const sources: PrecedentSource[] = ["yargitay", "danistay", "aym"];
    const result = prioritizeSourcesByIssue("public_employment", sources);
    expect(result[0]).toBe("danistay");
  });

  it("does not mutate the input array", () => {
    const sources: PrecedentSource[] = ["yargitay", "danistay"];
    const original = [...sources];
    prioritizeSourcesByIssue("disciplinary_administrative", sources);
    expect(sources).toEqual(original);
  });

  it("returns all sources (same length as input)", () => {
    const sources: PrecedentSource[] = ["yargitay", "danistay", "aym"];
    const result = prioritizeSourcesByIssue("privacy_kvkk", sources);
    expect(result).toHaveLength(sources.length);
  });
});

// ─── Tests: searchPrecedents (mock mode) ────────────────────────────────────

describe("precedentPhase — searchPrecedents (mock mode)", () => {
  it("returns decisions from mock adapters", async () => {
    const adapters = makeMockAdapters();
    const result = await searchPrecedents({
      classification: makeClassification(),
      sourceMode: "mock",
      adapters
    });

    expect(result.decisions).toEqual([]);
    expect(result.sourceResults).toHaveLength(3);
    expect(result.queryTelemetry).toEqual([]);
  });

  it("maps mock adapter results to sourceResults", async () => {
    const mockDecisions = [{ id: "mock-1", court: "yargitay" as const }];
    const yargitayAdapter = { searchHealthPrecedents: vi.fn().mockResolvedValue(mockDecisions) };
    const danistayAdapter = { searchHealthPrecedents: vi.fn().mockResolvedValue([]) };
    const aymAdapter = { searchHealthPrecedents: vi.fn().mockResolvedValue([]) };

    const adapters = makeMockAdapters({
      mockAdapters: [yargitayAdapter, danistayAdapter, aymAdapter]
    });

    const result = await searchPrecedents({
      classification: makeClassification(),
      sourceMode: "mock",
      adapters
    });

    expect(result.sourceResults[0].source).toBe("yargitay");
    expect(result.sourceResults[0].decisions).toEqual(mockDecisions);
    expect(result.sourceResults[1].source).toBe("danistay");
    expect(result.sourceResults[2].source).toBe("aym");
    expect(result.decisions).toEqual(mockDecisions);
  });
});

// ─── Tests: searchPrecedents (live mode) ────────────────────────────────────

describe("precedentPhase — searchPrecedents (live mode)", () => {
  it("returns empty results when all live adapters return ok with no decisions", async () => {
    const adapters = makeMockAdapters();
    const result = await searchPrecedents({
      classification: makeClassification(),
      sourceMode: "live",
      adapters
    });

    expect(result.decisions).toEqual([]);
    expect(result.sourceResults.length).toBeGreaterThan(0);
  });

  it("marks aym as disabled in live mode", async () => {
    const adapters = makeMockAdapters();
    const result = await searchPrecedents({
      classification: makeClassification(),
      sourceMode: "live",
      precedentSources: ["aym"],
      adapters
    });

    expect(result.sourceResults[0].source).toBe("aym");
    expect(result.sourceResults[0].mode).toBe("disabled");
    expect(result.sourceResults[0].unavailable).toBe(true);
  });

  it("collects telemetry for live query attempts", async () => {
    const adapters = makeMockAdapters();
    const result = await searchPrecedents({
      classification: makeClassification(),
      sourceMode: "live",
      adapters
    });

    expect(Array.isArray(result.queryTelemetry)).toBe(true);
    // Telemetry entries exist for each source queried
    expect(result.queryTelemetry.length).toBeGreaterThanOrEqual(1);
  });
});
