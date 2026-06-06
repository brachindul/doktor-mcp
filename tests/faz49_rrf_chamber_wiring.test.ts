import { describe, expect, it } from "vitest";
import { rerankByIssueRelevance } from "../src/health/precedentRerank.js";
import { buildBedestenSearchBody, isExactChamberName } from "../src/sources/bedesten/bedestenApi.js";
import type { FilteredPrecedent } from "../src/contracts/legal.js";

/**
 * Faz 49 — Non-vacuous protection tests for the RRF wiring and the
 * bedesten chamber-filter footgun guard.
 *
 * These two specs back mutation-check invariants 5 & 6. Unlike the Faz 47
 * tests (which exercise rrfFuse/isExactChamberName in isolation), these assert
 * that the behaviour is actually WIRED into the call paths that matter:
 *  - rerankByIssueRelevance must FUSE relevance+recency+lexical (not just
 *    relevance), so a recent + lexically-strong decision can overtake a
 *    higher-relevance-but-old one.
 *  - buildBedestenSearchBody must apply EXACT chamber names to birimAdi and
 *    REJECT coarse keywords (which return zero results live).
 */

function makeUsable(
  id: string,
  decisionDate: string,
  factSummary: string,
  legalReasoning: string
): FilteredPrecedent {
  return {
    status: "precedent_usable",
    eligibilityReasons: ["Emsal olarak kullanılabilir."],
    exclusionReasons: [],
    decision: {
      id,
      court: "yargitay",
      decisionDate,
      topicTags: [],
      evidence: { source: "yargitay", documentId: id, retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: true },
      factSummary,
      legalReasoning,
      outcome: "Karar verildi.",
      fullText: `${factSummary} ${legalReasoning}`
    } as never
  };
}

describe("Faz 49 — RRF füzyonu rerank'e gerçekten bağlı (mutation 5)", () => {
  it("recency + lexical sinyalleri yüksek-relevans ama eski kararı geçebilir", () => {
    // Profile = malpractice_complication (via "hekim kusuru" question signal).
    // The question tokens (hekim/kusuru/tazminat/sorumluluğu) drive the LEXICAL
    // signal; A's relevance signals are chosen to NOT overlap those tokens, so
    // relevance and lexical are decoupled.
    const question = "hekim kusuru tazminat sorumluluğu";

    // A: very high RELEVANCE (many issue signals in legalReasoning => core bonus),
    //    but OLD and lexically unrelated to the question wording.
    const relWinnerOld = makeUsable(
      "rel-old",
      "2004-01-01",
      "Komplikasyon değerlendirmesi yapıldı.",
      "Malpraktis komplikasyon tıbbi hata özen yükümlülüğü tıbbi standart tedavi hatası."
    );

    // B: lower relevance (single issue signal) but RECENT and lexically dense
    //    against the question tokens.
    const recencyLexWinnerNew = makeUsable(
      "recency-lex-new",
      "2025-01-01",
      "Hekim kusuru tazminat sorumluluğu; tazminat sorumluluğu hekim kusuru değerlendirildi.",
      "Hekim kusuru tartışıldı."
    );

    // Input order puts the relevance winner FIRST, so B must actively overtake.
    const { reranked, rerankResult } = rerankByIssueRelevance(
      [relWinnerOld, recencyLexWinnerNew],
      question
    );

    // Under pure-relevance ordering the old high-relevance decision stays on top.
    // Only RRF fusion (relevance + recency + lexical) lets the recent/lexical
    // decision win. If the fusion is mutated away, this assertion fails.
    expect(rerankResult.preRerankTopId).toBe("rel-old");
    expect(reranked[0]!.decision.id).toBe("recency-lex-new");
    expect(rerankResult.postRerankTopId).toBe("recency-lex-new");
    expect(rerankResult.rerankChangedSelection).toBe(true);
  });
});

describe("Faz 49 — bedesten chamber filtresi guard'ı (mutation 6)", () => {
  it("tam daire adı birimAdi olarak uygulanır", () => {
    const body = buildBedestenSearchBody("malpraktis", ["YARGITAYKARARI"], 5, "13. Hukuk Dairesi");
    expect((body.data as unknown as Record<string, unknown>).birimAdi).toBe("13. Hukuk Dairesi");

    const board = buildBedestenSearchBody("malpraktis", ["YARGITAYKARARI"], 5, "Hukuk Genel Kurulu");
    expect((board.data as unknown as Record<string, unknown>).birimAdi).toBe("Hukuk Genel Kurulu");
  });

  it("kaba keyword birimAdi olarak UYGULANMAZ (canlı sıfırlamayı önler)", () => {
    for (const coarse of ["Hukuk", "Ceza", "daire", "hukuk dairesi"]) {
      const body = buildBedestenSearchBody("malpraktis", ["YARGITAYKARARI"], 5, coarse);
      expect((body.data as unknown as Record<string, unknown>).birimAdi).toBeUndefined();
    }
  });

  it("chamber verilmezse birimAdi hiç eklenmez", () => {
    const body = buildBedestenSearchBody("malpraktis", ["YARGITAYKARARI"], 5);
    expect("birimAdi" in (body.data as unknown as Record<string, unknown>)).toBe(false);
  });

  it("isExactChamberName tam adları kabul, kaba keyword'leri red eder", () => {
    expect(isExactChamberName("13. Hukuk Dairesi")).toBe(true);
    expect(isExactChamberName("10. Daire")).toBe(true);
    expect(isExactChamberName("Ceza Genel Kurulu")).toBe(true);
    expect(isExactChamberName("Vergi Dava Daireleri Kurulu")).toBe(true);
    expect(isExactChamberName("Hukuk")).toBe(false);
    expect(isExactChamberName("ceza")).toBe(false);
    expect(isExactChamberName("daire")).toBe(false);
    expect(isExactChamberName("")).toBe(false);
  });
});
