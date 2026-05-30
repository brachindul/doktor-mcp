import { describe, expect, it, vi } from "vitest";
import { composeDoctorLegalInformationPack } from "../src/health/answerComposer.js";
import { classifyMedicalLegalQuestion } from "../src/health/questionClassifier.js";
import { extractArticlesFromOfficialText } from "../src/sources/legislation/articleParser.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

const officialArticleText = [
  "MADDE 5- Onceki madde metni.",
  "MADDE 6- (1) Kisilerin sagligina iliskin veriler ozel nitelikli kisisel veridir.",
  "(2) Bu cumle resmi kaynak metninden gelir.",
  "MADDE 7- Sonraki madde metni."
].join("\n");

describe("live official legislation adapter", () => {
  it("parses official legislation search rows from mocked network data", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({
        data: [{
          mevzuatNo: "6698",
          mevzuatTur: "1",
          mevzuatTertip: "5",
          mevAdi: "Kisisel Verilerin Korunmasi Kanunu",
          url: "/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5"
        }]
      }), { status: 200, headers: { "content-type": "application/json" } })
    );
    const adapter = new LiveOfficialLegislationAdapter({ fetchImpl, wait: async () => undefined });
    const result = await adapter.searchOfficialLegislation("saglik verisi");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([expect.objectContaining({
      sourceId: "mevzuat:1.5.6698",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf"
    })]);
  });

  it("returns structured unavailable after a real source block and adaptive retries", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    const adapter = new LiveOfficialLegislationAdapter({ fetchImpl, wait: async () => undefined });
    const result = await adapter.searchOfficialLegislation("riza");

    expect(result).toEqual({
      status: "unavailable",
      source: "mevzuat.gov.tr",
      errorCode: "source_blocked",
      message: "Official source returned HTTP 429.",
      retryable: true,
      recommendedNextStep: expect.stringContaining("Retry")
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("extracts mapped provisions and keeps composer quote text verbatim", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    vi.spyOn(adapter, "searchOfficialLegislation").mockResolvedValue([{
      sourceId: "mevzuat:7.5.4847",
      title: "Hasta Haklari Yonetmeligi",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/7.5.4847.pdf",
      legislationNumber: "4847",
      legislationType: "7",
      legislationArrangement: "5"
    }, {
      sourceId: "mevzuat:1.5.6698",
      title: "Kisisel Verilerin Korunmasi Kanunu",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
      legislationNumber: "6698",
      legislationType: "1",
      legislationArrangement: "5"
    }]);
    vi.spyOn(adapter, "getDocument").mockImplementation(async (result) => {
      const sourceId = result.sourceId;
      if (sourceId === "mevzuat:7.5.4847") {
        return {
          sourceId,
          title: "Hasta Haklari Yonetmeligi",
          sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
          documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/7.5.4847.pdf",
          text: "MADDE 21- Hasta mahremiyetine saygi gosterilir. Saglik hizmeti sunuculari hasta bilgilerini gizli tutmakla yukumludur.",
          contentType: "application/pdf",
          retrievedAt: "2026-05-22T00:00:00.000Z"
        };
      }
      return {
        sourceId: "mevzuat:1.5.6698",
        title: "Kisisel Verilerin Korunmasi Kanunu",
        sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
        documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
        text: officialArticleText,
        contentType: "application/pdf",
        retrievedAt: "2026-05-22T00:00:00.000Z"
      };
    });

    const result = await adapter.getMappedHealthProvisions("kisisel saglik verisi");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const pack = composeDoctorLegalInformationPack(
      classifyMedicalLegalQuestion("kisisel saglik verisi"),
      result.provisions,
      []
    );

    // Hasta Hakları comes first (health_primary, priority 16)
    expect(result.provisions.length).toBeGreaterThanOrEqual(2);
    expect(result.provisions[0]?.verbatimText).toContain("Hasta mahremiyetine");
    expect(result.provisions[0]?.sourceTrace).toEqual(expect.objectContaining({
      selectedSearchResult: expect.objectContaining({ sourceId: "mevzuat:7.5.4847" }),
    }));
    // KVKK comes second (supporting_general, priority 90)
    expect(result.provisions[1]?.verbatimText).toBe(extractArticlesFromOfficialText(officialArticleText)[1]?.text);
    expect(pack.relevantLegislation).toHaveLength(2);
    expect(pack.relevantLegislation[0]?.verbatimQuote).toBe(result.provisions[0]?.verbatimText);
    expect(pack.relevantLegislation[1]?.verbatimQuote).toBe(result.provisions[1]?.verbatimText);
    expect(result.provisions[1]?.sourceTrace).toEqual(expect.objectContaining({
      selectedSearchResult: expect.objectContaining({ sourceId: "mevzuat:1.5.6698" }),
      directPdfUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
      extractionMethod: "pdf-text > article-marker",
      extractedArticleNumbers: ["6"],
      candidateArticleNumbers: ["5", "6", "7"],
      rankedArticleNumbers: expect.arrayContaining(["6"]),
      rejectedArticleNumbers: expect.arrayContaining(["5", "7"]),
      rankingMethod: "deterministic-health-provision-ranking-v1"
    }));
  });

  it("does not compose an invented provision when source text has no mapped article", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    vi.spyOn(adapter, "searchOfficialLegislation").mockResolvedValue([{
      sourceId: "mevzuat:1.5.6698",
      title: "Kisisel Verilerin Korunmasi Kanunu",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
      legislationNumber: "6698",
      legislationType: "1",
      legislationArrangement: "5"
    }]);
    vi.spyOn(adapter, "getDocument").mockResolvedValue({
      sourceId: "mevzuat:1.5.6698",
      title: "Kisisel Verilerin Korunmasi Kanunu",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
      text: "MADDE 5- Kaynakta yalniz farkli bir madde var.",
      contentType: "application/pdf",
      retrievedAt: "2026-05-22T00:00:00.000Z"
    });

    const result = await adapter.getMappedHealthProvisions("kvkk saglik verisi");
    expect(result).toEqual(expect.objectContaining({
      status: "unavailable",
      errorCode: "provision_not_found"
    }));
  });

  it("traces generated PDF selection for Patient Rights mapped articles", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    vi.spyOn(adapter, "searchOfficialLegislation").mockResolvedValue([{
      sourceId: "mevzuat:7.5.4847",
      title: "Hasta Haklari Yonetmeligi",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=4847&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
      legislationNumber: "4847",
      legislationType: "7",
      legislationArrangement: "5"
    }]);
    vi.spyOn(adapter, "getDocument").mockResolvedValue({
      sourceId: "mevzuat:7.5.4847",
      title: "Hasta Haklari Yonetmeligi",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=4847&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
      text: "MADDE 24- Riza metni.\nMADDE 26- Riza formu metni.\nMADDE 27- Sonraki madde.",
      contentType: "application/pdf",
      retrievedAt: "2026-05-22T00:00:00.000Z"
    });

    const result = await adapter.getMappedHealthProvisions("aydinlatilmis riza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.sourceTrace[0]).toEqual(expect.objectContaining({
      selectedSearchResult: expect.objectContaining({ sourceId: "mevzuat:7.5.4847" }),
      generatedPdfUrl: expect.stringContaining("/File/GeneratePdf"),
      extractedArticleNumbers: ["24", "26"]
    }));
  });

  it("keeps trace when no health mapping is available", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    const result = await adapter.getMappedHealthProvisions("bilinmeyen");

    expect(result).toEqual(expect.objectContaining({
      status: "unavailable",
      sourceTrace: [expect.objectContaining({
        matchedHealthMapping: null,
        attemptedHealthMappings: expect.arrayContaining(["mevzuat:1.5.6698", "mevzuat:7.5.4847"])
      })]
    }));
  });

  it("prioritizes health legislation before KVKK for health data privacy queries", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    vi.spyOn(adapter, "searchOfficialLegislation").mockImplementation(async (query) => {
      if (query.includes("Hasta")) return [{
        sourceId: "mevzuat:7.5.4847",
        title: "Hasta Haklari Yonetmeligi",
        sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
        documentUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=4847&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
        legislationNumber: "4847",
        legislationType: "7",
        legislationArrangement: "5"
      }];
      return [{
        sourceId: "mevzuat:1.5.6698",
        title: "Kisisel Verilerin Korunmasi Kanunu",
        sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
        documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
        legislationNumber: "6698",
        legislationType: "1",
        legislationArrangement: "5"
      }];
    });
    vi.spyOn(adapter, "getDocument").mockImplementation(async (result) => ({
      sourceId: result.sourceId,
      title: result.title,
      sourceUrl: result.sourceUrl,
      documentUrl: result.documentUrl,
      text: result.sourceId === "mevzuat:7.5.4847"
        ? "MADDE 21- Hasta mahremiyeti metni.\nMADDE 22- Sonraki."
        : "MADDE 6- Saglik verisi metni.\nMADDE 7- Sonraki.",
      contentType: "application/pdf",
      retrievedAt: "2026-05-22T00:00:00.000Z"
    }));

    const result = await adapter.getMappedHealthProvisions("kişisel sağlık verisi mahremiyet");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.provisions.map((provision) => provision.documentId)).toEqual([
      "mevzuat:7.5.4847",
      "mevzuat:1.5.6698"
    ]);
    expect(result.sourceTrace.map((trace) => trace.matchedHealthMapping?.legislationRole)).toEqual([
      "health_primary",
      "supporting_general"
    ]);
    expect(result.selectionDiagnostics?.selectedLegislations.map((legislation) => legislation.legislationRole)).toEqual([
      "health_primary",
      "supporting_general"
    ]);
  });

  it("maps medical intervention to primary health legislation", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    vi.spyOn(adapter, "searchOfficialLegislation").mockResolvedValue([]);
    vi.spyOn(adapter, "getDocument").mockImplementation(async (result) => ({
      sourceId: result.sourceId,
      title: result.title,
      sourceUrl: result.sourceUrl,
      documentUrl: result.documentUrl,
      text: result.sourceId === "mevzuat:7.5.4847"
        ? "MADDE 24- Tibbi mudahale metni.\nMADDE 31- Riza kapsami metni.\nMADDE 32- Sonraki."
        : "MADDE 1- Tababet icrasi metni.\nMADDE 2- Sonraki.",
      contentType: "application/pdf",
      retrievedAt: "2026-05-22T00:00:00.000Z"
    }));

    const result = await adapter.getMappedHealthProvisions("tıbbi müdahale");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.provisions[0]?.sourceTrace?.matchedHealthMapping).toEqual(expect.objectContaining({
      topicCluster: "medical_intervention",
      legislationRole: "health_primary"
    }));
  });

  it("caps ranked live pack provisions per legislation", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    vi.spyOn(adapter, "searchOfficialLegislation").mockResolvedValue([]);
    vi.spyOn(adapter, "getDocument").mockImplementation(async (result) => ({
      sourceId: result.sourceId,
      title: result.title,
      sourceUrl: result.sourceUrl,
      documentUrl: result.documentUrl,
      text: result.sourceId === "mevzuat:7.5.4847"
        ? [
          "MADDE 15- Hasta tıbbi müdahale öncesi bilgilendirilir.",
          "MADDE 24- Tıbbi müdahale için rıza metni.",
          "MADDE 31- Rıza tıbbi müdahale kapsamını belirler.",
          "MADDE 32- Tıbbi müdahale tıbbi müdahale tıbbi müdahale."
        ].join("\n")
        : "MADDE 1- Saglik hizmeti metni.\nMADDE 3- Hizmet esaslari metni.",
      contentType: "application/pdf",
      retrievedAt: "2026-05-22T00:00:00.000Z"
    }));

    const result = await adapter.getMappedHealthProvisions("hasta hakları tıbbi müdahale");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const patientRightsProvisions = result.provisions.filter((provision) => provision.documentId === "mevzuat:7.5.4847");
    expect(patientRightsProvisions.map((provision) => provision.articleNumber)).toEqual(["15", "24", "31"]);
    expect(result.sourceTrace[0]?.rejectedArticleNumbers).toContain("32");
  });
});
