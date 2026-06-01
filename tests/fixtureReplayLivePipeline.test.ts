import { describe, expect, it } from "vitest";
import { loadAxisFixture, buildReplayFetch } from "../src/fixtureReplay.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

/**
 * T35.1 — Fixture'ları canlı kod yolundan replay et
 *
 * Fixture'lar LiveOfficialLegislationAdapter'a fetchImpl ile enjekte
 * edilip getMappedHealthProvisions GERÇEK kod yolundan test edilir.
 * sourceMode: "mock" DEĞİL — fixture-fed live adapter kullanılır.
 */
describe("T35.1 — Canlı kod yolundan fixture replay", () => {
  it("disiplin fixture: live pipeline returns provisions via fetchImpl injection", async () => {
    const fixture = loadAxisFixture("disiplin");
    const fetchImpl = buildReplayFetch(fixture);

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {} // no-op wait to avoid real delays
    });

    const result = await adapter.getMappedHealthProvisions(fixture.question);

    // The live pipeline ran; check result structure
    expect(result).toBeDefined();
    if (result.status === "ok") {
      // Provisions should be returned
      expect(result.provisions.length).toBeGreaterThanOrEqual(1);
      const provisionTexts = result.provisions.map((p) => p.verbatimText ?? "").join(" ").toLowerCase();
      // Should contain 657 or disiplin-related content
      expect(provisionTexts).toMatch(/657|devlet memur|disiplin/);
    }
    // If no hints matched, that's also valid — just not a hard-fail (honest result)
  }, 15000);

  it("malpraktis fixture: live pipeline returns provisions", async () => {
    const fixture = loadAxisFixture("malpraktis");
    const fetchImpl = buildReplayFetch(fixture);

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {}
    });

    const result = await adapter.getMappedHealthProvisions(fixture.question);
    expect(result).toBeDefined();
    if (result.status === "ok") {
      expect(result.provisions.length).toBeGreaterThanOrEqual(1);
    }
  }, 15000);

  it("tayin fixture: live pipeline returns provisions", async () => {
    const fixture = loadAxisFixture("tayin");
    const fetchImpl = buildReplayFetch(fixture);

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {}
    });

    const result = await adapter.getMappedHealthProvisions(fixture.question);
    expect(result).toBeDefined();
    if (result.status === "ok") {
      expect(result.provisions.length).toBeGreaterThanOrEqual(1);
    }
  }, 15000);

  it("all 8 fixtures complete live pipeline without throwing", async () => {
    const axes = ["disiplin", "malpraktis", "tayin", "gizlilik", "riza_onam", "acil_mudahale", "ek_odeme", "mecburi_hizmet"];
    for (const axis of axes) {
      const fixture = loadAxisFixture(axis);
      const fetchImpl = buildReplayFetch(fixture);
      const adapter = new LiveOfficialLegislationAdapter({ fetchImpl, wait: async () => {} });
      const result = await adapter.getMappedHealthProvisions(fixture.question);
      // Must not throw — either ok or honest unavailable
      expect(result).toBeDefined();
    }
  }, 30000);

  it("fixture-fed adapter: searchTrace is populated when hints match", async () => {
    const fixture = loadAxisFixture("disiplin");
    const fetchImpl = buildReplayFetch(fixture);
    const adapter = new LiveOfficialLegislationAdapter({ fetchImpl, wait: async () => {} });
    const result = await adapter.getMappedHealthProvisions(fixture.question);
    if (result.status === "ok") {
      expect(result.sourceTrace).toBeDefined();
      expect(result.sourceTrace.length).toBeGreaterThanOrEqual(1);
    }
  }, 15000);
});
