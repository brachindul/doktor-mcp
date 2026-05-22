import { describe, expect, it, vi } from "vitest";
import { PhysicianLegalInformationService } from "../src/app/service.js";
import { createMedicalLegalToolHandlers } from "../src/mcp/tools.js";
import type { LegislationProvision } from "../src/contracts/legal.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";
import type { LiveLegislationUnavailable } from "../src/sources/legislation/liveTypes.js";

const liveProvision: LegislationProvision = {
  documentId: "mevzuat:1.5.6698",
  legislationName: "Kisisel Verilerin Korunmasi Kanunu",
  articleNumber: "6",
  verbatimText: "Official article 6 provision text from a mocked live adapter.",
  connection: "Official live test mapping.",
  dimensions: ["privacy_kvkk", "patient_rights"],
  evidence: {
    source: "legislation",
    documentId: "mevzuat:1.5.6698",
    sourceId: "mevzuat:1.5.6698",
    sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
    retrievedAt: "2026-05-22T00:00:00.000Z",
    official: true,
    fullText: true
  },
  sourceTrace: {
    query: "kişisel sağlık verisi",
    matchedHealthMapping: {
      sourceId: "mevzuat:1.5.6698",
      query: "Kisisel Verilerin Korunmasi Kanunu",
      title: "Kisisel Verilerin Korunmasi Kanunu",
      articleNumbers: ["6"]
    },
    officialSearchRequest: {
      url: "https://www.mevzuat.gov.tr/anasayfa/MevzuatDatatable",
      phrase: "Kisisel Verilerin Korunmasi Kanunu",
      searchArea: "Tumu",
      pageSize: 10
    },
    officialSearchResultsCount: 1,
    selectedSearchResult: {
      sourceId: "mevzuat:1.5.6698",
      title: "Kisisel Verilerin Korunmasi Kanunu",
      landingUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf"
    },
    selectedResultReason: "Official search result matched the verified health mapping sourceId.",
    landingUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
    detailUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
    fullTextUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
    directPdfUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
    generatedPdfUrl: null,
    contentType: "application/pdf",
    extractionMethod: "pdf-text > article-marker",
    extractedArticleNumbers: ["6"],
    retrievedAt: "2026-05-22T00:00:00.000Z"
  },
  ranking: {
    score: 132,
    matchedTerms: ["saglik", "verisi"],
    rankingReasons: ["Article 6 is in the mapped article list."],
    fromMappedArticleList: true
  }
};

const unavailable: LiveLegislationUnavailable = {
  status: "unavailable",
  source: "mevzuat.gov.tr",
  errorCode: "source_error",
  message: "Live source unavailable in test.",
  retryable: true,
  recommendedNextStep: "Retry later."
};

describe("MCP legislation sourceMode", () => {
  it("keeps mock mode as the default for legislation search", async () => {
    const handlers = createMedicalLegalToolHandlers();
    const result = await handlers.search_health_legislation({ question: "Aydinlatilmis riza kaydi" });

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toEqual(expect.objectContaining({ documentId: "leg-patient-rights-24" }));
  });

  it("uses live mode for search and provision retrieval through handler inputs", async () => {
    const liveLegislation = new LiveOfficialLegislationAdapter();
    const liveSearch = vi.spyOn(liveLegislation, "getMappedHealthProvisions").mockResolvedValue({
      status: "ok",
      source: "mevzuat.gov.tr",
      query: "kişisel sağlık verisi",
      searchResults: [],
      documents: [],
      provisions: [liveProvision],
      sourceTrace: [liveProvision.sourceTrace!]
    });
    const liveGet = vi.spyOn(liveLegislation, "getLegislationProvisions").mockResolvedValue([liveProvision]);
    const handlers = createMedicalLegalToolHandlers(new PhysicianLegalInformationService({ liveLegislation }));

    const search = await handlers.search_health_legislation({
      question: "kişisel sağlık verisi",
      sourceMode: "live"
    });
    const get = await handlers.get_legislation_provisions({
      documentIds: ["mevzuat:1.5.6698"],
      sourceMode: "live"
    });

    expect(search).toEqual(expect.objectContaining({ status: "ok", provisions: [liveProvision] }));
    expect(search.selectionDiagnostics).toEqual(expect.objectContaining({
      selectedLegislationCount: 1,
      selectedProvisionCount: 1
    }));
    expect(search.selectionDiagnostics?.selectedProvisions[0]).toEqual(expect.objectContaining({
      score: 132,
      matchedTerms: ["saglik", "verisi"]
    }));
    expect(get).toEqual(expect.objectContaining({ sourceMode: "live", provisions: [liveProvision] }));
    expect(get.selectionDiagnostics.selectedProvisionCount).toBe(1);
    expect(liveSearch).toHaveBeenCalledOnce();
    expect(liveGet).toHaveBeenCalledWith(["mevzuat:1.5.6698"]);
  });

  it("composes live pack quotes verbatim from live adapter provisions", async () => {
    const liveLegislation = new LiveOfficialLegislationAdapter();
    vi.spyOn(liveLegislation, "getMappedHealthProvisions").mockResolvedValue({
      status: "ok",
      source: "mevzuat.gov.tr",
      query: "kişisel sağlık verisi",
      searchResults: [],
      documents: [],
      provisions: [liveProvision],
      sourceTrace: [liveProvision.sourceTrace!]
    });
    const handlers = createMedicalLegalToolHandlers(new PhysicianLegalInformationService({
      liveLegislation,
      liveYargitay: { searchHealthPrecedents: async () => [] } as any,
      liveDanistay: { searchHealthPrecedents: async () => [] } as any,
      liveBedesten: { searchHealthPrecedents: async () => [] } as any
    }));
    const pack = await handlers.prepare_doctor_legal_information_pack({
      question: "kişisel sağlık verisi",
      sourceMode: "live"
    });

    expect(pack.relevantLegislation[0]?.verbatimQuote).toBe(liveProvision.verbatimText);
    expect(pack.relevantLegislation[0]?.sourceDocumentId).toBe(liveProvision.documentId);
    expect(pack.sourceTrace?.[0]?.extractedArticleNumbers).toContain("6");
    expect(pack.selectionDiagnostics).toEqual(expect.objectContaining({
      selectedLegislationCount: 1,
      selectedProvisionCount: 1
    }));
    expect(pack.selectionDiagnostics?.selectedProvisions[0]?.topRankingReasons).not.toEqual([]);
  });

  it("carries live unavailable without inventing legislation or MVP-excluded headings", async () => {
    const liveLegislation = new LiveOfficialLegislationAdapter();
    vi.spyOn(liveLegislation, "getMappedHealthProvisions").mockResolvedValue(unavailable);
    const handlers = createMedicalLegalToolHandlers(new PhysicianLegalInformationService({
      liveLegislation,
      liveYargitay: { searchHealthPrecedents: async () => [] } as any,
      liveDanistay: { searchHealthPrecedents: async () => [] } as any,
      liveBedesten: { searchHealthPrecedents: async () => [] } as any
    }));
    const pack = await handlers.prepare_doctor_legal_information_pack({
      question: "kişisel sağlık verisi",
      sourceMode: "live"
    });
    const json = JSON.stringify(pack).toLocaleLowerCase("tr-TR");

    expect(pack.relevantLegislation).toEqual([]);
    expect(pack.sourceUnavailable).toEqual([expect.objectContaining(unavailable)]);
    expect(pack.selectionDiagnostics?.unavailableCount).toBe(1);
    expect(json).not.toContain("risk seviyesi");
    expect(json).not.toContain("derhal yapilacak");
  });
});
