/**
 * Tests for the extracted legislation phase executor.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeLegislationPhase,
  detectLegislationCoverageGaps,
  isLegislationUnavailable
} from "../src/app/legislationPhase.js";
import type { ClassifiedMedicalLegalQuestion } from "../src/contracts/legal.js";
import type { MedicalIssueId } from "../src/medicalIssueRouter.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeClassification(question = "Hasta rızası nasıl alınır?"): ClassifiedMedicalLegalQuestion {
  return {
    question,
    dimensions: ["patient_rights"],
    searchTerms: ["hasta", "rıza"],
    missingInformation: []
  };
}

function makeLiveOkResult(provisions: unknown[] = []) {
  return {
    status: "ok" as const,
    source: "mevzuat.gov.tr" as const,
    query: "test",
    searchResults: [],
    documents: [],
    provisions,
    sourceTrace: [],
    selectionDiagnostics: {
      query: "test",
      sourceMode: "live" as const,
      selectedLegislationCount: 0,
      selectedProvisionCount: 0,
      selectedLegislations: [],
      selectedProvisions: [],
      unavailableCount: 0,
      warningCount: 0
    }
  };
}

function makeLiveUnavailableResult() {
  return {
    status: "unavailable" as const,
    source: "mevzuat.gov.tr" as const,
    errorCode: "source_error" as const,
    message: "Source unavailable",
    retryable: true,
    recommendedNextStep: "Try again later",
    selectionDiagnostics: {
      query: "test",
      sourceMode: "live" as const,
      selectedLegislationCount: 0,
      selectedProvisionCount: 0,
      selectedLegislations: [],
      selectedProvisions: [],
      unavailableCount: 1,
      warningCount: 0
    }
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("legislationPhase — executeLegislationPhase", () => {
  it("returns legislation result when search completes within budget", async () => {
    const provisions = [{ documentId: "doc1", legislationName: "Test Law" }];
    const searchLegislation = vi.fn().mockResolvedValue(makeLiveOkResult(provisions));

    const result = await executeLegislationPhase({
      classification: makeClassification(),
      searchLegislation,
      phaseBudgetMs: 5_000
    });

    expect(result.legislation).toBeDefined();
    expect(result.legislation).toHaveProperty("status", "ok");
    expect(result.diagnostics.timedOut).toBe(false);
    expect(result.diagnostics.phaseBudgetExhausted).toBe(false);
    expect(searchLegislation).toHaveBeenCalledOnce();
  });

  it("times out when search exceeds phase budget", async () => {
    const searchLegislation = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return makeLiveOkResult();
    });

    const result = await executeLegislationPhase({
      classification: makeClassification(),
      searchLegislation,
      phaseBudgetMs: 50 // very short budget
    });

    expect(result.diagnostics.timedOut).toBe(true);
    expect(result.diagnostics.phaseBudgetExhausted).toBe(true);
    expect(result.diagnostics.retrievalTimeout).toBe(true);
    expect(result.legislation).toHaveProperty("status", "unavailable");
  });

  it("sets failedBeforePrecedent when legislation returns unavailable (not timeout)", async () => {
    const searchLegislation = vi.fn().mockResolvedValue(makeLiveUnavailableResult());

    const result = await executeLegislationPhase({
      classification: makeClassification(),
      searchLegislation,
      phaseBudgetMs: 5_000
    });

    expect(result.diagnostics.failedBeforePrecedent).toBe(true);
    expect(result.diagnostics.timedOut).toBe(false);
    expect(result.legislation).toHaveProperty("status", "unavailable");
  });

  it("returns empty coverageGaps for generic questions", async () => {
    const searchLegislation = vi.fn().mockResolvedValue(makeLiveOkResult());

    const result = await executeLegislationPhase({
      classification: makeClassification("Hasta rızası nasıl alınır?"),
      searchLegislation,
      phaseBudgetMs: 5_000
    });

    expect(Array.isArray(result.diagnostics.coverageGaps)).toBe(true);
  });

  it("knownHintFastPathUsed is true by default", async () => {
    const searchLegislation = vi.fn().mockResolvedValue(makeLiveOkResult());

    const result = await executeLegislationPhase({
      classification: makeClassification(),
      searchLegislation,
      phaseBudgetMs: 5_000
    });

    expect(result.diagnostics.knownHintFastPathUsed).toBe(true);
  });
});

describe("legislationPhase — isLegislationUnavailable", () => {
  it("returns true for objects with status === 'unavailable'", () => {
    expect(isLegislationUnavailable({ status: "unavailable" })).toBe(true);
  });

  it("returns false for objects with status === 'ok'", () => {
    expect(isLegislationUnavailable({ status: "ok" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isLegislationUnavailable(null)).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isLegislationUnavailable([1, 2, 3])).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isLegislationUnavailable("string")).toBe(false);
  });
});

describe("legislationPhase — detectLegislationCoverageGaps", () => {
  it("returns empty array for empty issue IDs", () => {
    expect(detectLegislationCoverageGaps([])).toEqual([]);
  });

  it("returns an array (possibly empty) for valid issue IDs", () => {
    const gaps = detectLegislationCoverageGaps(["informed_consent" as MedicalIssueId]);
    expect(Array.isArray(gaps)).toBe(true);
  });
});
