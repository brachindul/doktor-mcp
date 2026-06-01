import { describe, expect, it } from "vitest";
import { LegislationDocCache } from "../src/sources/legislationDocCache.js";

describe("T35.2 — Büyük statü PDF flakiness giderme", () => {
  const testSourceId = "mevzuat:1.5.657";
  const testText = "MADDE 125 – Disiplin cezaları düzenlenmiştir. Devlet memurlarına verilecek cezalar.";

  it("cache get returns null for non-existent key", async () => {
    const cache = new LegislationDocCache({ enabled: true });
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  it("cache set + get roundtrips document text", async () => {
    const cache = new LegislationDocCache({ enabled: true });
    await cache.set(testSourceId, testText);
    const result = await cache.get(testSourceId);
    expect(result).toBe(testText);
    expect(result).toContain("MADDE 125");
  });

  it("getOrFetch returns cached value when available", async () => {
    const cache = new LegislationDocCache({ enabled: true });
    await cache.set(testSourceId, testText);
    let fetchCalled = false;
    const result = await cache.getOrFetch(testSourceId, async () => {
      fetchCalled = true;
      return "fresh text";
    });
    expect(result).toBe(testText); // cached, not fresh
    expect(fetchCalled).toBe(false);
  });

  it("getOrFetch calls fetchFn when cache miss", async () => {
    const cache = new LegislationDocCache({ enabled: true });
    const uniqueId = "test-cache-miss-" + Date.now();
    let fetchCalled = false;
    const result = await cache.getOrFetch(uniqueId, async () => {
      fetchCalled = true;
      return "new text";
    });
    expect(result).toBe("new text");
    expect(fetchCalled).toBe(true);
    // Should now be cached
    const cached = await cache.get(uniqueId);
    expect(cached).toBe("new text");
  });

  it("cache can be disabled", async () => {
    const cache = new LegislationDocCache({ enabled: false });
    await cache.set(testSourceId, testText);
    const result = await cache.get(testSourceId);
    expect(result).toBeNull();
  });

  it("657 DMK cache entry survives multiple retrievals", async () => {
    const cache = new LegislationDocCache({ enabled: true });
    await cache.set(testSourceId, testText);
    // Multiple retrievals
    for (let i = 0; i < 3; i++) {
      const result = await cache.get(testSourceId);
      expect(result).toContain("MADDE 125");
    }
  });
});
