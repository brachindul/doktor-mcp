import { describe, it, expect } from "vitest";
import { buildDecisionKey, decisionRichnessScore, deduplicateDecisions } from "../src/health/decisionDedup.js";
import type { CourtDecision } from "../src/contracts/legal.js";

const MOCK_RETRIEVED_AT = "2026-05-22T00:00:00.000Z";

function makeDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "test-123",
    court: "yargitay",
    chamber: "12. Ceza Dairesi",
    decisionDate: "2024-01-15",
    meritsNumber: "2023/100",
    decisionNumber: "2024/200",
    factSummary: "Aydınlatılmış rıza eksikliği nedeniyle tazminat talebi.",
    legalReasoning: "Hastanenin aydınlatılmış rıza yükümlülüğünü yerine getirmediği anlaşıldı.",
    outcome: "Tazminata hükmedildi.",
    relevanceNote: "Sağlık hukuku aramasıyla eşleşti.",
    topicTags: ["rıza", "tazminat"],
    fullText: "Gerekçe tam metin mevcut. Detaylı hukuki değerlendirme burada yer almaktadır.",
    evidence: {
      source: "yargitay",
      documentId: "yargitay:123",
      retrievedAt: MOCK_RETRIEVED_AT,
      official: true,
      fullText: true,
      sourceUrl: "https://karararama.yargitay.gov.tr/getDokuman?id=123"
    },
    ...overrides,
  } as CourtDecision;
}

describe("decisionDedup", () => {
  describe("buildDecisionKey", () => {
    it("should use normalizedDecisionKey when available", () => {
      const key = buildDecisionKey(makeDecision({ normalizedDecisionKey: "ABC-123" }));
      expect(key).toContain("nkey:");
      expect(key).toContain("abc-123");
    });

    it("should use evidence.documentId when no normalizedDecisionKey", () => {
      const key = buildDecisionKey(makeDecision({
        normalizedDecisionKey: undefined,
        evidence: { source: "yargitay", documentId: "yargitay:456", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
      }));
      expect(key).toContain("docid:");
      expect(key).toContain("yargitay:456");
    });

    it("should use meritsNumber + decisionNumber when no documentId", () => {
      const key = buildDecisionKey(makeDecision({
        normalizedDecisionKey: undefined,
        meritsNumber: "2023/100",
        decisionNumber: "2024/200",
        court: "yargitay",
        evidence: { source: "yargitay", documentId: "", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
      }));
      expect(key).toContain("case:");
      expect(key).toContain("2023/100");
      expect(key).toContain("2024/200");
    });

    it("should normalize whitespace and case in keys", () => {
      const key1 = buildDecisionKey(makeDecision({ normalizedDecisionKey: "ABC  123" }));
      const key2 = buildDecisionKey(makeDecision({ normalizedDecisionKey: "abc123" }));
      expect(key1).toBe(key2);
    });

    it("should fall back to court + date when no other identifiers", () => {
      const key = buildDecisionKey(makeDecision({
        normalizedDecisionKey: undefined,
        meritsNumber: undefined,
        decisionNumber: undefined,
        court: "yargitay",
        decisionDate: "2024-01-15",
        evidence: { source: "yargitay", documentId: "", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
      }));
      expect(key).toContain("fallback:");
      expect(key).toContain("yargitay");
      expect(key).toContain("2024-01-15");
    });
  });

  describe("decisionRichnessScore", () => {
    it("should score full text higher", () => {
      const withFullText = decisionRichnessScore(makeDecision({
        fullText: "x".repeat(200),
        legalReasoning: "",
        factSummary: ""
      }));
      const withoutFullText = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "",
        factSummary: ""
      }));
      expect(withFullText).toBeGreaterThan(withoutFullText);
    });

    it("should score reasoning higher", () => {
      const withReasoning = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "x".repeat(100),
        factSummary: ""
      }));
      const withoutReasoning = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "",
        factSummary: ""
      }));
      expect(withReasoning).toBeGreaterThan(withoutReasoning);
    });

    it("should score fact summary", () => {
      const withSummary = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "",
        factSummary: "x".repeat(30)
      }));
      const withoutSummary = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "",
        factSummary: ""
      }));
      expect(withSummary).toBeGreaterThan(withoutSummary);
    });

    it("should score source URL presence", () => {
      const withUrl = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "",
        factSummary: "",
        evidence: { source: "yargitay", documentId: "1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true, sourceUrl: "https://example.com" }
      }));
      const withoutUrl = decisionRichnessScore(makeDecision({
        fullText: "",
        legalReasoning: "",
        factSummary: "",
        evidence: { source: "yargitay", documentId: "1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
      }));
      expect(withUrl).toBeGreaterThan(withoutUrl);
    });
  });

  describe("deduplicateDecisions", () => {
    it("should keep only one copy of duplicate decisions with same documentId", () => {
      const decisions = [
        makeDecision({
          id: "yargitay:case-1",
          evidence: { source: "yargitay", documentId: "yargitay:case-1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
        makeDecision({
          id: "bedesten:case-1",
          court: "bedesten",
          evidence: { source: "bedesten", documentId: "yargitay:case-1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
      ];
      const result = deduplicateDecisions(decisions);
      expect(result.decisions).toHaveLength(1);
      expect(result.dedupedCount).toBe(1);
    });

    it("should keep the richer version and discard poorer duplicates", () => {
      const poorer = makeDecision({
        id: "case-1-poor",
        fullText: "",
        legalReasoning: "",
        factSummary: "",
        evidence: { source: "yargitay", documentId: "shared:case-1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: false }
      });
      const richer = makeDecision({
        id: "case-1-rich",
        fullText: "Full detailed text with comprehensive legal analysis that exceeds one hundred characters to trigger scoring.",
        legalReasoning: "Detailed reasoning that exceeds fifty characters for scoring purposes.",
        factSummary: "Detailed summary exceeding twenty characters for scoring.",
        evidence: { source: "bedesten", documentId: "shared:case-1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true, sourceUrl: "https://bedesten.adalet.gov.tr/karar/1" }
      });
      const result = deduplicateDecisions([poorer, richer]);
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].id).toBe("case-1-rich");
      expect(result.decisions[0].fullText).toContain("Full detailed text");
      expect(result.dedupedCount).toBe(1);
    });

    it("should keep all unique decisions", () => {
      const decisions = [
        makeDecision({
          id: "case-1",
          evidence: { source: "yargitay", documentId: "yargitay:case-1", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
        makeDecision({
          id: "case-2",
          evidence: { source: "yargitay", documentId: "yargitay:case-2", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
        makeDecision({
          id: "case-3",
          court: "danistay",
          evidence: { source: "danistay", documentId: "danistay:case-3", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
      ];
      const result = deduplicateDecisions(decisions);
      expect(result.decisions).toHaveLength(3);
      expect(result.dedupedCount).toBe(0);
    });

    it("should handle empty array", () => {
      const result = deduplicateDecisions([]);
      expect(result.decisions).toHaveLength(0);
      expect(result.dedupedCount).toBe(0);
    });

    it("should handle single decision", () => {
      const result = deduplicateDecisions([makeDecision()]);
      expect(result.decisions).toHaveLength(1);
      expect(result.dedupedCount).toBe(0);
    });

    it("should handle multiple duplicates of the same decision", () => {
      const decisions = [
        makeDecision({
          id: "v1",
          fullText: "short",
          legalReasoning: "",
          factSummary: "",
          evidence: { source: "yargitay", documentId: "shared:id", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
        makeDecision({
          id: "v2",
          fullText: "Full detailed text with comprehensive legal analysis that exceeds one hundred characters to trigger scoring.",
          legalReasoning: "Detailed reasoning that exceeds fifty characters for scoring purposes.",
          evidence: { source: "bedesten", documentId: "shared:id", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
        makeDecision({
          id: "v3",
          fullText: "medium text",
          legalReasoning: "",
          evidence: { source: "danistay", documentId: "shared:id", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true }
        }),
      ];
      const result = deduplicateDecisions(decisions);
      expect(result.decisions).toHaveLength(1);
      expect(result.dedupedCount).toBe(2);
      expect(result.decisions[0].id).toBe("v2"); // richest
    });

    it("should deduplicate same case from Yargitay and Bedesten adapters", () => {
      // Simulates the real scenario: same Yargitay case found by both adapters
      const yargitayVersion = makeDecision({
        id: "yargitay:2023/100-2024/200",
        court: "yargitay",
        meritsNumber: "2023/100",
        decisionNumber: "2024/200",
        fullText: undefined, // metadata only
        legalReasoning: undefined,
        factSummary: undefined,
        evidence: { source: "yargitay", documentId: "yargitay:2023/100-2024/200", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: false }
      });
      const bedestenVersion = makeDecision({
        id: "bedesten:2023/100-2024/200",
        court: "yargitay", // same court, different source
        meritsNumber: "2023/100",
        decisionNumber: "2024/200",
        fullText: "Yargıtay 12. Ceza Dairesi'nin tam gerekçe metni burada yer almaktadır. Hastanenin aydınlatılmış rıza yükümlülüğü detaylı biçimde incelenmiştir.",
        legalReasoning: "Mahkeme, hastanenin aydınlatılmış rıza formunu eksik düzenlediğini tespit etmiştir.",
        factSummary: "Hasta ameliyat öncesi aydınlatılmış rıza formunu imzalamıştır.",
        evidence: { source: "bedesten", documentId: "yargitay:2023/100-2024/200", retrievedAt: MOCK_RETRIEVED_AT, official: true, fullText: true, sourceUrl: "https://bedesten.adalet.gov.tr/karar/123" }
      });
      const result = deduplicateDecisions([yargitayVersion, bedestenVersion]);
      expect(result.decisions).toHaveLength(1);
      expect(result.dedupedCount).toBe(1);
      // Bedesten version should be kept (richer)
      expect(result.decisions[0].fullText).toContain("tam gerekçe metni");
      expect(result.decisions[0].evidence.source).toBe("bedesten");
    });
  });
});
