import { describe, expect, it } from "vitest";
import { rrfFuse, toRankedList, computeRecencyScore, computeQuoteSafeBoost } from "../src/health/precedentRrf.js";
import { tokenize, computeLexicalScore } from "../src/health/lexicalRerank.js";

/**
 * T47.2 — RRF fusion tests
 */
describe("T47.2 — RRF çok-sinyalli sıralama", () => {
  it("basic RRF fuses two ranked lists", () => {
    const list1 = ["A", "B", "C"];
    const list2 = ["B", "A", "D"];
    const result = rrfFuse([list1, list2]);
    // B appears 1st in list2 (rank 0) and 2nd in list1 (rank 1) → high RRF
    // A appears 1st in list1 (rank 0) and 2nd in list2 (rank 1) → high RRF
    // Both A and B should be top
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toMatch(/A|B/);
  });

  it("RRF handles empty lists", () => {
    const result = rrfFuse([[], ["A", "B"]]);
    expect(result).toEqual(["A", "B"]);
  });

  it("RRF handles single list", () => {
    const result = rrfFuse([["X", "Y", "Z"]]);
    expect(result).toEqual(["X", "Y", "Z"]);
  });

  it("toRankedList sorts by score descending", () => {
    const list = toRankedList([
      { id: "low", score: 0.1 },
      { id: "high", score: 0.9 },
      { id: "mid", score: 0.5 }
    ]);
    expect(list).toEqual(["high", "mid", "low"]);
  });
});

/**
 * T47.3 — Recency + quote-safe boost tests
 */
describe("T47.3 — Recency sinyali", () => {
  it("recent decision scores higher than old", () => {
    const recent = computeRecencyScore("2025-01-01", 2026);
    const old = computeRecencyScore("2015-01-01", 2026);
    expect(recent).toBeGreaterThan(old);
  });

  it("unknown date returns neutral 0.5", () => {
    expect(computeRecencyScore(null)).toBe(0.5);
    expect(computeRecencyScore(undefined)).toBe(0.5);
  });

  it("quote-safe boost rewards usable+reasoned", () => {
    const full = computeQuoteSafeBoost(true, true);
    const usable = computeQuoteSafeBoost(true, false);
    const none = computeQuoteSafeBoost(false, false);
    expect(full).toBeGreaterThan(usable);
    expect(usable).toBeGreaterThan(none);
    expect(none).toBe(1.0);
  });
});

/**
 * T47.4 — Lexical rerank tests
 */
describe("T47.4 — Leksik rerank", () => {
  it("tokenize handles Turkish text", () => {
    const tokens = tokenize("Hasta hakları ve özen yükümlülüğü");
    expect(tokens).toContain("hasta");
    expect(tokens).toContain("hakları");
    expect(tokens).toContain("özen");
    expect(tokens).toContain("yükümlülüğü");
  });

  it("tokenize filters short tokens", () => {
    const tokens = tokenize("a b cd def ghi");
    expect(tokens).toEqual(["def", "ghi"]);
  });

  it("lexical score higher for matching content", () => {
    const queryTokens = tokenize("aydınlatılmış rıza hasta");
    const doc1Tokens = tokenize("aydınlatılmış rıza hasta hakları sağlık");
    const doc2Tokens = tokenize("tapu davası trafik kazası");
    const all = [doc1Tokens, doc2Tokens];
    const s1 = computeLexicalScore(queryTokens, doc1Tokens, all);
    const s2 = computeLexicalScore(queryTokens, doc2Tokens, all);
    expect(s1).toBeGreaterThan(s2);
  });
});
