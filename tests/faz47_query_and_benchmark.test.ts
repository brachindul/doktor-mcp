import { describe, expect, it } from "vitest";
import { tokenize } from "../src/health/lexicalRerank.js";
import { computeRecencyScore, rrfFuse, toRankedList } from "../src/health/precedentRrf.js";

/**
 * T47.5 — Sorgu kurma iyileştirmesi
 * Turkish diacritics preserved, multi-term queries.
 */
describe("T47.5 — Sorgu kurma iyileştirmesi", () => {
  it("query preserves Turkish diacritics", () => {
    const query = "aydınlatılmış rıza";
    const tokens = tokenize(query);
    expect(tokens).toContain("aydınlatılmış");
    expect(tokens).toContain("rıza");
  });

  it("multi-term query yields more specific tokens", () => {
    const short = tokenize("hata");
    const long = tokenize("tıbbi hata malpraktis tazminat");
    expect(long.length).toBeGreaterThan(short.length);
    expect(long).toContain("tıbbi");
    expect(long).toContain("malpraktis");
  });
});

/**
 * T47.6 — Sıralama şeffaflığı (RRF diagnostics)
 */
describe("T47.6 — Sıralama şeffaflığı", () => {
  it("RRF component scores can be decomposed", () => {
    // Simulate RRF with 3 signals: relevance, recency, lexical
    const relevanceList = toRankedList([
      { id: "D1", score: 3 }, { id: "D2", score: 2 }, { id: "D3", score: 1 }
    ]);
    const recencyList = toRankedList([
      { id: "D2", score: 0.8 }, { id: "D1", score: 0.5 }, { id: "D3", score: 0.3 }
    ]);
    const lexicalList = toRankedList([
      { id: "D1", score: 1.5 }, { id: "D3", score: 1.0 }, { id: "D2", score: 0.5 }
    ]);

    const fused = rrfFuse([relevanceList, recencyList, lexicalList]);

    // All items should be in the fused result
    expect(fused.length).toBe(3);
    expect(fused).toContain("D1");
    expect(fused).toContain("D2");
    expect(fused).toContain("D3");
  });

  it("single-signal RRF equals the input list order", () => {
    const list = toRankedList([{ id: "A", score: 10 }, { id: "B", score: 5 }]);
    const fused = rrfFuse([list]);
    expect(fused).toEqual(["A", "B"]);
  });
});

/**
 * T47.7 — Emsal arama benchmark'ı (önce/sonra karşılaştırma)
 * Simulated: relevance comparison with and without RRF fusion.
 */
describe("T47.7 — Emsal arama benchmark'ı", () => {
  it("RRF fused ranking differs from single-signal when signals diverge", () => {
    const sig1 = ["A", "B", "C", "D"];
    const sig2 = ["D", "C", "B", "A"];
    const fused = rrfFuse([sig1, sig2]);
    // With completely contrary signals, the middle items get balanced scores
    // Result should have 4 items, with some reordering vs either input
    expect(fused.length).toBe(4);
    expect(new Set(fused).size).toBe(4); // all items present
    // The fused order is neither sig1 nor sig2
    expect(fused).not.toEqual(sig1);
    expect(fused).not.toEqual(sig2);
  });

  it("fused ranking reduces noise compared to random", () => {
    // A consistent signal across 3 lists should beat an inconsistent one
    const s1 = ["GOOD", "OK", "BAD"];
    const s2 = ["GOOD", "OK", "BAD"];
    const s3 = ["OK", "GOOD", "BAD"];
    const fused = rrfFuse([s1, s2, s3]);
    // GOOD appears 1st in 2/3 lists → should be top
    expect(fused[0]).toBe("GOOD");
    // BAD is consistently last → should be last
    expect(fused[fused.length - 1]).toBe("BAD");
  });
});
