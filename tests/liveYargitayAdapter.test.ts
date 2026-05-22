import { describe, expect, it, vi } from "vitest";
import { LiveYargitayAdapter } from "../src/sources/yargitay/liveYargitayAdapter.js";
import { PhysicianLegalInformationService } from "../src/app/service.js";

const MOCK_RETRIEVED_AT = "2026-05-22T00:00:00.000Z";

function mockDecisionRow(overrides: Record<string, unknown> = {}) {
  return {
    ID: "99001",
    BIRIMI: "13. Hukuk Dairesi",
    ESAS_YILI: "2023",
    ESAS_SIRASI: "1000",
    KARAR_YILI: "2024",
    KARAR_SIRASI: "2000",
    KARAR_TARIHI: "2024-03-15T00:00:00",
    OZET: "Aydınlatılmış rıza belgesi eksikliği nedeniyle tazminat davası.",
    ...overrides
  };
}

function makeFetch(
  searchResponseData: unknown,
  fullTextBody: string | null = null,
  searchStatus = 200,
  fullTextStatus = 200
) {
  let callCount = 0;
  return vi.fn(async (url: string) => {
    callCount++;
    if (String(url).includes("BilgiBankasiIslem")) {
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
GEREKÇE: Hastanenin aydınlatma yükümlülüğünü yerine getirmediği anlaşıldığından,
rıza belgesinin usulüne uygun alınmadığı kabul edilmelidir.
Tıbbi müdahale öncesi hastanın bilgilendirilmesi zorunludur.
</div>
<div>SONUÇ: Tazminata hükmedilmesine karar verildi.</div>
</body></html>
`;

const BARE_AFFIRMANCE_TEXT = `
<html><body><div>GEREKÇE: Salt onama. KARAR: Onama.</div></body></html>
`;

describe("LiveYargitayAdapter", () => {
  it("writes searchRequest and searchResultsCount to trace", async () => {
    const fetchImpl = makeFetch({ data: [mockDecisionRow()] }, REASONED_FULL_TEXT);
    const adapter = new LiveYargitayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.searchRequest).toEqual(expect.objectContaining({
      url: expect.stringContaining("BilgiBankasiIslem"),
      phrase: "aydınlatılmış rıza"
    }));
    expect(trace.searchResultsCount).toBe(1);
    expect(trace.retrievedAt).toBe(MOCK_RETRIEVED_AT);
  });

  it("sets fullTextAvailable true when full text is retrieved", async () => {
    const fetchImpl = makeFetch({ data: [mockDecisionRow()] }, REASONED_FULL_TEXT);
    const adapter = new LiveYargitayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.sourceTraces[0]!.fullTextAvailable).toBe(true);
    expect(result.sourceTraces[0]!.fullTextRetrievalMethod).toBe("html-text");
  });

  it("excludes decision when full text is not available (metadata_only)", async () => {
    const fetchImpl = makeFetch({ data: [mockDecisionRow()] }, null, 200, 404);
    const adapter = new LiveYargitayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.fullTextAvailable).toBe(false);
    expect(trace.eligibilityStatus).toBe("metadata_only");
    expect(trace.exclusionReasons).toContain("Tam karar metni mevcut değil.");
  });

  it("excludes bare affirmance/reversal decision as procedural_only", async () => {
    const fetchImpl = makeFetch({ data: [mockDecisionRow()] }, BARE_AFFIRMANCE_TEXT);
    const adapter = new LiveYargitayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.eligibilityStatus).toBe("procedural_only");
    expect(trace.exclusionReasons[0]).toContain("salt onama");
  });

  it("marks reasoned health law decision as precedent_usable", async () => {
    const fetchImpl = makeFetch({ data: [mockDecisionRow()] }, REASONED_FULL_TEXT);
    const adapter = new LiveYargitayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const trace = result.sourceTraces[0]!;
    expect(trace.eligibilityStatus).toBe("precedent_usable");
    expect(trace.eligibilityReasons).toContain("Emsal olarak kullanılabilir.");
    expect(trace.exclusionReasons).toHaveLength(0);
  });

  it("returns structured unavailable on HTTP 429 with retries", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    const adapter = new LiveYargitayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("rıza");
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;

    expect(result.source).toBe("yargitay.gov.tr");
    expect(result.errorCode).toBe("source_blocked");
    expect(result.retryable).toBe(true);
    expect(result.sourceTrace).toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns structured unavailable on network error", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    const adapter = new LiveYargitayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("rıza");
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
    const adapter = new LiveYargitayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("rıza");
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;

    expect(result.errorCode).toBe("parse_failed");
  });

  it("returns ok with empty decisions when search returns no results", async () => {
    const fetchImpl = makeFetch({ data: [] });
    const adapter = new LiveYargitayAdapter({ fetchImpl, wait: async () => undefined });

    const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.searchResultsCount).toBe(0);
    expect(result.decisions).toHaveLength(0);
  });

  it("handles non-standard response format with results array", async () => {
    const fetchImpl = makeFetch([mockDecisionRow()], REASONED_FULL_TEXT);
    const adapter = new LiveYargitayAdapter({ fetchImpl, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    const result = await adapter.searchAndNormalize("tıbbi müdahale");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.decisions.length).toBeGreaterThan(0);
  });
});

describe("prepare_doctor_legal_information_pack live precedent integration", () => {
  it("only usable decisions enter verifiedHighCourtPrecedents in live mode", async () => {
    const mockFetch = makeFetch({ data: [mockDecisionRow()] }, REASONED_FULL_TEXT);
    const liveYargitay = new LiveYargitayAdapter({ fetchImpl: mockFetch, now: () => new Date(MOCK_RETRIEVED_AT), wait: async () => undefined });

    vi.spyOn(liveYargitay, "searchHealthPrecedents").mockResolvedValue([
      {
        id: "yargitay:usable-live",
        court: "yargitay",
        decisionDate: "2024-03-15",
        meritsNumber: "2023/1000",
        decisionNumber: "2024/2000",
        factSummary: "Aydınlatılmış rıza belgesi eksikliği.",
        legalReasoning: "Hastanenin aydınlatma yükümlülüğünü yerine getirmediği anlaşıldığından tazminata hükmedildi.",
        outcome: "Tazminata hükmedildi.",
        relevanceNote: "'aydınlatılmış rıza' sağlık hukuku aramasıyla eşleşti; tam metin ve gerekçe mevcut.",
        topicTags: [],
        fullText: "tam metin aydınlatılmış rıza gerekçe mevcut.",
        evidence: { source: "yargitay", documentId: "yargitay:usable-live", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true },
        chamber: "13. Hukuk Dairesi"
      },
      {
        id: "yargitay:excluded-live",
        court: "yargitay",
        decisionDate: "2024-01-01",
        topicTags: [],
        evidence: { source: "yargitay", documentId: "yargitay:excluded-live", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: false }
      }
    ]);

    const service = new PhysicianLegalInformationService({ liveYargitay });
    const pack = await service.prepareInformationPack({ question: "aydınlatılmış rıza", sourceMode: "live" });

    const precedentIds = pack.verifiedHighCourtPrecedents.map((p) => p.sourceDocumentId);
    expect(precedentIds).toContain("yargitay:usable-live");
    expect(precedentIds).not.toContain("yargitay:excluded-live");
  });

  it("excluded live decisions appear in precedentDiagnostics", async () => {
    const liveYargitay = new LiveYargitayAdapter({ wait: async () => undefined });
    vi.spyOn(liveYargitay, "searchHealthPrecedents").mockResolvedValue([
      {
        id: "yargitay:no-fulltext",
        court: "yargitay",
        topicTags: [],
        evidence: { source: "yargitay", documentId: "yargitay:no-fulltext", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: false }
      }
    ]);

    const service = new PhysicianLegalInformationService({ liveYargitay });
    const pack = await service.prepareInformationPack({ question: "rıza belgesi", sourceMode: "live" });

    expect(pack.precedentDiagnostics).toBeDefined();
    const excluded = pack.precedentDiagnostics!.excludedDecisions;
    const excludedIds = excluded.map((d) => d.court);
    expect(excludedIds).toContain("yargitay");
  });

  it("does not include risk level, immediate actions, or final legal opinion in live mode pack", async () => {
    const liveYargitay = new LiveYargitayAdapter({ wait: async () => undefined });
    vi.spyOn(liveYargitay, "searchHealthPrecedents").mockResolvedValue([]);

    const service = new PhysicianLegalInformationService({ liveYargitay });
    const pack = await service.prepareInformationPack({ question: "rıza eksikliği", sourceMode: "live" });
    const json = JSON.stringify(pack).toLocaleLowerCase("tr-TR");

    expect(json).not.toContain("risk seviyesi");
    expect(json).not.toContain("derhal yapilacak");
    expect(json).not.toContain("kesin hukuki kanaat");
    expect(pack).not.toHaveProperty("riskLevel");
    expect(pack).not.toHaveProperty("immediateActions");
  });
});
