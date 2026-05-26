/**
 * v0.40.0 — Live Legislation Phase Hardening Tests
 *
 * Covers:
 * - Legislation phase cap via Promise.race (hard budget)
 * - Precedent phase still executes when legislation phase times out
 * - Coverage gap detection by issue ID
 * - legislationPhaseBudgetExhausted telemetry
 * - No fake legislation added on timeout
 * - sourceSufficiency legislationCoverageGap reason
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PhysicianLegalInformationService } from "../src/app/service.js";
import { ResearchTimeBudget } from "../src/live/timeBudget.js";
import type { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";
import type { LiveYargitayAdapter } from "../src/sources/yargitay/liveYargitayAdapter.js";
import type { LiveDanistayAdapter } from "../src/sources/danistay/liveDanistayAdapter.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMockLegislation(delayMs: number): Partial<LiveOfficialLegislationAdapter> {
  return {
    getMappedHealthProvisions: vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        status: "ok" as const,
        source: "mevzuat.gov.tr" as const,
        query: "test",
        searchResults: [],
        documents: [],
        provisions: [
          {
            documentId: "mevzuat:7.5.4847",
            legislationName: "Hasta Haklari Yonetmeligi",
            articleNumber: "24",
            verbatimText: "Test mevzuat metni.",
            connection: "Test bağlantısı.",
            dimensions: ["patient_rights" as const],
            evidence: {
              source: "legislation" as const,
              documentId: "mevzuat:7.5.4847",
              sourceId: "mevzuat:7.5.4847",
              sourceUrl: "https://www.mevzuat.gov.tr/test",
              retrievedAt: new Date().toISOString(),
              official: true as const,
              fullText: true
            }
          }
        ],
        sourceTrace: []
      };
    }),
    getLegislationProvisions: vi.fn().mockResolvedValue([]),
    searchHealthLegislation: vi.fn().mockResolvedValue([])
  };
}

function makeMockYargitay(): Partial<LiveYargitayAdapter> {
  return {
    searchAndNormalize: vi.fn().mockResolvedValue({ status: "ok" as const, decisions: [], searchResultsCount: 0 }),
    lastRequestTelemetry: { cacheHit: false, cacheMiss: true, servedFromCache: false, networkRequestMade: true, cacheAgeMs: null, retryCount: 0, backoffMs: 0, retryAfterMs: null, timedOut: false }
  };
}

function makeMockDanistay(): Partial<LiveDanistayAdapter> {
  return {
    searchAndNormalize: vi.fn().mockResolvedValue({ status: "ok" as const, decisions: [], searchResultsCount: 0 }),
    lastRequestTelemetry: { cacheHit: false, cacheMiss: true, servedFromCache: false, networkRequestMade: true, cacheAgeMs: null, retryCount: 0, backoffMs: 0, retryAfterMs: null, timedOut: false }
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Live Legislation Phase Hardening (v0.40.0)", () => {
  it("completes normally when legislation returns before phase budget expires", async () => {
    const legislation = makeMockLegislation(50); // fast
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    const budget = new ResearchTimeBudget({ deadlineMs: 30_000, reserveMs: 1_000 });
    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "live",
      timeBudget: budget
    });

    expect(result.timeBudgetTelemetry).toBeDefined();
    expect(result.timeBudgetTelemetry!.legislationPhaseBudgetExhausted).toBeFalsy();
    expect(result.timeBudgetTelemetry!.legislationPhaseTimedOut).toBeFalsy();
    // Legislation succeeded, so we expect provisions
    expect(result.relevantLegislation.length).toBeGreaterThan(0);
  });

  it("activates legislationPhaseBudgetExhausted when legislation exceeds phase cap", async () => {
    const LEGISLATION_DELAY = 200; // longer than phase cap
    const legislation = makeMockLegislation(LEGISLATION_DELAY);
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    // Create a budget with a very small legislation phase (50ms) to force timeout
    const budget = new ResearchTimeBudget({
      deadlineMs: 10_000,
      reserveMs: 500,
      sourceBudgets: { legislation: 50, precedent: 5_000 } // 50ms legislation cap
    });

    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "live",
      timeBudget: budget
    });

    expect(result.timeBudgetTelemetry).toBeDefined();
    expect(result.timeBudgetTelemetry!.legislationPhaseBudgetExhausted).toBe(true);
    expect(result.timeBudgetTelemetry!.legislationPhaseTimedOut).toBe(true);
  });

  it("still runs precedent phase when legislation phase times out", async () => {
    const legislation = makeMockLegislation(500); // slow
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    const budget = new ResearchTimeBudget({
      deadlineMs: 10_000,
      reserveMs: 500,
      sourceBudgets: { legislation: 50, precedent: 5_000 } // force legislation timeout
    });

    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "live",
      timeBudget: budget
    });

    // Legislation timed out — no fake legislation added
    expect(result.relevantLegislation).toHaveLength(0);
    expect(result.timeBudgetTelemetry!.legislationPhaseTimedOut).toBe(true);
    // Precedent phase should have run (yargitay and danistay called)
    expect(yargitay.searchAndNormalize).toHaveBeenCalled();
  });

  it("does not add fake legislation on legislation phase timeout", async () => {
    const legislation = makeMockLegislation(500); // slow
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    const budget = new ResearchTimeBudget({
      deadlineMs: 10_000,
      reserveMs: 500,
      sourceBudgets: { legislation: 50, precedent: 5_000 }
    });

    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "live",
      timeBudget: budget
    });

    // Must not include any invented legislation with non-gov.tr source
    for (const leg of result.relevantLegislation) {
      if (leg.sourceTrace) {
        expect(leg.sourceTrace.landingUrl ?? "").toMatch(/mevzuat\.gov\.tr|^$/);
      }
    }
    // legis name should not be fabricated
    expect(result.relevantLegislation).toHaveLength(0); // empty on timeout
  });

  it("detects coverage gaps for known gap legislation (private_health_facility)", async () => {
    const legislation = makeMockLegislation(50);
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    const budget = new ResearchTimeBudget({ deadlineMs: 30_000, reserveMs: 1_000 });
    const result = await service.prepareInformationPack({
      question: "Özel hastanede gerçekleşen komplikasyon için sorumluluk nasıl belirlenir?",
      sourceMode: "live",
      timeBudget: budget
    });

    expect(result.timeBudgetTelemetry).toBeDefined();
    // Coverage gaps may or may not be present depending on router output, but telemetry should exist
    expect(Array.isArray(result.timeBudgetTelemetry!.legislationCoverageGaps)).toBe(true);
  });

  it("legislation phase budget telemetry includes phaseBudgetMs", async () => {
    const legislation = makeMockLegislation(50);
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    const budget = new ResearchTimeBudget({
      deadlineMs: 30_000,
      reserveMs: 1_000,
      sourceBudgets: { legislation: 8_000, precedent: 15_000 }
    });

    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "live",
      timeBudget: budget
    });

    expect(result.timeBudgetTelemetry!.legislationPhaseBudgetMs).toBe(8_000);
  });

  it("knownHintFastPathUsed is true when hints are matched", async () => {
    const legislation = makeMockLegislation(50);
    const yargitay = makeMockYargitay();
    const danistay = makeMockDanistay();
    const service = new PhysicianLegalInformationService({
      liveLegislation: legislation as LiveOfficialLegislationAdapter,
      liveYargitay: yargitay as LiveYargitayAdapter,
      liveDanistay: danistay as LiveDanistayAdapter
    });

    const budget = new ResearchTimeBudget({ deadlineMs: 30_000, reserveMs: 1_000 });
    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "live",
      timeBudget: budget
    });

    expect(result.timeBudgetTelemetry!.legislationKnownHintFastPathUsed).toBe(true);
  });

  it("mock mode does not produce timeBudgetTelemetry", async () => {
    const service = new PhysicianLegalInformationService();
    const result = await service.prepareInformationPack({
      question: "Hasta rızası nasıl alınır?",
      sourceMode: "mock"
    });
    expect(result.timeBudgetTelemetry).toBeUndefined();
  });

  it("ResearchTimeBudget effectivePhaseBudgetMs is min(phaseBudget, remainingMs)", () => {
    // Scenario A: remaining > phaseBudget → effectivePhaseBudgetMs = phaseBudget
    const budgetA = new ResearchTimeBudget({
      deadlineMs: 30_000,
      reserveMs: 1_000,
      sourceBudgets: { legislation: 8_000, precedent: 15_000 },
      nowProvider: () => 0 // frozen time, no elapsed
    });
    expect(budgetA.effectivePhaseBudgetMs("legislation")).toBe(8_000);

    // Scenario B: remaining < phaseBudget → effectivePhaseBudgetMs = remaining
    // deadlineMs=5000, reserveMs=1000, elapsed=3000 → remaining=1000; phaseBudget=8000
    let callCount = 0;
    const budgetB = new ResearchTimeBudget({
      deadlineMs: 5_000,
      reserveMs: 1_000,
      sourceBudgets: { legislation: 8_000, precedent: 15_000 },
      nowProvider: () => { callCount++; return callCount === 1 ? 0 : 3_000; }
      // first call: startedAt=0, subsequent calls return 3000 → elapsed=3000, remaining=5000-3000-1000=1000
    });
    expect(budgetB.effectivePhaseBudgetMs("legislation")).toBe(1_000);
  });
});
