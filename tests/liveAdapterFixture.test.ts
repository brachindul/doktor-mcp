import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { LiveYargitayAdapter } from "../src/sources/yargitay/liveYargitayAdapter.js";
import { LiveDanistayAdapter } from "../src/sources/danistay/liveDanistayAdapter.js";

const FIXTURES_DIR = join(process.cwd(), "fixtures", "live-samples");
const MOCK_RETRIEVED_AT = "2026-05-22T00:00:00.000Z";

/**
 * Full text HTML with GEREKÇE/SONUÇ so the decision passes eligibility
 * checks (precedent_usable rather than procedural_only or metadata_only).
 */
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

/**
 * Transform raw fixture items (ID, BIRIMI, ESAS_YILI, ...) into
 * Bedesten emsal-karar search API response format that
 * `normalizeBedestenSearchResponse` can parse.
 */
function fixtureToBedestenSearchResponse(fixture: { data: Array<Record<string, unknown>> }) {
  return {
    data: {
      emsalKararList: fixture.data.map((item) => ({
        documentId: String(item.ID ?? ""),
        itemType: { name: "YARGITAYKARARI", description: "Yargıtay Kararı" },
        birimAdi: String(item.BIRIMI ?? ""),
        esasNo: `${item.ESAS_YILI}/${item.ESAS_SIRASI}`,
        kararNo: `${item.KARAR_YILI}/${item.KARAR_SIRASI}`,
        kararTarihi: String(item.KARAR_TARIHI ?? ""),
        ozet: String(item.OZET ?? "")
      }))
    }
  };
}

/**
 * Transform raw fixture items into the Danistay search API response format
 * that `liveDanistayAdapter` expects: `{ data: { data: [...], recordsFiltered: N } }`.
 *
 * The adapter reads `rawData?.data?.data` for items and expects camelCase
 * field names: `id`, `daireKurul`, `esasNo`, `kararNo`, `kararTarihi`.
 */
function fixtureToDanistaySearchResponse(fixture: { data: Array<Record<string, unknown>> }) {
  return {
    data: {
      data: fixture.data.map((item) => ({
        id: String(item.ID ?? ""),
        daireKurul: String(item.DAIRESI ?? ""),
        esasNo: `${item.ESAS_YILI}/${item.ESAS_SIRASI}`,
        kararNo: `${item.KARAR_YILI}/${item.KARAR_SIRASI}`,
        kararTarihi: String(item.KARAR_TARIHI ?? ""),
        arananKelime: String(item.OZET ?? "")
      })),
      recordsFiltered: fixture.data.length
    }
  };
}

/**
 * Build a mock fetch for Yargitay that serves fixture data for search
 * and returns reasoned full text for each document content request.
 */
function makeYargitayFixtureFetch(bedestenSearchResponse: unknown) {
  let callCount = 0;
  return vi.fn(async (url: string) => {
    callCount++;
    const urlStr = String(url);

    if (urlStr.includes("searchDocuments")) {
      return new Response(JSON.stringify(bedestenSearchResponse), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (urlStr.includes("getDocumentContent")) {
      return new Response(JSON.stringify({
        data: {
          content: Buffer.from(REASONED_FULL_TEXT).toString("base64"),
          mimeType: "text/html"
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

/**
 * Build a mock fetch for Danistay that serves fixture data for search
 * and returns reasoned full text HTML for each document request.
 */
function makeDanistayFixtureFetch(danistaySearchResponse: unknown) {
  return vi.fn(async (url: string) => {
    const urlStr = String(url);

    if (urlStr.includes("aramalist")) {
      return new Response(JSON.stringify(danistaySearchResponse), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (urlStr.includes("getDokuman")) {
      return new Response(REASONED_FULL_TEXT, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

describe("Live adapter fixture integration tests", () => {
  let yargitayFixture: { data: Array<Record<string, unknown>> };
  let danistayFixture: { data: Array<Record<string, unknown>> };

  beforeAll(() => {
    yargitayFixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "yargitay-synthetic.json"), "utf-8")
    );
    danistayFixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "danistay-synthetic.json"), "utf-8")
    );
  });

  // ─── Yargitay adapter with fixture ──────────────────────────────────────────

  describe("Yargitay adapter with fixture", () => {
    it("parses fixture response and returns normalized decisions with ok status", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");

      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      expect(result.source).toBe("yargitay.gov.tr");
      expect(result.query).toBe("aydınlatılmış rıza");
      expect(result.searchResultsCount).toBe(yargitayFixture.data.length);
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it("produces decisions with correct court and document IDs", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const firstFixtureItem = yargitayFixture.data[0]!;
      const firstDecision = result.decisions[0]!;

      expect(firstDecision.court).toBe("yargitay");
      expect(firstDecision.id).toBe(`yargitay:${firstFixtureItem.ID}`);
      expect(firstDecision.evidence.documentId).toBe(String(firstFixtureItem.ID));
      expect(firstDecision.evidence.source).toBe("yargitay");
      expect(firstDecision.evidence.official).toBe(true);
    });

    it("extracts chamber and merits number from fixture data", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const firstDecision = result.decisions[0]!;
      expect(firstDecision.chamber).toBe("4. Hukuk Dairesi");
      expect(firstDecision.meritsNumber).toBe("2022/1234");
      expect(firstDecision.decisionNumber).toBe("2023/5678");
    });

    it("retrieves full text and marks fullTextAvailable on trace", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const trace = result.sourceTraces[0]!;
      expect(trace.fullTextAvailable).toBe(true);
      expect(trace.fullTextRetrievalMethod).toBe("bedesten-base64-html");
      expect(trace.retrievedAt).toBe(MOCK_RETRIEVED_AT);
    });

    it("marks reasoned decision as precedent_usable", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const trace = result.sourceTraces[0]!;
      expect(trace.eligibilityStatus).toBe("precedent_usable");
      expect(trace.eligibilityReasons).toContain("Emsal olarak kullanılabilir.");
      expect(trace.exclusionReasons).toHaveLength(0);
    });

    it("includes provenance metadata on decisions", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const decision = result.decisions[0]!;
      expect(decision.provenance).toBeDefined();
      expect(decision.provenance!.length).toBe(1);
      expect(decision.provenance![0].source).toBe("yargitay");
      expect(decision.provenance![0].fetchStatus).toBe("full_text_fetched");
      expect(decision.provenance![0].contentStatus).toBeDefined();
    });

    it("populates searchRequest in source trace", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const trace = result.sourceTraces[0]!;
      expect(trace.searchRequest).toEqual(expect.objectContaining({
        url: expect.stringContaining("searchDocuments"),
        phrase: "aydınlatılmış rıza"
      }));
      expect(trace.searchResultsCount).toBe(yargitayFixture.data.length);
    });

    it("returns unavailable with parse_failed when JSON content type has invalid JSON", async () => {
      const fetchImpl = vi.fn(async () => new Response("not valid json {{{", {
        status: 200,
        headers: { "content-type": "application/json" }
      }));
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("unavailable");
      if (result.status !== "unavailable") return;
      expect(result.errorCode).toBe("parse_failed");
    });

    it("handles non-JSON content type returning ok with empty results", async () => {
      // HttpClient returns raw text for non-JSON content type; normalizer treats it as empty
      const fetchImpl = vi.fn(async () => new Response("<html>Error page</html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      }));
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.searchResultsCount).toBe(0);
      expect(result.decisions).toHaveLength(0);
    });

    it("all fetch calls are intercepted by mock (no real network traffic)", async () => {
      const bedestenResponse = fixtureToBedestenSearchResponse(yargitayFixture);
      const fetchImpl = makeYargitayFixtureFetch(bedestenResponse);
      const adapter = new LiveYargitayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("aydınlatılmış rıza");
      expect(result.status).toBe("ok");

      // Mock was called — proving all network calls were intercepted
      expect(fetchImpl).toHaveBeenCalled();
      // All calls returned successfully (result is ok with decisions)
      expect(result.decisions.length).toBeGreaterThan(0);
    });
  });

  // ─── Danistay adapter with fixture ──────────────────────────────────────────

  describe("Danistay adapter with fixture", () => {
    it("parses fixture response and returns normalized decisions with ok status", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");

      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      expect(result.source).toBe("danistay.gov.tr");
      expect(result.query).toBe("sağlık hizmet kusuru");
      expect(result.searchResultsCount).toBe(danistayFixture.data.length);
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it("produces decisions with correct court and document IDs", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const firstFixtureItem = danistayFixture.data[0]!;
      const firstDecision = result.decisions[0]!;

      expect(firstDecision.court).toBe("danistay");
      expect(firstDecision.id).toBe(`danistay:${firstFixtureItem.ID}`);
      expect(firstDecision.evidence.source).toBe("danistay");
      expect(firstDecision.evidence.official).toBe(true);
    });

    it("extracts chamber from fixture DAIRESI field", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const firstDecision = result.decisions[0]!;
      expect(firstDecision.chamber).toBe("2. Daire");
    });

    it("retrieves full text and marks fullTextAvailable on trace", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const trace = result.sourceTraces[0]!;
      expect(trace.fullTextAvailable).toBe(true);
      expect(trace.fullTextRetrievalMethod).toBe("html-text");
      expect(trace.retrievedAt).toBe(MOCK_RETRIEVED_AT);
    });

    it("marks reasoned decision as precedent_usable", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const trace = result.sourceTraces[0]!;
      expect(trace.eligibilityStatus).toBe("precedent_usable");
      expect(trace.eligibilityReasons).toContain("Emsal olarak kullanılabilir.");
      expect(trace.exclusionReasons).toHaveLength(0);
    });

    it("includes provenance metadata on decisions", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const decision = result.decisions[0]!;
      expect(decision.provenance).toBeDefined();
      expect(decision.provenance!.length).toBe(1);
      expect(decision.provenance![0].source).toBe("danistay");
      expect(decision.provenance![0].fetchStatus).toBe("full_text_fetched");
    });

    it("populates searchRequest in source trace", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      const trace = result.sourceTraces[0]!;
      expect(trace.searchRequest).toEqual(expect.objectContaining({
        url: expect.stringContaining("aramalist"),
        phrase: "sağlık hizmet kusuru"
      }));
      expect(trace.searchResultsCount).toBe(danistayFixture.data.length);
    });

    it("handles non-JSON search response gracefully as unavailable", async () => {
      const fetchImpl = vi.fn(async () => new Response("<html><body>Captcha</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      }));
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("unavailable");
      if (result.status !== "unavailable") return;
      expect(result.errorCode).toBe("parse_failed");
    });

    it("all fetch calls are intercepted by mock (no real network traffic)", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");

      // Mock was called — proving all network calls were intercepted
      expect(fetchImpl).toHaveBeenCalled();
      // All calls returned successfully (result is ok with decisions)
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it("processes all fixture items up to MAX_RESULTS_PER_QUERY", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      const result = await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      // Fixture has 2 items; MAX_RESULTS_PER_QUERY is 5, so all should be included
      expect(result.decisions.length).toBe(danistayFixture.data.length);
      expect(result.sourceTraces.length).toBe(danistayFixture.data.length);
    });

    it("sets lastRequestTelemetry.timedOut=false on successful fixture search", async () => {
      const danistayResponse = fixtureToDanistaySearchResponse(danistayFixture);
      const fetchImpl = makeDanistayFixtureFetch(danistayResponse);
      const adapter = new LiveDanistayAdapter({
        fetchImpl,
        now: () => new Date(MOCK_RETRIEVED_AT),
        wait: async () => undefined
      });

      await adapter.searchAndNormalize("sağlık hizmet kusuru");
      expect(adapter.lastRequestTelemetry.timedOut).toBe(false);
    });
  });
});
