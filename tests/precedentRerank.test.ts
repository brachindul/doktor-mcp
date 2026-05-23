import { describe, expect, it } from "vitest";
import { rerankByIssueRelevance } from "../src/health/precedentRerank.js";
import type { FilteredPrecedent } from "../src/contracts/legal.js";

function makeUsable(id: string, overrides: Record<string, unknown> = {}): FilteredPrecedent {
  return {
    status: "precedent_usable",
    eligibilityReasons: ["Emsal olarak kullanılabilir."],
    exclusionReasons: [],
    decision: {
      id,
      court: "yargitay",
      decisionDate: "2024-01-01",
      topicTags: [],
      evidence: { source: "yargitay", documentId: id, retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: true },
      factSummary: "Aydınlatılmış rıza belgesi eksikliği.",
      legalReasoning: "Hastanenin aydınlatma yükümlülüğünü yerine getirmediği anlaşıldı.",
      outcome: "Tazminata hükmedildi.",
      fullText: "gerekçe tam metin mevcut aydınlatılmış rıza",
      ...overrides
    } as never
  };
}

function makeExcluded(id: string, reason = "metadata_only"): FilteredPrecedent {
  return {
    status: reason as "metadata_only",
    eligibilityReasons: [],
    exclusionReasons: ["Tam karar metni mevcut değil."],
    decision: {
      id,
      court: "yargitay",
      decisionDate: "2024-01-01",
      topicTags: [],
      evidence: { source: "yargitay", documentId: id, retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: false }
    } as never
  };
}

describe("rerankByIssueRelevance", () => {
  it("returns unchanged array when there are no usable decisions", () => {
    const input = [makeExcluded("a"), makeExcluded("b")];
    const { reranked, rerankResult } = rerankByIssueRelevance(input, "rıza");
    expect(reranked).toEqual(input);
    expect(rerankResult.rerankChangedSelection).toBe(false);
    expect(rerankResult.usableCount).toBe(0);
  });

  it("returns unchanged array when there is only 1 usable decision", () => {
    const input = [makeUsable("only")];
    const { reranked, rerankResult } = rerankByIssueRelevance(input, "rıza belgesi");
    expect(reranked).toEqual(input);
    expect(rerankResult.rerankChangedSelection).toBe(false);
    expect(rerankResult.usableCount).toBe(1);
  });

  it("does not promote excluded decisions above usable ones", () => {
    const usable = makeUsable("usable");
    const excluded = makeExcluded("excluded");
    const { reranked } = rerankByIssueRelevance([usable, excluded], "aydınlatılmış rıza");
    // First entry must still be usable
    expect(reranked[0]!.status).toBe("precedent_usable");
    // Excluded entry must remain after usable block
    expect(reranked[reranked.length - 1]!.status).not.toBe("precedent_usable");
  });

  it("all non-usable decisions appear after the usable block", () => {
    const usable1 = makeUsable("u1");
    const usable2 = makeUsable("u2");
    const excluded = makeExcluded("ex");
    const { reranked } = rerankByIssueRelevance([usable1, excluded, usable2], "rıza");
    const firstNonUsableIdx = reranked.findIndex((e) => e.status !== "precedent_usable");
    const lastUsableIdx = reranked.map((e) => e.status).lastIndexOf("precedent_usable");
    expect(firstNonUsableIdx).toBeGreaterThan(lastUsableIdx);
  });

  it("returns preRerankTopId and postRerankTopId", () => {
    const usable1 = makeUsable("first");
    const usable2 = makeUsable("second");
    const { rerankResult } = rerankByIssueRelevance([usable1, usable2], "aydınlatılmış rıza belgesi tazminat");
    expect(rerankResult.preRerankTopId).toBe("first");
    expect(rerankResult.postRerankTopId).toBeDefined();
    expect(rerankResult.usableCount).toBe(2);
  });

  it("total count of reranked entries equals input count", () => {
    const input = [makeUsable("u1"), makeUsable("u2"), makeExcluded("e1"), makeExcluded("e2")];
    const { reranked } = rerankByIssueRelevance(input, "ameliyat tazminat");
    expect(reranked).toHaveLength(input.length);
  });

  it("stable sort: ties preserve original relative order", () => {
    // Two usable decisions with identical text — scores will be the same
    const u1 = makeUsable("u1", { fullText: "identical text" });
    const u2 = makeUsable("u2", { fullText: "identical text" });
    const { reranked } = rerankByIssueRelevance([u1, u2], "identical text");
    // With equal scores original order must be preserved
    const ids = reranked.filter((e) => e.status === "precedent_usable").map((e) => e.decision.id);
    expect(ids[0]).toBe("u1");
    expect(ids[1]).toBe("u2");
  });

  it("rerankChangedSelection is false when single usable entry", () => {
    const { rerankResult } = rerankByIssueRelevance([makeUsable("solo")], "rıza");
    expect(rerankResult.rerankChangedSelection).toBe(false);
    expect(rerankResult.preRerankTopId).toBe("solo");
    expect(rerankResult.postRerankTopId).toBe("solo");
  });

  it("rerankChangedSelection reflects whether top decision changed", () => {
    const u1 = makeUsable("u1");
    const u2 = makeUsable("u2");
    const { rerankResult } = rerankByIssueRelevance([u1, u2], "aydınlatılmış rıza tazminat sağlık hukuku");
    // Whether it changed or not, the flag must be consistent with the ids
    expect(rerankResult.rerankChangedSelection).toBe(
      rerankResult.preRerankTopId !== rerankResult.postRerankTopId
    );
  });
});
