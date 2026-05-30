import { describe, it, expect } from "vitest";
import { MockLegislationAdapter } from "../src/sources/legislation/mockLegislationAdapter.js";
import { auditPack } from "../src/packAudit.js";

function makePack(overrides: Record<string, unknown> = {}) {
  return {
    shortAnswer: "Test kısa yanıt.",
    legalClassification: {
      criminal: "",
      civilCompensation: "Aydınlatılmış rıza ihlali tazminat doğurabilir.",
      disciplinaryAdministrative: "",
      patientRights: "",
      privacyKvkk: "",
      professionalEthics: ""
    },
    relevantLegislation: [
      {
        legislationName: "Türk Borçlar Kanunu",
        articleNumber: "49",
        verbatimQuote: "Kusurlu ve hukuka aykırı bir fiille başkasına zarar veren...",
        connection: "Hekimin sorumluluğu",
        sourceDocumentId: "tbk:49"
      }
    ],
    verifiedHighCourtPrecedents: [],
    missingInformation: ["Eksik bilgi bulunmaktadır."],
    lawyerReviewPoints: ["Avukatın incelemesi gereklidir."],
    sourceWarnings: [],
    precedentDiagnostics: {
      query: "aydınlatılmış rıza",
      selectedPrecedentCount: 0,
      excludedDecisionCount: 0,
      sourceSummaries: [
        { source: "yargitay", mode: "live", searched: true, searchResultsCount: 0, candidateCount: 0, selectedCount: 0, excludedCount: 0, unavailableCount: 0, errorCodes: [] }
      ],
      selectedPrecedents: [],
      excludedDecisions: []
    },
    ...overrides
  };
}

describe("legislation force metadata", () => {
  it("mock provision should include inForce metadata", async () => {
    const adapter = new MockLegislationAdapter();
    const classification = {
      question: "test",
      dimensions: ["professional_ethics" as const],
      searchTerms: ["test"],
      missingInformation: []
    };
    const results = await adapter.searchHealthLegislation(classification);
    // At least some provisions should have metadata
    const withMetadata = results.filter(p => p.inForce !== undefined);
    expect(withMetadata.length).toBeGreaterThan(0);
  });

  it("mock provision should have inForce: true with lastAmendedDate for some provisions", async () => {
    const adapter = new MockLegislationAdapter();
    const classification = {
      question: "test",
      dimensions: ["professional_ethics" as const],
      searchTerms: ["test"],
      missingInformation: []
    };
    const results = await adapter.searchHealthLegislation(classification);
    const withTrue = results.filter(p => p.inForce === true && p.lastAmendedDate !== undefined);
    expect(withTrue.length).toBeGreaterThan(0);
  });

  it("mock provision should have inForce: \"unknown\" for some provisions", async () => {
    const adapter = new MockLegislationAdapter();
    const classification = {
      question: "test",
      dimensions: ["professional_ethics" as const],
      searchTerms: ["test"],
      missingInformation: []
    };
    const results = await adapter.searchHealthLegislation(classification);
    const withUnknown = results.filter(p => p.inForce === "unknown");
    expect(withUnknown.length).toBeGreaterThan(0);
  });

  it("mock provision should have repealed: true for at least one provision", async () => {
    const adapter = new MockLegislationAdapter();
    const classification = {
      question: "test",
      dimensions: ["professional_ethics" as const],
      searchTerms: ["test"],
      missingInformation: []
    };
    const results = await adapter.searchHealthLegislation(classification);
    const repealed = results.filter(p => p.repealed === true);
    expect(repealed.length).toBeGreaterThan(0);
  });

  it("should produce audit warning for unknown inForce", () => {
    const pack = makePack({
      relevantLegislation: [
        {
          legislationName: "Test Kanun",
          articleNumber: "1",
          verbatimQuote: "test quote",
          connection: "test connection",
          sourceDocumentId: "test-123",
          inForce: "unknown"
        }
      ]
    });
    const result = auditPack(pack);
    const warnings = result.warnings.filter(w => w.includes("belirsiz") || w.includes("unknown"));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("test-123");
  });

  it("should produce audit warning for repealed provision", () => {
    const pack = makePack({
      relevantLegislation: [
        {
          legislationName: "Test Kanun",
          articleNumber: "2",
          verbatimQuote: "test quote",
          connection: "test connection",
          sourceDocumentId: "test-456",
          inForce: false,
          repealed: true
        }
      ]
    });
    const result = auditPack(pack);
    const warnings = result.warnings.filter(w => w.includes("kalkmış") || w.includes("repealed"));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("test-456");
  });

  it("should NOT produce force-metadata warnings when inForce is true", () => {
    const pack = makePack({
      relevantLegislation: [
        {
          legislationName: "Test Kanun",
          articleNumber: "3",
          verbatimQuote: "test quote",
          connection: "test connection",
          sourceDocumentId: "test-789",
          inForce: true,
          lastAmendedDate: "2024-01-01"
        }
      ]
    });
    const result = auditPack(pack);
    const forceWarnings = result.warnings.filter(
      w => w.includes("belirsiz") || w.includes("kalkmış") || w.includes("unknown") || w.includes("repealed")
    );
    expect(forceWarnings).toHaveLength(0);
  });

  it("should produce multiple warnings for mixed force statuses", () => {
    const pack = makePack({
      relevantLegislation: [
        {
          legislationName: "Test Kanun A",
          articleNumber: "1",
          verbatimQuote: "quote a",
          connection: "conn a",
          sourceDocumentId: "doc-unknown",
          inForce: "unknown"
        },
        {
          legislationName: "Test Kanun B",
          articleNumber: "2",
          verbatimQuote: "quote b",
          connection: "conn b",
          sourceDocumentId: "doc-repealed",
          inForce: false,
          repealed: true
        },
        {
          legislationName: "Test Kanun C",
          articleNumber: "3",
          verbatimQuote: "quote c",
          connection: "conn c",
          sourceDocumentId: "doc-active",
          inForce: true
        }
      ]
    });
    const result = auditPack(pack);
    const forceWarnings = result.warnings.filter(
      w => w.includes("belirsiz") || w.includes("kalkmış") || w.includes("unknown") || w.includes("repealed")
    );
    expect(forceWarnings).toHaveLength(2);
  });
});
