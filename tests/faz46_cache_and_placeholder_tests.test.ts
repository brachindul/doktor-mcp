import { describe, expect, it } from "vitest";
import { LegislationDocCache } from "../src/sources/legislationDocCache.js";
import { LiveOfficialLegislationAdapter, hintHasDirectSourceId } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";
import { healthLegislationHints } from "../src/sources/legislation/healthMappings.js";

/**
 * T46.1 — Cache yazımı (T35.2) için gerçek koruma testi
 * Verifies that getOrFetch caches correctly (callCount stays 1 on 2nd call).
 * Mutation "cache.set remove" would cause callCount=2 on 2nd call.
 */
describe("T46.1 — Cache yazımı koruma testi", () => {
  it("getOrFetch caches: fetchFn called only on first invocation", async () => {
    const cache = new LegislationDocCache({ enabled: true });
    const key = "t46-1-" + Date.now();
    let calls = 0;
    const r1 = await cache.getOrFetch(key, async () => { calls++; return "v1"; });
    const r2 = await cache.getOrFetch(key, async () => { calls++; return "v2"; });
    expect(r1).toBe("v1");
    expect(r2).toBe("v1"); // cached
    expect(calls).toBe(1); // mutation protection: if cache.set broken, calls=2
  });
});

/**
 * T46.2 — Placeholder hint filtresi (T35.5) koruma testi
 * Verifies that garbage/non-matching queries return unavailable without crash.
 * Mutation "disable hintHasDirectSourceId" changes behavior for placeholder hints.
 */
describe("T46.2 — Placeholder filtresi koruma", () => {
  it("hintHasDirectSourceId returns false for placeholder-like hints", () => {
    // Hint without coordinates is a placeholder
    const placeholder = { sourceId: "needs_manual_review:xyz", legislationNumber: undefined } as any;
    expect(hintHasDirectSourceId(placeholder)).toBe(false);

    // Hint with all three coordinates is valid for direct-fetch
    const valid = { sourceId: "mevzuat:1.5.657", legislationNumber: "657", legislationType: "1", legislationArrangement: "5" } as any;
    expect(hintHasDirectSourceId(valid)).toBe(true);

    // Hint missing one coordinate
    const partial = { sourceId: "mevzuat:1.5.657", legislationNumber: "657", legislationType: undefined, legislationArrangement: "5" } as any;
    expect(hintHasDirectSourceId(partial)).toBe(false);
  });

  it("all healthLegislationHints with mevzuat: sourceId have direct coordinates", () => {
    for (const hint of healthLegislationHints) {
      if (hint.sourceId.startsWith("mevzuat:")) {
        const hasCoords = Boolean(hint.legislationNumber && hint.legislationType && hint.legislationArrangement);
        expect(hasCoords).toBe(true);
      }
    }
  });
});

/**
 * T46.3 — Malpraktis terim eşlemesi koruma testi
 * Verifies that "malpraktis" query matches a deontology hint through
 * the real hint-matching path (no cache pre-population).
 * Mutation "remove malpraktis from terms" → no hint match → unavailable.
 */
describe("T46.3 — Malpraktis terim eşlemesi koruma", () => {
  // Canli mevzuat.gov.tr'ye gider; CI kosucularindan erisim guvenilmez (bkz. vitest.ci.config.ts).
  it.skipIf(process.env.CI === "true")("malpraktis query matches a hint via live adapter (hint-matching path)", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    const result = await adapter.getMappedHealthProvisions("malpraktis");
    // With malpraktis term present in Deontology hint terms, should match
    expect(result.status).toBe("ok");
    expect(result.provisions.length).toBeGreaterThanOrEqual(1);
  }, 30000);
});
