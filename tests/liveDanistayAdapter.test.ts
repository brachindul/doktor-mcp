import { describe, expect, it, vi } from "vitest";
import { LiveDanistayAdapter } from "../src/sources/danistay/liveDanistayAdapter.js";

const MOCK_RETRIEVED_AT = "2026-05-22T00:00:00.000Z";

function mockDecisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "88001",
    daireKurul: "10. Daire",
    esasNo: "2022/500",
    kararNo: "2023/800",
    kararTarihi: "2023-06-10T00:00:00",
    arananKelime: "Sağlık hizmet kusuru nedeniyle tazminat davası.",
    ...overrides
  };
}

function makeFetch(
  searchResponseData: unknown,
  fullTextBody: string | null = null,
  searchStatus = 200,
  fullTextStatus = 200
) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("aramalist")) {
      return new Response(JSON.stringify(searchResponseData), {
        status: searchStatus,
        headers: { "content-type": "application/json" }
      });
    }
    if (fullTextBody === null) {
      return new Response("", { status: fullTextStatus });
    }
    return new Response(fullTextBody, {
      status: fullTextStatus,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  });
}

const REASONED_FULL_TEXT = `
<html><body>
<div>
GEREKÇE: Hastanenin hizmet kusuru bulunduğu anlaşıldığından
tıbbi müdahale sırasında gerekli özenin gösterilmediği kabul edilmelidir.
Hasta hakları kapsamında bilgilendirme yapılması zorunludur.
</div>
<div>SONUÇ: Tazminata hükmedilmesine karar verildi.</div>
</body></html>
`;

const BARE_AFFIRMANCE_TEXT = `
<html><body><div>GEREKÇE: Salt onama. KARAR: Onama.</div></body></html>
`;

describe("LiveDanistayAdapter", () => {
  it("writes searchRequest and searchResultsCount to trace", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow()] } }, REASONED_FULL_TEXT);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hizmet kusuru tıbbi müdahale");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.searchRequest).toEqual(expect.objectContaining({
      url: expect.stringContaining("aramalist"),
      phrase: "hizmet kusuru tıbbi müdahale"
    }));
    expect(trace.searchResultsCount).toBe(1);
    expect(trace.retrievedAt).toBe(MOCK_RETRIEVED_AT);
  });

  it("sets fullTextAvailable true when full text is retrieved", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow()] } }, REASONED_FULL_TEXT);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hasta hakları");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.sourceTraces[0]!.fullTextAvailable).toBe(true);
    expect(result.sourceTraces[0]!.fullTextRetrievalMethod).toBe("html-text");
  });

  it("excludes decision when full text is not available (metadata_only)", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow()] } }, null, 200, 404);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hasta hakları");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.fullTextAvailable).toBe(false);
    expect(trace.eligibilityStatus).toBe("metadata_only");
    expect(trace.exclusionReasons).toContain("Tam karar metni mevcut değil.");
  });

  it("excludes bare affirmance/reversal decision as procedural_only", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow()] } }, BARE_AFFIRMANCE_TEXT);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hizmet kusuru");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.eligibilityStatus).toBe("procedural_only");
    expect(trace.exclusionReasons[0]).toContain("salt onama");
  });

  it("marks reasoned health law decision as precedent_usable", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow()] } }, REASONED_FULL_TEXT);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hizmet kusuru tıbbi müdahale");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.eligibilityStatus).toBe("precedent_usable");
    expect(trace.eligibilityReasons).toContain("Emsal olarak kullanılabilir.");
    expect(trace.exclusionReasons).toHaveLength(0);
  });

  it("returns structured unavailable on HTTP 429 with retries", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    const adapter = new LiveDanistayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("kusur");
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;

    expect(result.source).toBe("danistay.gov.tr");
    expect(result.errorCode).toBe("source_blocked");
    expect(result.retryable).toBe(true);
    expect(result.sourceTrace).toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns structured unavailable on network error", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    const adapter = new LiveDanistayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("kusur");
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;

    expect(result.errorCode).toBe("source_error");
    expect(result.sourceTrace?.[0]?.error).toContain("ECONNREFUSED");
  });

  it("returns structured unavailable when JSON is not parseable", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const adapter = new LiveDanistayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("kusur");
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;

    expect(result.errorCode).toBe("parse_failed");
  });

  it("returns ok with empty decisions when search returns no results", async () => {
    const fetchImpl = makeFetch({ data: { data: [] } });
    const adapter = new LiveDanistayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hasta hakları");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.searchResultsCount).toBe(0);
    expect(result.decisions).toHaveLength(0);
  });

  it("normalizes chamber from DAIRESI field", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow({ daireKurul: "5. Daire" })] } }, REASONED_FULL_TEXT);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hizmet kusuru");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.decisions[0]?.chamber).toBe("5. Daire");
  });

  it("sets court to danistay in decisions", async () => {
    const fetchImpl = makeFetch({ data: { data: [mockDecisionRow()] } }, REASONED_FULL_TEXT);
    const adapter = new LiveDanistayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("hizmet kusuru");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.decisions[0]?.court).toBe("danistay");
    expect(result.decisions[0]?.id).toMatch(/^danistay:/);
  });
});
