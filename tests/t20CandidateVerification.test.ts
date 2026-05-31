import { describe, expect, it } from "vitest";
import { HEALTH_LEGISLATION_INVENTORY } from "../src/healthLegislationInventory.js";
import { healthLegislationHints } from "../src/sources/legislation/healthMappings.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

const VERIFIED_CANDIDATES = [
  { key: "tuey-uzmanlik-egitimi", sourceId: "mevzuat:7.5.39700", query: "tıpta uzmanlık eğitimi" },
  { key: "umumi-hifzissihha-kanunu", sourceId: "mevzuat:1.3.1593", query: "umumi hıfzıssıhha" },
  { key: "657-dmk", sourceId: "mevzuat:1.5.657", query: "devlet memurları kanunu" },
  { key: "tck-5237", sourceId: "mevzuat:1.5.5237", query: "türk ceza kanunu" }
];

describe("T20.1 — candidate inventory live verification sweep", () => {
  it("all 4 verified candidates are now covered in the inventory", () => {
    for (const { key, sourceId } of VERIFIED_CANDIDATES) {
      const entry = HEALTH_LEGISLATION_INVENTORY.find(e => e.key === key);
      expect(entry).toBeDefined();
      expect(entry!.coverageStatus).toBe("covered");
      expect(entry!.officialSourceStatus).toBe("verified");
      expect(entry!.mevzuatSourceId).toBe(sourceId);
      expect(entry!.officialUrl).toContain("mevzuat.gov.tr");
    }
  });

  it("covered count increased by 4 (12 → 16)", () => {
    const covered = HEALTH_LEGISLATION_INVENTORY.filter(e => e.coverageStatus === "covered").length;
    expect(covered).toBe(16);
  });

  it("healthLegislationHints uses real sourceIds for the 4 verified candidates", () => {
    for (const { sourceId } of VERIFIED_CANDIDATES) {
      const hint = healthLegislationHints.find(h => h.sourceId === sourceId);
      expect(hint).toBeDefined();
      expect(hint!.sourceId).not.toContain("needs_manual_review");
    }
  });

  it.each(VERIFIED_CANDIDATES)(
    "live direct-fetch fast path returns provisions for $sourceId ($key)",
    async ({ query }) => {
      const adapter = new LiveOfficialLegislationAdapter();
      const result = await adapter.getMappedHealthProvisions(query);
      expect(result.status).toBe("ok");
      expect(result.provisions.length).toBeGreaterThan(0);
      expect(result.sourceTrace.length).toBeGreaterThan(0);
      const trace = result.sourceTrace[0];
      expect(trace.selectedResultReason).toContain("direct-fetch fast path");
    },
    60_000
  );

  it.each(VERIFIED_CANDIDATES)(
    "live fetchOfficialDocument returns text for $sourceId ($key)",
    async ({ sourceId }) => {
      const adapter = new LiveOfficialLegislationAdapter();
      const doc = await adapter.fetchOfficialDocument(sourceId, { sourceName: "mevzuat.gov.tr" });
      expect(doc).toBeDefined();
      expect(typeof (doc as any).text).toBe("string");
      expect((doc as any).text.length).toBeGreaterThan(1000);
    },
    30_000
  );
});
