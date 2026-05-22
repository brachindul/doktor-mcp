import { describe, expect, it } from "vitest";
import type { LegislationProvision } from "../src/contracts/legal.js";
import { buildLegislationSelectionDiagnostics } from "../src/sources/legislation/selectionDiagnostics.js";

const provision: LegislationProvision = {
  documentId: "mevzuat:7.5.4847",
  legislationName: "Hasta Haklari Yonetmeligi",
  articleNumber: "24",
  verbatimText: "Official source text.",
  connection: "Selection diagnostics test.",
  dimensions: ["patient_rights"],
  evidence: {
    source: "legislation",
    documentId: "mevzuat:7.5.4847",
    retrievedAt: "2026-05-22T00:00:00.000Z",
    official: true,
    fullText: true
  },
  ranking: {
    score: 128,
    matchedTerms: ["riza"],
    rankingReasons: ["Article 24 is mapped.", "Query term riza matched source text."],
    fromMappedArticleList: true
  },
  sourceTrace: {
    query: "aydınlatılmış rıza",
    matchedHealthMapping: {
      sourceId: "mevzuat:7.5.4847",
      query: "Hasta Haklari Yonetmeligi",
      title: "Hasta Haklari Yonetmeligi",
      articleNumbers: ["24", "26"],
      topicCluster: "informed_consent",
      legislationRole: "health_primary",
      healthLawPriority: 10,
      selectionReason: "Patient Rights regulation directly governs informed consent."
    },
    officialSearchRequest: null,
    officialSearchResultsCount: null,
    selectedSearchResult: null,
    selectedResultReason: null,
    landingUrl: null,
    detailUrl: null,
    fullTextUrl: null,
    directPdfUrl: null,
    generatedPdfUrl: null,
    contentType: "application/pdf",
    extractionMethod: "pdf-text > article-marker",
    extractedArticleNumbers: ["24"],
    rejectedArticleNumbers: ["1", "2", "3"],
    retrievedAt: "2026-05-22T00:00:00.000Z"
  }
};

describe("legislation selection diagnostics", () => {
  it("summarizes selected legislation and ranked provisions", () => {
    const diagnostics = buildLegislationSelectionDiagnostics({
      query: "aydınlatılmış rıza",
      sourceMode: "live",
      provisions: [provision],
      warningCount: 1
    });

    expect(diagnostics).toEqual(expect.objectContaining({
      selectedLegislationCount: 1,
      selectedProvisionCount: 1,
      warningCount: 1,
      unavailableCount: 0
    }));
    expect(diagnostics.selectedLegislations[0]).toEqual(expect.objectContaining({
      legislationRole: "health_primary",
      topicCluster: "informed_consent",
      selectedArticleNumbers: ["24"]
    }));
    expect(diagnostics.selectedProvisions[0]).toEqual(expect.objectContaining({
      score: 128,
      matchedTerms: ["riza"],
      topRankingReasons: expect.arrayContaining(["Article 24 is mapped."])
    }));
  });
});
