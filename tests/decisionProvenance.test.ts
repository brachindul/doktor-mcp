import { describe, it, expect } from "vitest";
import {
  deriveContentStatus,
  isQuoteUsable,
  buildDecisionKey,
  chooseStrongestContentStatus,
  mergeDuplicateDecisions,
  buildProvenanceMetrics
} from "../src/live/decisionProvenance.js";
import type { CourtDecision } from "../src/contracts/legal.js";

function makeDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "yargitay:doc1",
    court: "yargitay",
    topicTags: [],
    evidence: {
      source: "yargitay",
      documentId: "doc1",
      retrievedAt: "2024-01-01T00:00:00.000Z",
      official: true,
      fullText: false
    },
    ...overrides
  };
}

// ─── deriveContentStatus ────────────────────────────────────────────────────

describe("deriveContentStatus", () => {
  it("1. fullText string present → full_text", () => {
    const d = makeDecision({ fullText: "some legal text" });
    expect(deriveContentStatus(d)).toBe("full_text");
  });

  it("2. evidence.fullText=true, no fullText string → html_markdown", () => {
    const d = makeDecision({
      evidence: {
        source: "yargitay",
        documentId: "doc2",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        official: true,
        fullText: true
      }
    });
    expect(deriveContentStatus(d)).toBe("html_markdown");
  });

  it("3. no fullText, evidence.fullText=false → metadata_only", () => {
    const d = makeDecision();
    expect(deriveContentStatus(d)).toBe("metadata_only");
  });

  it("4. contentStatus already set → returns it unchanged", () => {
    const d = makeDecision({ contentStatus: "pdf_link_only" });
    expect(deriveContentStatus(d)).toBe("pdf_link_only");
  });
});

// ─── isQuoteUsable ──────────────────────────────────────────────────────────

describe("isQuoteUsable", () => {
  it("5. full_text + precedent_usable → true", () => {
    const d = makeDecision({
      fullText: "full legal reasoning text",
      decisionSourceTrace: {
        query: "q",
        source: "yargitay",
        court: "yargitay",
        searchRequest: null,
        searchResultsCount: 1,
        selectedResult: { documentId: "doc1" },
        selectedResultReason: "matched",
        documentId: "doc1",
        fullTextAvailable: true,
        fullTextRetrievalMethod: "bedesten-base64-html",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        eligibilityStatus: "precedent_usable",
        eligibilityReasons: [],
        exclusionReasons: []
      }
    });
    expect(isQuoteUsable(d)).toBe(true);
  });

  it("6. metadata_only → false", () => {
    const d = makeDecision(); // no fullText, evidence.fullText=false
    expect(isQuoteUsable(d)).toBe(false);
  });

  it("7. html_markdown + procedural_only eligibility → false", () => {
    const d = makeDecision({
      evidence: {
        source: "yargitay",
        documentId: "doc3",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        official: true,
        fullText: true // triggers html_markdown
      },
      decisionSourceTrace: {
        query: "q",
        source: "yargitay",
        court: "yargitay",
        searchRequest: null,
        searchResultsCount: 1,
        selectedResult: { documentId: "doc3" },
        selectedResultReason: "matched",
        documentId: "doc3",
        fullTextAvailable: true,
        fullTextRetrievalMethod: "html-text",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        eligibilityStatus: "procedural_only",
        eligibilityReasons: [],
        exclusionReasons: []
      }
    });
    expect(isQuoteUsable(d)).toBe(false);
  });
});

// ─── buildDecisionKey ───────────────────────────────────────────────────────

describe("buildDecisionKey", () => {
  it("8. returns doc:: key when documentId present", () => {
    const d = makeDecision();
    expect(buildDecisionKey(d)).toBe("doc::doc1");
  });

  it("9. returns court-based key when court+meritsNumber+decisionNumber present but no documentId", () => {
    const d = makeDecision({
      court: "danistay",
      chamber: "5. Daire",
      decisionDate: "2023-05-01",
      meritsNumber: "2020/1234",
      decisionNumber: "2023/5678",
      evidence: {
        source: "danistay",
        documentId: "",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        official: true,
        fullText: false
      }
    });
    expect(buildDecisionKey(d)).toBe("danistay::5. Daire::2023-05-01::2020/1234::2023/5678");
  });

  it("10. returns null when insufficient data", () => {
    const d = makeDecision({
      court: "yargitay",
      evidence: {
        source: "yargitay",
        documentId: "",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        official: true,
        fullText: false
      }
    });
    expect(buildDecisionKey(d)).toBeNull();
  });
});

// ─── chooseStrongestContentStatus ───────────────────────────────────────────

describe("chooseStrongestContentStatus", () => {
  it("11. full_text wins over html_markdown and metadata_only", () => {
    expect(chooseStrongestContentStatus(["metadata_only", "full_text", "html_markdown"])).toBe("full_text");
  });

  it("returns unavailable when empty", () => {
    expect(chooseStrongestContentStatus([])).toBe("unavailable");
  });
});

// ─── mergeDuplicateDecisions ─────────────────────────────────────────────────

describe("mergeDuplicateDecisions", () => {
  it("12. same documentId → merged into one, duplicateCount=1", () => {
    const d1 = makeDecision({ id: "yargitay:doc1" });
    const d2 = makeDecision({ id: "yargitay:doc1-copy" }); // same evidence.documentId=doc1
    const result = mergeDuplicateDecisions([d1, d2]);
    expect(result.merged.length).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("13. same court+chamber+date+esas+karar → merged", () => {
    const base = {
      court: "danistay" as const,
      chamber: "5. Daire",
      decisionDate: "2023-05-01",
      meritsNumber: "2020/1234",
      decisionNumber: "2023/5678",
      evidence: {
        source: "danistay" as const,
        documentId: "",
        retrievedAt: "2024-01-01T00:00:00.000Z",
        official: true as const,
        fullText: false
      }
    };
    const d1 = makeDecision({ ...base, id: "danistay:abc" });
    const d2 = makeDecision({ ...base, id: "danistay:xyz" });
    const result = mergeDuplicateDecisions([d1, d2]);
    expect(result.merged.length).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("14. different decisions → not merged", () => {
    const d1 = makeDecision({
      id: "yargitay:docA",
      evidence: { source: "yargitay", documentId: "docA", retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: false }
    });
    const d2 = makeDecision({
      id: "danistay:docB",
      court: "danistay",
      evidence: { source: "danistay", documentId: "docB", retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: false }
    });
    const result = mergeDuplicateDecisions([d1, d2]);
    expect(result.merged.length).toBe(2);
    expect(result.duplicateCount).toBe(0);
  });

  it("15. merge picks strongest contentStatus (full_text over metadata_only)", () => {
    const d1 = makeDecision({ id: "yargitay:doc1", contentStatus: "metadata_only" });
    const d2 = makeDecision({ id: "yargitay:doc1-v2", fullText: "full legal text" }); // same documentId=doc1
    const result = mergeDuplicateDecisions([d1, d2]);
    expect(result.merged.length).toBe(1);
    expect(result.merged[0].contentStatus).toBe("full_text");
  });

  it("16. merged decision keeps both provenances in provenance[]", () => {
    const prov1 = { source: "yargitay" as const, fetchStatus: "metadata_only" as const, contentStatus: "metadata_only" as const, quoteUsable: false };
    const prov2 = { source: "bedesten" as const, fetchStatus: "full_text_fetched" as const, contentStatus: "full_text" as const, quoteUsable: true };
    const d1 = makeDecision({ id: "yargitay:doc1", provenance: [prov1] });
    const d2 = makeDecision({ id: "bedesten:doc1-b", provenance: [prov2] }); // same documentId=doc1
    const result = mergeDuplicateDecisions([d1, d2]);
    expect(result.merged.length).toBe(1);
    const merged = result.merged[0];
    expect(merged.provenance).toHaveLength(2);
  });
});

// ─── buildProvenanceMetrics ──────────────────────────────────────────────────

describe("buildProvenanceMetrics", () => {
  it("17. counts correctly from a list of decisions", () => {
    const prov1 = { source: "yargitay" as const, fetchStatus: "metadata_only" as const, contentStatus: "metadata_only" as const, quoteUsable: false };
    const prov2 = { source: "danistay" as const, fetchStatus: "full_text_fetched" as const, contentStatus: "full_text" as const, quoteUsable: true };
    const d1 = makeDecision({
      id: "yargitay:docA",
      evidence: { source: "yargitay", documentId: "docA", retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: false },
      provenance: [prov1],
      quoteUsable: false
    });
    const d2 = makeDecision({
      id: "danistay:docB",
      court: "danistay",
      fullText: "full text",
      evidence: { source: "danistay", documentId: "docB", retrievedAt: "2024-01-01T00:00:00.000Z", official: true, fullText: true },
      provenance: [prov2],
      quoteUsable: true
    });
    const metrics = buildProvenanceMetrics([d1, d2]);
    expect(metrics.totalDecisions).toBe(2);
    expect(metrics.quoteUsableCount).toBe(1);
    expect(metrics.quoteUnusableCount).toBe(1);
    expect(metrics.metadataOnlyDecisionCount).toBe(1);
    expect(metrics.contentStatusDistribution["full_text"]).toBe(1);
    expect(metrics.contentStatusDistribution["metadata_only"]).toBe(1);
    expect(metrics.fetchStatusDistribution["metadata_only"]).toBe(1);
    expect(metrics.fetchStatusDistribution["full_text_fetched"]).toBe(1);
  });
});
