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
    vi.spyOn(adapter, "getDocument").mockResolvedValue({
      sourceId: "mevzuat:1.5.6698",
      title: "Kisisel Verilerin Korunmasi Kanunu",
      sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
      documentUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
      text: officialArticleText,
      contentType: "application/pdf",
      retrievedAt: "2026-05-22T00:00:00.000Z"
    });

    const result = await adapter.getMappedHealthProvisions("kisisel saglik verisi mahremiyet");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const pack = composeDoctorLegalInformationPack(
      classifyMedicalLegalQuestion("kisisel saglik verisi mahremiyet"),
      result.provisions,
      []
    );

    expect(result.provisions[0]?.verbatimText).toBe(extractArticlesFromOfficialText(officialArticleText)[1]?.text);
    expect(pack.relevantLegislation[0]?.verbatimQuote).toBe(result.provisions[0]?.verbatimText);
  });

  it("does not compose an invented provision when source text has no mapped article", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
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
});
