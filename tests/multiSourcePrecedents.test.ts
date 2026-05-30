import { describe, expect, it, vi } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { LiveYargitayAdapter } from "../src/sources/yargitay/liveYargitayAdapter.js";
import { LiveDanistayAdapter } from "../src/sources/danistay/liveDanistayAdapter.js";

const MOCK_RETRIEVED_AT = "2026-05-22T00:00:00.000Z";

function makeUsableDecision(id: string, court: "yargitay" | "danistay") {
  return {
    id: `${court}:${id}`,
    court,
    decisionDate: "2024-01-01",
    meritsNumber: "2023/100",
    decisionNumber: "2024/200",
    factSummary: "Aydınlatılmış rıza eksikliği.",
    legalReasoning: "Hastanenin yükümlülüğünü yerine getirmediği anlaşıldı.",
    outcome: "Tazminata hükmedildi.",
    relevanceNote: "'rıza' sağlık hukuku aramasıyla eşleşti; tam metin mevcut.",
    topicTags: [],
    fullText: "gerekçe tam metin mevcut",
    evidence: { source: court, documentId: `${court}:${id}`, retrievedAt: MOCK_RETRIEVED_AT, official: true as const, fullText: true }
  };
}

function makeOkResult(decisions: object[], source: "yargitay" | "danistay") {
  return {
    status: "ok" as const,
    source: source === "yargitay" ? "yargitay.gov.tr" : "danistay.gov.tr",
    query: "test",
    searchResultsCount: decisions.length,
    selectedResult: null,
    decisions,
    sourceTraces: []
  };
}

function makeUnavailableResult(source: "yargitay" | "danistay") {
  return {
    status: "unavailable" as const,
    source: source === "yargitay" ? "yargitay.gov.tr" : "danistay.gov.tr",
    errorCode: "source_error" as const,
    message: "network error",
    retryable: true,
    recommendedNextStep: "Retry."
  };
}

function makeService(overrides: { yargitayDecisions?: object[]; danistayDecisions?: object[]; yargitayFails?: boolean; danistayFails?: boolean } = {}) {
  const liveYargitay = new LiveYargitayAdapter({ wait: async () => undefined });
  const liveDanistay = new LiveDanistayAdapter({ wait: async () => undefined });

  if (overrides.yargitayFails) {
    vi.spyOn(liveYargitay, "searchAndNormalize").mockResolvedValue(makeUnavailableResult("yargitay") as never);
  } else {
    vi.spyOn(liveYargitay, "searchAndNormalize").mockResolvedValue(
      makeOkResult(overrides.yargitayDecisions ?? [makeUsableDecision("y1", "yargitay")], "yargitay") as never
    );
  }

  if (overrides.danistayFails) {
    vi.spyOn(liveDanistay, "searchAndNormalize").mockResolvedValue(makeUnavailableResult("danistay") as never);
  } else {
    vi.spyOn(liveDanistay, "searchAndNormalize").mockResolvedValue(
      makeOkResult(overrides.danistayDecisions ?? [makeUsableDecision("d1", "danistay")], "danistay") as never
    );
  }

  return new DoktorMcpInformationService({ liveYargitay, liveDanistay });
}

describe("multi-source precedent live mode", () => {
  it("calls both yargitay and danistay adapters in live mode by default", async () => {
    const service = makeService();
    const yargitaySpy = vi.spyOn((service as unknown as { liveYargitay: LiveYargitayAdapter }).liveYargitay, "searchAndNormalize");
    const danistаySpy = vi.spyOn((service as unknown as { liveDanistay: LiveDanistayAdapter }).liveDanistay, "searchAndNormalize");

    const { decisions } = await service.searchPrecedents(
      { question: "rıza", dimensions: [], searchTerms: ["riza"], missingInformation: [] },
      "live"
    );

    expect(decisions.length).toBeGreaterThanOrEqual(0);
    // Both adapters were wired via makeService — confirm decisions come from both courts
    const courts = decisions.map((d) => d.court);
    expect(courts).toContain("yargitay");
    expect(courts).toContain("danistay");
    // Confirm both adapters were called
    expect(yargitaySpy).toHaveBeenCalled();
    expect(danistаySpy).toHaveBeenCalled();
  });

  it("when yargitay is unavailable, danistay decisions are still returned", async () => {
    const service = makeService({ yargitayFails: true });

    const { decisions, sourceResults } = await service.searchPrecedents(
      { question: "rıza", dimensions: [], searchTerms: ["riza"], missingInformation: [] },
      "live"
    );

    const courts = decisions.map((d) => d.court);
    expect(courts).toContain("danistay");
    expect(courts).not.toContain("yargitay");

    const yargitaySummary = sourceResults.find((sr) => sr.source === "yargitay");
    expect(yargitaySummary?.unavailable).toBe(true);
  });

  it("when danistay is unavailable, yargitay decisions are still returned", async () => {
    const service = makeService({ danistayFails: true });

    const { decisions, sourceResults } = await service.searchPrecedents(
      { question: "rıza", dimensions: [], searchTerms: ["riza"], missingInformation: [] },
      "live"
    );

    const courts = decisions.map((d) => d.court);
    expect(courts).toContain("yargitay");
    expect(courts).not.toContain("danistay");

    const danistаySummary = sourceResults.find((sr) => sr.source === "danistay");
    expect(danistаySummary?.unavailable).toBe(true);
  });

  it("precedentSources parameter limits which sources are queried", async () => {
    const service = makeService();
    const { sourceResults } = await service.searchPrecedents(
      { question: "rıza", dimensions: [], searchTerms: ["riza"], missingInformation: [] },
      "live",
      ["yargitay"]
    );

    expect(sourceResults.map((sr) => sr.source)).toContain("yargitay");
    expect(sourceResults.map((sr) => sr.source)).not.toContain("danistay");
  });

  it("does not fall back to mock AYM in live mode", async () => {
    const service = makeService();
    const defaults = await service.searchPrecedents(
      { question: "riza", dimensions: [], searchTerms: ["riza"], missingInformation: [] },
      "live"
    );
    const explicitAym = await service.searchPrecedents(
      { question: "riza", dimensions: [], searchTerms: ["riza"], missingInformation: [] },
      "live",
      ["aym"]
    );

    expect(defaults.sourceResults.map((sr) => sr.source)).not.toContain("aym");
    expect(explicitAym.decisions).toEqual([]);
    expect(explicitAym.sourceResults).toEqual([
      expect.objectContaining({ source: "aym", mode: "disabled", unavailable: true, errorCodes: ["live_not_supported"] })
    ]);
  });

  it("sourceSummaries in diagnostics reflect per-source counts", async () => {
    const service = makeService();
    const pack = await service.prepareInformationPack({ question: "aydınlatılmış rıza", sourceMode: "live" });

    expect(pack.precedentDiagnostics).toBeDefined();
    const summaries = pack.precedentDiagnostics!.sourceSummaries;
    expect(summaries.length).toBeGreaterThan(0);

    const yargitaySummary = summaries.find((s) => s.source === "yargitay");
    expect(yargitaySummary).toBeDefined();
    expect(yargitaySummary!.mode).toBe("live");
    expect(yargitaySummary!.searched).toBe(true);
  });

  it("only precedent_usable decisions appear in verifiedHighCourtPrecedents", async () => {
    const service = makeService({
      yargitayDecisions: [
        makeUsableDecision("usable", "yargitay"),
        {
          id: "yargitay:no-text",
          court: "yargitay",
          topicTags: [],
          evidence: { source: "yargitay", documentId: "yargitay:no-text", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: false }
        }
      ]
    });

    const pack = await service.prepareInformationPack({ question: "rıza", sourceMode: "live" });
    const ids = pack.verifiedHighCourtPrecedents.map((p) => p.sourceDocumentId);
    expect(ids).toContain("yargitay:usable");
    expect(ids).not.toContain("yargitay:no-text");
  });

  it("mock mode returns decisions from all three mock adapters with sourceSummaries", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "rıza", sourceMode: "mock" });

    expect(pack.precedentDiagnostics).toBeDefined();
    const summaries = pack.precedentDiagnostics!.sourceSummaries;
    const sources = summaries.map((s) => s.source);
    expect(sources).toContain("yargitay");
    expect(sources).toContain("danistay");
    expect(sources).toContain("aym");
    summaries.forEach((s) => expect(s.mode).toBe("mock"));
  });
});
