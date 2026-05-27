import { describe, expect, it } from "vitest";
import { buildLiveReliabilityGate } from "../src/live/reliabilityGate.js";
import type { ReliabilityGateInput } from "../src/live/reliabilityGate.js";

function baseInput(overrides: Partial<ReliabilityGateInput> = {}): ReliabilityGateInput {
  return {
    totalLiveQuestions: 5,
    livePassedCount: 5,
    liveFailedCount: 0,
    mockFallbackDetected: false,
    contractFailedCount: 0,
    contractUnofficialSourceCount: 0,
    ineligibleUsedCount: 0,
    timeoutCount: 0,
    rateLimitCount: 0,
    sourceUnavailableCount: 0,
    transientFailureCount: 0,
    totalRetries: 0,
    totalBackoffMs: 0,
    cacheHitCount: 2,
    cacheMissCount: 3,
    networkRequestMadeCount: 3,
    verifiedPrecedentCount: 8,
    sourceSufficiencyDistribution: [],
    quoteUnusableInVerifiedCount: 0,
    ...overrides
  };
}

describe("buildLiveReliabilityGate", () => {
  it("returns gatePassed=true when no hard failures", () => {
    const gate = buildLiveReliabilityGate(baseInput());
    expect(gate.gatePassed).toBe(true);
    expect(gate.gateFailures).toHaveLength(0);
  });

  it("fails on mockFallbackDetected", () => {
    const gate = buildLiveReliabilityGate(baseInput({ mockFallbackDetected: true }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.gateFailures.some((f) => f.includes("MOCK_FALLBACK"))).toBe(true);
  });

  it("fails on contractFailedCount > 0", () => {
    const gate = buildLiveReliabilityGate(baseInput({ contractFailedCount: 2 }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.gateFailures.some((f) => f.includes("CONTRACT_FAIL"))).toBe(true);
    expect(gate.gateFailures[0]).toContain("2");
  });

  it("does not hard fail timeout/no-pack diagnostics when no generated pack contract failed", () => {
    const gate = buildLiveReliabilityGate(baseInput({
      contractFailedCount: 0,
      generatedPackContractFailCount: 0,
      packGenerationFailedCount: 2,
      timeoutNoPackCount: 2
    }));
    expect(gate.gatePassed).toBe(true);
    expect(gate.gateFailures.some((f) => f.includes("CONTRACT_FAIL"))).toBe(false);
    expect(gate.timeoutNoPackCount).toBe(2);
    expect(gate.gateObservations.some((o) => o.includes("TIMEOUT_NO_PACK"))).toBe(true);
  });

  it("keeps generated pack contract failures as hard failures", () => {
    const gate = buildLiveReliabilityGate(baseInput({
      contractFailedCount: 1,
      generatedPackContractFailCount: 1,
      packGenerationFailedCount: 2,
      timeoutNoPackCount: 2
    }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.generatedPackContractFailCount).toBe(1);
    expect(gate.gateFailures.some((f) => f.includes("CONTRACT_FAIL"))).toBe(true);
  });

  it("fails on contractUnofficialSourceCount > 0", () => {
    const gate = buildLiveReliabilityGate(baseInput({ contractUnofficialSourceCount: 1 }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.gateFailures.some((f) => f.includes("UNOFFICIAL_SOURCE"))).toBe(true);
  });

  it("fails on ineligibleUsedCount > 0", () => {
    const gate = buildLiveReliabilityGate(baseInput({ ineligibleUsedCount: 3 }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.gateFailures.some((f) => f.includes("INELIGIBLE_PRECEDENT"))).toBe(true);
    expect(gate.gateFailures[0]).toContain("3");
  });

  it("can accumulate multiple hard failures", () => {
    const gate = buildLiveReliabilityGate(baseInput({
      mockFallbackDetected: true,
      contractFailedCount: 1,
      ineligibleUsedCount: 2
    }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.gateFailures).toHaveLength(3);
  });

  it("adds TIMEOUT observation when timeoutCount > 0 but does not fail gate", () => {
    const gate = buildLiveReliabilityGate(baseInput({ timeoutCount: 2 }));
    expect(gate.gatePassed).toBe(true);
    expect(gate.gateObservations.some((o) => o.includes("TIMEOUT"))).toBe(true);
  });

  it("adds RATE_LIMIT observation when rateLimitCount > 0 but does not fail gate", () => {
    const gate = buildLiveReliabilityGate(baseInput({ rateLimitCount: 1 }));
    expect(gate.gatePassed).toBe(true);
    expect(gate.gateObservations.some((o) => o.includes("RATE_LIMIT"))).toBe(true);
  });

  it("adds INSUFFICIENT_SUFFICIENCY observation when some queries are insufficient", () => {
    const gate = buildLiveReliabilityGate(baseInput({
      sourceSufficiencyDistribution: [
        { query: "q1", precedentCount: 1, legislationCount: 2, sufficient: true },
        { query: "q2", precedentCount: 0, legislationCount: 0, sufficient: false }
      ]
    }));
    expect(gate.gatePassed).toBe(true);
    expect(gate.gateObservations.some((o) => o.includes("INSUFFICIENT_SUFFICIENCY"))).toBe(true);
    expect(gate.gateObservations[0]).toContain("1 of 2");
  });

  it("has no observations when all sufficiency records are sufficient", () => {
    const gate = buildLiveReliabilityGate(baseInput({
      sourceSufficiencyDistribution: [
        { query: "q1", precedentCount: 2, legislationCount: 3, sufficient: true }
      ]
    }));
    expect(gate.gateObservations).toHaveLength(0);
  });

  it("passes through scalar fields correctly", () => {
    const gate = buildLiveReliabilityGate(baseInput({
      totalLiveQuestions: 10,
      livePassedCount: 8,
      liveFailedCount: 2,
      verifiedPrecedentCount: 15,
      cacheHitCount: 4,
      cacheMissCount: 6,
      networkRequestMadeCount: 6,
      totalRetries: 3,
      totalBackoffMs: 1500
    }));
    expect(gate.totalLiveQuestions).toBe(10);
    expect(gate.livePassedCount).toBe(8);
    expect(gate.liveFailedCount).toBe(2);
    expect(gate.verifiedPrecedentCount).toBe(15);
    expect(gate.cacheHitCount).toBe(4);
    expect(gate.totalRetries).toBe(3);
    expect(gate.totalBackoffMs).toBe(1500);
  });

  it("fails on quoteUnusableInVerifiedCount > 0 (v0.27.0)", () => {
    const gate = buildLiveReliabilityGate(baseInput({ quoteUnusableInVerifiedCount: 2 }));
    expect(gate.gatePassed).toBe(false);
    expect(gate.gateFailures.some((f) => f.includes("QUOTE_UNUSABLE_VERIFIED"))).toBe(true);
    expect(gate.gateFailures[0]).toContain("2");
  });

  it("quoteUnusableInVerifiedCount=0 does not fail gate", () => {
    const gate = buildLiveReliabilityGate(baseInput({ quoteUnusableInVerifiedCount: 0 }));
    expect(gate.gatePassed).toBe(true);
    expect(gate.quoteUnusableInVerifiedCount).toBe(0);
  });
});
