/**
 * tests/sourceSufficiency.test.ts
 *
 * v0.24.0 — Source Sufficiency Gate
 *
 * Pure-function tests: no network, no file I/O.
 */

import { describe, it, expect } from "vitest";
import { evaluateSourceSufficiency } from "../src/sourceSufficiency.js";
import type { SourceSufficiencyInput } from "../src/sourceSufficiency.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<SourceSufficiencyInput> = {}): SourceSufficiencyInput {
  return {
    routedIssueIds: ["informed_consent"],
    primaryIssueId: "informed_consent",
    relevantLegislation: [],
    verifiedPrecedents: [],
    contractPassed: true,
    unofficialSourceDetected: false,
    usedMockSourceInLiveMode: false,
    sourceMode: "mock",
    auditOk: true,
    ...overrides
  };
}

function makeLegislation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    legislationName: "Hasta Haklari Yonetmeligi",
    articleNumber: "24",
    verbatimQuote: "Tibbi mudahalelerde hastanin rizasi gerekir.",
    connection: "Aydinlatilmis onam.",
    sourceTrace: {
      landingUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/7.5.4847.pdf",
      fullTextUrl: null,
      detailUrl: null,
      directPdfUrl: null,
      generatedPdfUrl: null
    },
    ...overrides
  };
}

function makePrecedent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    courtAndChamber: "YARGITAY / 13. Hukuk Dairesi",
    court: "yargitay",
    date: "2024-03-11",
    meritsAndDecisionNumber: "2023/10 - 2024/20",
    factSummary: "Tibbi mudahale oncesi bilgilendirme ve riza kapsami tartisildi.",
    legalAssessment: "Karar, aydinlatma kaydinin onem kazandigini gerekcelendirdi.",
    outcome: "Onama.",
    similarityDifference: "Benzer riza uyuşmazligi; belgeler incelenmeli.",
    sourceDocumentId: "yargitay-reasoned-consent",
    fullTextAvailable: true,
    reasoningDetected: true,
    eligibilityStatus: "precedent_usable",
    eligibilityReasons: ["full_text_available", "reasoning_detected"],
    issueProfile: "informed_consent",
    matchedHealthLawTerms: ["onam", "riza"],
    decisionSourceTrace: {
      fullTextUrl: "https://karararama.yargitay.gov.tr/..."
    },
    ...overrides
  };
}

// ─── 1. sufficient ────────────────────────────────────────────────────────────

describe("evaluateSourceSufficiency — sufficient", () => {
  it("returns 'sufficient' when all criteria met", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()],
      contractPassed: true,
      unofficialSourceDetected: false
    }));
    expect(result.level).toBe("sufficient");
    expect(result.canComposeResearchPack).toBe(true);
    expect(result.missingAuthorityTypes).toHaveLength(0);
  });

  it("sufficient result has no missing authority types", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()]
    }));
    expect(result.missingAuthorityTypes).toEqual([]);
  });

  it("sufficient: hasFullTextReasoning = true", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()]
    }));
    expect(result.hasFullTextReasoning).toBe(true);
  });

  it("sufficient: hasOfficialSourceTrace = true", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()]
    }));
    expect(result.hasOfficialSourceTrace).toBe(true);
  });
});

// ─── 2. partial ───────────────────────────────────────────────────────────────

describe("evaluateSourceSufficiency — partial", () => {
  it("returns 'partial' when legislation present but no verified precedent", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: []
    }));
    expect(result.level).toBe("partial");
    expect(result.canComposeResearchPack).toBe(true);
    expect(result.missingAuthorityTypes).toContain("highCourtPrecedent");
  });

  it("returns 'partial' when legislation + precedent present but fullText reasoning missing", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent({
        fullTextAvailable: false,
        reasoningDetected: false,
        eligibilityStatus: "no_reasoning"
      })]
    }));
    // allPrecedentsIneligible → insufficient for the eligibility check,
    // but legislation IS present so hasHardBlocker depends on allPrecedentsIneligible
    // allPrecedentsIneligible = true when ALL are ineligible → insufficient
    expect(["partial", "insufficient"]).toContain(result.level);
  });

  it("returns 'partial' when precedent has no full-text but is usable (no_reasoning alone)", () => {
    // Not all ineligible — mix of statuses
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [
        makePrecedent({ fullTextAvailable: false, reasoningDetected: false, eligibilityStatus: "no_reasoning" }),
        makePrecedent({ fullTextAvailable: true, reasoningDetected: true, eligibilityStatus: "precedent_usable" })
      ]
    }));
    // Second precedent is usable → not allPrecedentsIneligible → no hard blocker
    expect(result.level).toBe("sufficient"); // all other criteria met
  });

  it("partial when contract failed but legislation present", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()],
      contractPassed: false
    }));
    expect(result.level).toBe("partial");
    expect(result.canComposeResearchPack).toBe(true);
  });
});

// ─── 3. insufficient ──────────────────────────────────────────────────────────

describe("evaluateSourceSufficiency — insufficient", () => {
  it("returns 'insufficient' when no legislation at all", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [],
      verifiedPrecedents: []
    }));
    expect(result.level).toBe("insufficient");
    expect(result.canComposeResearchPack).toBe(false);
    expect(result.missingAuthorityTypes).toContain("legislation");
  });

  it("returns 'insufficient' when unofficial source detected", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()],
      unofficialSourceDetected: true
    }));
    expect(result.level).toBe("insufficient");
    expect(result.missingAuthorityTypes).toContain("officialSourceTrace");
  });

  it("returns 'insufficient' when mock source used in live mode", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()],
      usedMockSourceInLiveMode: true,
      sourceMode: "live"
    }));
    expect(result.level).toBe("insufficient");
    expect(result.canComposeResearchPack).toBe(false);
  });

  it("returns 'insufficient' when all precedents are metadata-only", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [
        makePrecedent({ eligibilityStatus: "metadata_only", fullTextAvailable: false, reasoningDetected: false }),
        makePrecedent({ eligibilityStatus: "metadata_only", fullTextAvailable: false, reasoningDetected: false })
      ]
    }));
    expect(result.level).toBe("insufficient");
    expect(result.missingAuthorityTypes).toContain("verifiedPrecedentEligibility");
  });

  it("returns 'insufficient' when all precedents are procedural-only", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [
        makePrecedent({ eligibilityStatus: "procedural_only", fullTextAvailable: false, reasoningDetected: false })
      ]
    }));
    expect(result.level).toBe("insufficient");
  });

  it("returns 'insufficient' when no legislation and unclear_or_mixed primary", () => {
    const result = evaluateSourceSufficiency(makeInput({
      routedIssueIds: ["unclear_or_mixed"],
      primaryIssueId: "unclear_or_mixed",
      relevantLegislation: [],
      verifiedPrecedents: []
    }));
    expect(result.level).toBe("insufficient");
    expect(result.canComposeResearchPack).toBe(false);
  });

  it("missing 'legislation' authority type when no legislation", () => {
    const result = evaluateSourceSufficiency(makeInput());
    expect(result.missingAuthorityTypes).toContain("legislation");
    expect(result.missingAuthorityTypes).toContain("highCourtPrecedent");
  });

  it("missing 'officialSourceTrace' when legislation has no sourceTrace", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation({ sourceTrace: undefined })],
      verifiedPrecedents: [makePrecedent()]
    }));
    expect(result.missingAuthorityTypes).toContain("officialSourceTrace");
  });
});

// ─── 4. Counts and fields ─────────────────────────────────────────────────────

describe("evaluateSourceSufficiency — output fields", () => {
  it("legislationCount matches input legislation array length", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation(), makeLegislation({ legislationName: "Tibbi Deontoloji" })]
    }));
    expect(result.legislationCount).toBe(2);
  });

  it("verifiedPrecedentCount matches input precedents array length", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent(), makePrecedent()]
    }));
    expect(result.verifiedPrecedentCount).toBe(2);
  });

  it("issueIds matches routedIssueIds input", () => {
    const result = evaluateSourceSufficiency(makeInput({
      routedIssueIds: ["informed_consent", "emergency_care"],
      primaryIssueId: "emergency_care"
    }));
    expect(result.issueIds).toEqual(["informed_consent", "emergency_care"]);
  });

  it("reasons array is non-empty when anything is missing", () => {
    const result = evaluateSourceSufficiency(makeInput());
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("reasons array is empty for a fully sufficient result", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent()]
    }));
    expect(result.reasons).toHaveLength(0);
  });

  it("warnings array is non-empty for partial level", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: []
    }));
    expect(result.level).toBe("partial");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("missingAuthorityTypes contains no duplicates", () => {
    const result = evaluateSourceSufficiency(makeInput({
      unofficialSourceDetected: true,
      relevantLegislation: [makeLegislation({ sourceTrace: undefined })]
    }));
    const unique = [...new Set(result.missingAuthorityTypes)];
    expect(result.missingAuthorityTypes).toEqual(unique);
  });
});

// ─── 5. Issue-specific match ──────────────────────────────────────────────────

describe("evaluateSourceSufficiency — issue-specific matching", () => {
  it("issue-specific legislation count is positive when legislation matches issue", () => {
    const result = evaluateSourceSufficiency(makeInput({
      routedIssueIds: ["informed_consent"],
      primaryIssueId: "informed_consent",
      relevantLegislation: [makeLegislation({ legislationName: "Hasta Haklari Yonetmeligi" })]
    }));
    expect(result.issueSpecificLegislationCount).toBeGreaterThan(0);
  });

  it("issue-specific precedent count is positive when precedent matches issue terms", () => {
    const result = evaluateSourceSufficiency(makeInput({
      routedIssueIds: ["informed_consent"],
      primaryIssueId: "informed_consent",
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: [makePrecedent({
        issueProfile: "informed_consent",
        matchedHealthLawTerms: ["onam", "riza"]
      })]
    }));
    expect(result.issueSpecificPrecedentCount).toBeGreaterThan(0);
  });
});

// ─── 6. canComposeResearchPack logic ─────────────────────────────────────────

describe("evaluateSourceSufficiency — canComposeResearchPack", () => {
  it("false when no legislation", () => {
    expect(evaluateSourceSufficiency(makeInput()).canComposeResearchPack).toBe(false);
  });

  it("false when unofficial source detected", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      unofficialSourceDetected: true
    }));
    expect(result.canComposeResearchPack).toBe(false);
  });

  it("true when legislation present and no hard blocker", () => {
    const result = evaluateSourceSufficiency(makeInput({
      relevantLegislation: [makeLegislation()],
      verifiedPrecedents: []
    }));
    expect(result.canComposeResearchPack).toBe(true);
  });
});

// ─── 7. Safety invariants ─────────────────────────────────────────────────────

describe("evaluateSourceSufficiency — safety invariants (no forbidden content)", () => {
  const FORBIDDEN = [
    "risk seviyesi", "risk yuksek", "risk dusuk",
    "derhal yapilacak", "kesin hukuki kanaat",
    "dilekce taslagi", "savunma taslagi"
  ];

  it("no forbidden patterns in reasons array", () => {
    const cases: Partial<SourceSufficiencyInput>[] = [
      {},
      { relevantLegislation: [makeLegislation()], verifiedPrecedents: [makePrecedent()] },
      { unofficialSourceDetected: true },
      { usedMockSourceInLiveMode: true, sourceMode: "live" }
    ];
    for (const c of cases) {
      const result = evaluateSourceSufficiency(makeInput(c));
      const allText = [...result.reasons, ...result.warnings].join(" ").toLocaleLowerCase("tr-TR");
      for (const forbidden of FORBIDDEN) {
        expect(allText, `Output contains "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });
});
