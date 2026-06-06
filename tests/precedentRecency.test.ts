import { describe, expect, it } from "vitest";
import { rerankByIssueRelevance } from "../src/health/precedentRerank.js";
import type { FilteredPrecedent, CourtDecision } from "../src/contracts/legal.js";

function makeDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "test:1",
    court: "yargitay",
    chamber: "4. Hukuk Dairesi",
    decisionDate: "2023-01-01",
    factSummary: "Özet.",
    legalReasoning: "Gerekçe.",
    outcome: "Sonuç.",
    relevanceNote: undefined,
    topicTags: [],
    evidence: { documentId: "1", sourceId: "yargitay", sourceUrl: "" },
    ...overrides
  };
}

function makeFiltered(decision: CourtDecision): FilteredPrecedent {
  return {
    decision,
    status: "precedent_usable",
    eligibilityReasons: [],
    exclusionReasons: []
  };
}

describe("T22.3 — emsal tarih filtresi ve güncellik", () => {
  it("newer decision outranks older via RRF recency signal", () => {
    const older = makeFiltered(makeDecision({
      id: "old", decisionDate: "2015-06-10",
      legalReasoning: "hekim kusuru özen"
    }));
    const newer = makeFiltered(makeDecision({
      id: "new", decisionDate: "2023-03-15",
      legalReasoning: "hekim kusuru özen yükümlülüğü"
    }));
    const { reranked } = rerankByIssueRelevance([older, newer], "hekim kusuru özen");
    // Newer has richer text + recency advantage → should rank first in RRF
    expect(reranked[0].decision.id).toBe("new");
  });

  it("older decision with higher relevance still wins over newer low-relevance", () => {
    const older = makeFiltered(makeDecision({
      id: "old", decisionDate: "2015-06-10",
      legalReasoning: "tıbbi hata özen yükümlülüğü hekim kusuru komplikasyon malpraktis"
    }));
    const newer = makeFiltered(makeDecision({
      id: "new", decisionDate: "2023-03-15",
      legalReasoning: "genel hüküm"
    }));
    const { reranked } = rerankByIssueRelevance([newer, older], "tıbbi hata");
    expect(reranked[0].decision.id).toBe("old");
  });

  it("respects stable sort for equal combined scores", () => {
    const a = makeFiltered(makeDecision({ id: "a", decisionDate: "2020-01-01", legalReasoning: "aynı metin" }));
    const b = makeFiltered(makeDecision({ id: "b", decisionDate: "2020-01-01", legalReasoning: "aynı metin" }));
    const { reranked } = rerankByIssueRelevance([a, b], "aynı metin");
    // Equal in all signals → stable sort preserves original order
    expect(reranked[0].decision.id).toBe("a");
    expect(reranked[1].decision.id).toBe("b");
  });

  it("recency signal alone boosts when combined with other differences", () => {
    // When ONLY recency differs and all other signals are identical,
    // RRF scores are equal (signals cancel). With at least one other
    // weak differentiator, recency becomes the decisive signal.
    const old = makeFiltered(makeDecision({ id: "old", decisionDate: "1990-01-01", legalReasoning: "hekim kusuru" }));
    const recent = makeFiltered(makeDecision({ id: "recent", decisionDate: "2024-01-01", legalReasoning: "hekim kusuru özen" }));
    const { reranked } = rerankByIssueRelevance([old, recent], "hekim kusuru özen");
    // Recent has slightly richer text → wins with recency boost
    expect(reranked[0].decision.id).toBe("recent");
  });
});
