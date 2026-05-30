/**
 * T7.2: Live-mode recorded-fixture test for health-primary legislation priority.
 *
 * Diagnosed and FIXED the root cause: Hasta Hakları patient_privacy hint now includes
 * "kişisel sağlık verisi", "sağlık verisi", "saglik verisi", "kisisel saglik verisi"
 * so that health-data-privacy queries match BOTH Hasta Hakları AND KVKK, with
 * Hasta Hakları receiving higher priority (health_primary, 16 vs supporting_general, 90).
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { healthLegislationHints } from "../src/sources/legislation/healthMappings.ts";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.ts";

const FIXTURES_DIR = join(process.cwd(), "fixtures", "live-samples");
const HHY_SOURCE_ID = "mevzuat:7.5.4847";
const KVKK_SOURCE_ID = "mevzuat:1.5.6698";

function matchingHints(query: string): typeof healthLegislationHints {
  const normalized = query.toLocaleLowerCase("tr-TR");
  const matches = healthLegislationHints.filter((hint) =>
    hint.terms.some((term) => normalized.includes(term.toLocaleLowerCase("tr-TR")))
  );
  const combined = new Map<string, (typeof healthLegislationHints)[number]>();
  for (const hint of matches.sort((a, b) => a.healthLawPriority - b.healthLawPriority)) {
    const current = combined.get(hint.sourceId);
    if (!current) {
      combined.set(hint.sourceId, { ...hint, articleNumbers: [...hint.articleNumbers], terms: [...hint.terms] });
      continue;
    }
    current.articleNumbers = [...new Set([...current.articleNumbers, ...hint.articleNumbers])];
    current.terms = [...new Set([...current.terms, ...hint.terms])];
  }
  return [...combined.values()].sort((a, b) => a.healthLawPriority - b.healthLawPriority);
}

describe("live health-primary legislation priority (recorded fixture)", () => {
  describe("mapping fix verification", () => {
    it("Hasta Hakları patient_privacy hint NOW includes 'kişisel sağlık verisi' terms (T7.2 fix applied)", () => {
      const hyyPrivacyHints = healthLegislationHints.filter(
        (h) => h.sourceId === HHY_SOURCE_ID && h.topicCluster === "patient_privacy"
      );
      expect(hyyPrivacyHints.length).toBe(1);
      const terms = hyyPrivacyHints[0].terms;
      // Original terms still present
      expect(terms).toContain("mahremiyet");
      expect(terms).toContain("mahrem");
      expect(terms).toContain("hasta mahremiyeti");
      // FIX: These terms were ADDED to close the gap
      expect(terms).toContain("kişisel sağlık verisi");
      expect(terms).toContain("kisisel saglik verisi");
      expect(terms).toContain("sağlık verisi");
      expect(terms).toContain("saglik verisi");
    });

    it("KVKK personal_health_data hint still has its terms", () => {
      const kvkkHints = healthLegislationHints.filter(
        (h) => h.sourceId === KVKK_SOURCE_ID && h.topicCluster === "personal_health_data"
      );
      expect(kvkkHints.length).toBe(1);
      expect(kvkkHints[0].terms).toContain("kişisel sağlık verisi");
      expect(kvkkHints[0].terms).toContain("sağlık verisi");
    });

    it("query 'Hekim kişisel sağlık verisini izinsiz paylaştı' NOW matches BOTH — Hasta Hakları FIRST", () => {
      const query = "Hekim kişisel sağlık verisini izinsiz paylaştı";
      const matched = matchingHints(query);
      const matchedIds = matched.map((h) => h.sourceId);
      // Both should match now
      expect(matchedIds).toContain(HHY_SOURCE_ID);
      expect(matchedIds).toContain(KVKK_SOURCE_ID);
      // Hasta Hakları MUST be first (health_primary, priority 16 vs KVKK priority 90)
      const hyyIdx = matchedIds.indexOf(HHY_SOURCE_ID);
      const kvkkIdx = matchedIds.indexOf(KVKK_SOURCE_ID);
      expect(hyyIdx).toBeLessThan(kvkkIdx);
    });

    it("query 'Hekim hasta sağlık verisini üçüncü kişilerle paylaşabilir mi?' NOW matches both — Hasta Hakları FIRST", () => {
      const query = "Hekim hasta sağlık verisini üçüncü kişilerle paylaşabilir mi?";
      const matched = matchingHints(query);
      const matchedIds = matched.map((h) => h.sourceId);
      expect(matchedIds).toContain(HHY_SOURCE_ID);
      expect(matchedIds).toContain(KVKK_SOURCE_ID);
      const hyyIdx = matchedIds.indexOf(HHY_SOURCE_ID);
      const kvkkIdx = matchedIds.indexOf(KVKK_SOURCE_ID);
      expect(hyyIdx).toBeLessThan(kvkkIdx);
    });

    it("query 'kişisel sağlık verisi mahremiyet' matches BOTH — Hasta Hakları FIRST", () => {
      const query = "kişisel sağlık verisi mahremiyet";
      const matched = matchingHints(query);
      const matchedIds = matched.map((h) => h.sourceId);
      expect(matchedIds).toContain(HHY_SOURCE_ID);
      expect(matchedIds).toContain(KVKK_SOURCE_ID);
      const hyyIdx = matchedIds.indexOf(HHY_SOURCE_ID);
      const kvkkIdx = matchedIds.indexOf(KVKK_SOURCE_ID);
      expect(hyyIdx).toBeLessThan(kvkkIdx);
    });
  });

  describe("recorded fixture integrity", () => {
    it("fixture documents the root cause that was diagnosed and fixed", () => {
      const fixture = JSON.parse(
        readFileSync(join(FIXTURES_DIR, "legislation-privacy-search.json"), "utf-8")
      );
      expect(fixture.rootCause.kvkkHintSourceId).toBe(KVKK_SOURCE_ID);
      expect(fixture.rootCause.hyyHintSourceId).toBe(HHY_SOURCE_ID);
      expect(fixture.rootCause.hyyHintTopicCluster).toBe("patient_privacy");
      expect(fixture.rootCause.neededHyyTerms).toContain("kişisel sağlık verisi");
      expect(fixture.rootCause.neededHyyTerms).toContain("sağlık verisi");
    });

    it("fixture captures the fixed ordering: Hasta Hakları before KVKK for 'mahremiyet' query", () => {
      const fixture = JSON.parse(
        readFileSync(join(FIXTURES_DIR, "legislation-privacy-search.json"), "utf-8")
      );
      const q = fixture.queries.find((q: any) => q.query === "kişisel sağlık verisi mahremiyet");
      expect(q).toBeDefined();
      expect(q!.result.length).toBe(2);
      expect(q!.result[0].name).toBe("Hasta Haklari Yonetmeligi");
      expect(q!.result[0].role).toBe("health_primary");
      expect(q!.result[1].name).toBe("Kisisel Verilerin Korunmasi Kanunu");
    });
  });

  describe("live adapter with mocked fetch (recorded PDF fixtures)", () => {
    // Note: this test uses real PDF fixtures captured from mevzuat.gov.tr
    // but the mock fetch now includes Hasta Hakları by default (fix applied)
    const PDF_DIR = join(FIXTURES_DIR, "pdfs");

    function createMockFetch() {
      const kvkkSearchResponse = {
        data: [{
          mevzuatNo: "6698", mevzuatTur: 1, mevzuatTertip: "5",
          mevAdi: "Kişisel Verilerin Korunması Kanunu",
          url: "/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5",
        }],
      };
      const hhSearchResponse = {
        data: [{
          mevzuatNo: "4847", mevzuatTur: 7, mevzuatTertip: "5",
          mevAdi: "Hasta Hakları Yönetmeliği",
          url: "/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
        }],
      };

      return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("MevzuatDatatable")) {
          const bodyStr = typeof init?.body === "string" ? init.body : "";
          const reqBody = bodyStr ? JSON.parse(bodyStr) : {};
          const phrase = reqBody.parameters?.AranacakIfade
            ? Buffer.from(reqBody.parameters.AranacakIfade, "base64").toString("utf8")
            : "";
          // Return matching search results for both laws
          if (phrase.includes("Hasta Haklari") || phrase.includes("Hasta Hakları")) {
            return new Response(JSON.stringify(hhSearchResponse), {
              status: 200, headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify(kvkkSearchResponse), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        if (urlStr.includes("MevzuatMetin") || urlStr.includes("GeneratePdf")) {
          const isHHY = urlStr.includes("4847");
          const pdfBuffer = readFileSync(
            join(PDF_DIR, isHHY ? "hasta-haklari-4847.pdf" : "kvkk-6698.pdf")
          );
          return new Response(pdfBuffer, {
            status: 200, headers: { "content-type": "application/pdf" },
          });
        }
        return new Response("Not found", { status: 404 });
      });
    }

    it("live adapter NOW returns BOTH Hasta Hakları AND KVKK — Hasta Hakları FIRST (fix verified)", async () => {
      const adapter = new LiveOfficialLegislationAdapter({
        fetchImpl: createMockFetch(),
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        wait: async () => undefined,
      });
      const result = await adapter.getMappedHealthProvisions(
        "Hekim kişisel sağlık verisini izinsiz paylaştı"
      );
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      // Both laws should be returned now
      expect(result.provisions.length).toBe(2);
      const names = result.provisions.map((p) => p.legislationName);
      const roles = result.provisions.map(
        (p) => p.sourceTrace?.matchedHealthMapping?.legislationRole
      );
      const hyyIdx = names.findIndex((n) =>
        n.toLowerCase().includes("hasta hakla") || n.toLowerCase().includes("hasta hakları")
      );
      const kvkkIdx = names.findIndex((n) =>
        n.toLowerCase().includes("kişisel verilerin") || n.toLowerCase().includes("kisisel verilerin")
      );
      expect(hyyIdx).not.toBe(-1);
      expect(kvkkIdx).not.toBe(-1);
      expect(hyyIdx).toBeLessThan(kvkkIdx);
      expect(roles[hyyIdx]).toBe("health_primary");
      expect(roles[kvkkIdx]).toBe("supporting_general");
    });

    it("live adapter returns Hasta Hakları BEFORE KVKK when query contains 'mahremiyet'", async () => {
      const adapter = new LiveOfficialLegislationAdapter({
        fetchImpl: createMockFetch(),
        now: () => new Date("2026-05-30T00:00:00.000Z"),
        wait: async () => undefined,
      });
      const result = await adapter.getMappedHealthProvisions(
        "kişisel sağlık verisi mahremiyet"
      );
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.provisions.length).toBeGreaterThanOrEqual(2);
      const names = result.provisions.map((p) => p.legislationName);
      const hyyIdx = names.findIndex((n) =>
        n.toLowerCase().includes("hasta hakla") || n.toLowerCase().includes("hasta hakları")
      );
      const kvkkIdx = names.findIndex((n) =>
        n.toLowerCase().includes("kişisel verilerin") || n.toLowerCase().includes("kisisel verilerin")
      );
      expect(hyyIdx).not.toBe(-1);
      expect(kvkkIdx).not.toBe(-1);
      expect(hyyIdx).toBeLessThan(kvkkIdx);
    });
  });
});
