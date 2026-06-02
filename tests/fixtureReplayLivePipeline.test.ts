import { describe, expect, it } from "vitest";
import { loadAxisFixture, buildReplayCache, buildReplayFetch } from "../src/fixtureReplay.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";
import { LegislationDocCache } from "../src/sources/legislationDocCache.js";

/**
 * T36.1 + T36.2 — Canlı kod yolundan fixture replay (HARD-ASSERT)
 *
 * Uses buildReplayCache to pre-populate the LegislationDocCache,
 * injected into LiveOfficialLegislationAdapter. getDocument retrieves
 * from cache, bypassing PDF fetch entirely. Full pipeline: hint match →
 * getDocument (cache hit) → extractArticles → rankExtracted → provisions.
 *
 * All assertions are HARD: no `if (status === "ok")` guard.
 */
const CORE_AXES = ["disiplin", "tayin", "gizlilik"] as const; // axes with matching hints

describe("T36.1 — Fixture-fed live pipeline via cache injection", () => {
  for (const axis of CORE_AXES) {
    it(`${axis}: cache-fed pipeline returns status "ok" with provisions`, async () => {
      const fixture = loadAxisFixture(axis);
      const cache = buildReplayCache(fixture);
      const adapter = new LiveOfficialLegislationAdapter({
        docCache: cache,
        wait: async () => {}
      });

      const result = await adapter.getMappedHealthProvisions(fixture.question);

      // HARD ASSERT: status must be "ok"
      expect(result.status).toBe("ok");
      expect(result.provisions.length).toBeGreaterThanOrEqual(1);

      // HARD ASSERT: expected primary legislation must appear in provisions
      const allText = result.provisions
        .map((p) => p.verbatimText ?? "")
        .join(" ")
        .toLowerCase();
      
      for (const law of fixture.expectedPrimaryLegislation) {
        const lawFragments = law.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
        const found = lawFragments.some((f: string) => allText.includes(f)) ||
                       allText.includes(law.toLowerCase().slice(0, 10));
        expect(found).toBe(true);
      }
    }, 15000);
  }
});

describe("T36.2 — HARD-FAIL assertions (no guard)", () => {
  it("disiplin: status is ok, provisions contain 657 DMK content", async () => {
    const fixture = loadAxisFixture("disiplin");
    const cache = buildReplayCache(fixture);
    const adapter = new LiveOfficialLegislationAdapter({ docCache: cache, wait: async () => {} });
    const result = await adapter.getMappedHealthProvisions(fixture.question);

    expect(result.status).toBe("ok");
    expect(result.provisions.length).toBeGreaterThanOrEqual(1);
    const text = result.provisions.map((p) => p.verbatimText ?? "").join(" ");
    expect(text).toMatch(/657|devlet memur|disiplin/i);
  }, 15000);

  it("sourceTrace populated", async () => {
    const fixture = loadAxisFixture("disiplin");
    const cache = buildReplayCache(fixture);
    const adapter = new LiveOfficialLegislationAdapter({ docCache: cache, wait: async () => {} });
    const result = await adapter.getMappedHealthProvisions(fixture.question);
    expect(result.sourceTrace.length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
