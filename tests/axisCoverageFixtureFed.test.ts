import { describe, expect, it } from "vitest";
import { loadAxisFixture, buildReplayCache } from "../src/fixtureReplay.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

/**
 * T36.6 — Eksen kapsama report: fixture-fed pipeline validation
 *
 * Verifies that for the core disiplin axis, the fixture-fed pipeline 
 * produces the expected primary legislation. This validates that the
 * axis coverage report (T35.4) works correctly with fixture-fed adapters.
 */
describe("T36.6 — Eksen kapsama fixture-fed dogrulama", () => {
  it("disiplin: beklenen birincil mevzuat karsilastirmasi dogru", async () => {
    const fixture = loadAxisFixture("disiplin");
    const cache = buildReplayCache(fixture);
    const adapter = new LiveOfficialLegislationAdapter({ docCache: cache, wait: async () => {} });
    const result = await adapter.getMappedHealthProvisions(fixture.question);

    expect(result.status).toBe("ok");
    expect(result.provisions.length).toBeGreaterThanOrEqual(1);

    // Compare expected vs actual legislation
    const actualIds = result.provisions.map((p) => p.documentId ?? "");
    const expectedNames = fixture.expectedPrimaryLegislation.map((n) => n.toLowerCase());
    
    const allText = result.provisions.map((p) => (p.verbatimText ?? "").toLowerCase()).join(" ");
    const matched = expectedNames.filter((name) => {
      const fragments = name.split(/\s+/).filter((w: string) => w.length > 4);
      return fragments.some((f: string) => allText.includes(f)) || allText.includes(name.slice(0, 10));
    });

    // At least 1 expected legislation should match
    expect(matched.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("fixture-fed results are consistent across multiple runs", async () => {
    const fixture = loadAxisFixture("disiplin");
    const cache = buildReplayCache(fixture);
    const adapter = new LiveOfficialLegislationAdapter({ docCache: cache, wait: async () => {} });
    
    const result1 = await adapter.getMappedHealthProvisions(fixture.question);
    const result2 = await adapter.getMappedHealthProvisions(fixture.question);
    
    expect(result1.status).toBe("ok");
    expect(result2.status).toBe("ok");
    // Deterministic: same input → same count
    expect(result1.provisions.length).toBe(result2.provisions.length);
  }, 15000);
});
