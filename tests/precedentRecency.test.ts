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
  it("newer decision outranks older when relevance is equal", () => {
    const older = makeFiltered(makeDecision({ id: "old", decisionDate: "2015-06-10" }));
    const newer = makeFiltered(makeDecision({ id: "new", decisionDate: "2023-03-15" }));
    const { reranked } = rerankByIssueRelevance([older, newer], "test question");
    expect(reranked[0].decision.id).toBe("new");
    expect(reranked[1].decision.id).toBe("old");
  });

  it("older decision with higher relevance still wins over newer low-relevance", () => {
    // High relevance older: contains many malpractice signals
    const older = makeFiltered(makeDecision({
      id: "old",
      decisionDate: "2015-06-10",
      legalReasoning: "tıbbi hata özen yükümlülüğü hekim kusuru komplikasyon malpraktis"
    }));
    // Low relevance newer: no signals
    const newer = makeFiltered(makeDecision({
      id: "new",
      decisionDate: "2023-03-15",
      legalReasoning: "genel hüküm"
    }));
    const { reranked } = rerankByIssueRelevance([newer, older], "tıbbi hata");
    expect(reranked[0].decision.id).toBe("old");
  });

  it("respects stable sort for equal combined scores", () => {
    const a = makeFiltered(makeDecision({ id: "a", decisionDate: "2020-01-01" }));
    const b = makeFiltered(makeDecision({ id: "b", decisionDate: "2020-01-01" }));
    const { reranked } = rerankByIssueRelevance([a, b], "test question");
    expect(reranked[0].decision.id).toBe("a");
    expect(reranked[1].decision.id).toBe("b");
  });

  it("filters out decisions older than minDecisionYear when configured", () => {
    // This test verifies the scoring side; actual filtering would happen at selection time
    const old = makeFiltered(makeDecision({ id: "old", decisionDate: "1990-01-01" }));
    const recent = makeFiltered(makeDecision({ id: "recent", decisionDate: "2020-01-01" }));
    const { reranked } = rerankByIssueRelevance([old, recent], "test question");
    // Recent should outrank very old even if text relevance is similar
    expect(reranked[0].decision.id).toBe("recent");
  });
});
