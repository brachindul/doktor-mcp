import { describe, it, expect } from "vitest";
import { auditPack } from "../src/packAudit.js";

function makePack(overrides: Record<string, unknown> = {}) {
  return {
    shortAnswer: "Test kısa yanıt.",
    legalClassification: {
      criminal: [],
      civilCompensation: ["Aydınlatılmış rıza ihlali"],
      disciplinaryAdministrative: [],
      patientRights: [],
      privacyKvkk: [],
      professionalEthics: []
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
    missingInformation: [],
    lawyerReviewPoints: [],
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

describe("auditPack — clean pack", () => {
  it("returns ok: true for a clean pack", () => {
    const result = auditPack(makePack());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("counts legislation items correctly", () => {
    const result = auditPack(makePack());
    expect(result.checkedCounts.legislationItems).toBe(1);
    expect(result.checkedCounts.legislationWithSourceTrace).toBe(1);
  });
});

describe("auditPack — missing sourceDocumentId", () => {
  it("errors when a legislation item is missing sourceDocumentId", () => {
    const pack = makePack({
      relevantLegislation: [
        {
          legislationName: "Türk Borçlar Kanunu",
          articleNumber: "49",
          verbatimQuote: "...",
          connection: "test",
          sourceDocumentId: ""
        }
      ]
    });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("sourceDocumentId"))).toBe(true);
  });
});

describe("auditPack — missing selectionDiagnostics", () => {
  it("warns when selectionDiagnostics is missing", () => {
    const pack = makePack({ selectionDiagnostics: undefined });
    const result = auditPack(pack);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("selectionDiagnostics"))).toBe(true);
  });
});

describe("auditPack — missing precedentDiagnostics", () => {
  it("warns when precedentDiagnostics is missing", () => {
    const pack = makePack({ precedentDiagnostics: undefined });
    const result = auditPack(pack);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("precedentDiagnostics"))).toBe(true);
  });
});

describe("auditPack — missing sourceSummaries", () => {
  it("warns when sourceSummaries is missing from precedentDiagnostics", () => {
    const pack = makePack({
      precedentDiagnostics: {
        query: "test",
        selectedPrecedentCount: 0,
        excludedDecisionCount: 0,
        selectedPrecedents: [],
        excludedDecisions: []
        // no sourceSummaries
      }
    });
    const result = auditPack(pack);
    expect(result.warnings.some((w) => w.includes("sourceSummaries"))).toBe(true);
  });
});

describe("auditPack — metadata_only precedent slips in", () => {
  it("errors when a selected precedent has excluded status", () => {
    const pack = makePack({
      precedentDiagnostics: {
        query: "test",
        selectedPrecedentCount: 1,
        excludedDecisionCount: 0,
        sourceSummaries: [],
        selectedPrecedents: [
          {
            source: "yargitay",
            court: "yargitay",
            date: "2023-01-01",
            status: "metadata_only",
            matchedHealthTopics: [],
            eligibilityReasons: []
          }
        ],
        excludedDecisions: []
      }
    });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("metadata_only"))).toBe(true);
  });

  it("errors for procedural_only status", () => {
    const pack = makePack({
      precedentDiagnostics: {
        query: "test",
        selectedPrecedentCount: 1,
        excludedDecisionCount: 0,
        sourceSummaries: [],
        selectedPrecedents: [
          {
            source: "danistay",
            court: "danistay",
            status: "procedural_only",
            matchedHealthTopics: [],
            eligibilityReasons: []
          }
        ],
        excludedDecisions: []
      }
    });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("procedural_only"))).toBe(true);
  });
});

describe("auditPack — MVP-out-of-scope fields", () => {
  it("errors when riskLevel is present", () => {
    const pack = makePack({ riskLevel: "high" });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("riskLevel"))).toBe(true);
  });

  it("errors when finalLegalOpinion is present", () => {
    const pack = makePack({ finalLegalOpinion: "Bu davada ihlal vardır." });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("finalLegalOpinion"))).toBe(true);
  });

  it("errors when kesinHukukiKanaat is present", () => {
    const pack = makePack({ kesinHukukiKanaat: "Kesin kanaat: suçlu" });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("kesinHukukiKanaat"))).toBe(true);
  });

  it("errors when dilekseTaslagi is present", () => {
    const pack = makePack({ dilekseTaslagi: "Sayın Mahkeme..." });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("dilekseTaslagi"))).toBe(true);
  });
});

describe("auditPack — sourceWarnings count", () => {
  it("warns when sourceWarnings exist", () => {
    const pack = makePack({ sourceWarnings: ["Yargıtay unavailable"] });
    const result = auditPack(pack);
    expect(result.warnings.some((w) => w.includes("sourceWarning"))).toBe(true);
  });
});

describe("auditPack — invalid input", () => {
  it("errors on null input", () => {
    const result = auditPack(null);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("errors on non-object input", () => {
    const result = auditPack("not an object");
    expect(result.ok).toBe(false);
  });
});
