import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { composeDoctorLegalInformationPack } from "../src/health/answerComposer.js";
import { readConfig, resetConfig } from "../src/core/runtimeConfig.js";
import type { ClassifiedMedicalLegalQuestion, CourtDecision } from "../src/contracts/legal.js";

/**
 * The relevance score is computed by assessPrecedentRelevance (score 0–2).
 * Default minRelevanceScore threshold is 2, so only precedents with
 * score >= 2 appear in preliminaryAssessment.
 *
 * Profile for "test question" falls back to malpractice_complication,
 * whose decisionSignals include: malpraktis, komplikasyon, tıbbi hata, etc.
 */

function makeClassification(overrides: Partial<ClassifiedMedicalLegalQuestion> = {}): ClassifiedMedicalLegalQuestion {
  return {
    question: "test question",
    dimensions: ["patient_rights"] as any[],
    searchTerms: ["test"],
    missingInformation: [],
    ...overrides,
  };
}

/** Decision whose legalReasoning contains 2+ malpractice signals → score 2 */
function highRelevanceDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "high-rel",
    court: "yargitay" as any,
    chamber: "12. Ceza Dairesi",
    outcome: "Hüküm kabul",
    legalReasoning: "Malpraktis ve komplikasyon değerlendirilmiştir. Hekimin özen yükümlülüğü ihlal edilmiştir.",
    topicTags: ["patient_rights"],
    evidence: { documentId: "hr-doc", sourceId: "yargitay", sourceUrl: "" },
    ...overrides,
  };
}

/** Decision with only 1 malpractice signal in factSummary (non-core) → lower score */
function midRelevanceDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "mid-rel",
    court: "yargitay" as any,
    chamber: "1. Hukuk Dairesi",
    outcome: "Tapu iptali",
    legalReasoning: "İdari yargı kapsamında dava incelenmiştir.",  // no malpractice signals
    factSummary: "Komplikasyon değerlendirilmesi yapılmıştır.",  // only "komplikasyon" in non-core field
    topicTags: [],
    evidence: { documentId: "mr-doc", sourceId: "yargitay", sourceUrl: "" },
    ...overrides,
  };
}

/** Decision with no malpractice signals → score 0 */
function lowRelevanceDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "low-rel",
    court: "danistay" as any,
    chamber: "10. Daire",
    outcome: "İptal",
    legalReasoning: "İdari yargı kapsamında tapu iptali davasında karar verilmiştir.",
    topicTags: [],
    evidence: { documentId: "lr-doc", sourceId: "danistay", sourceUrl: "" },
    ...overrides,
  };
}

describe("precedent relevance filter for assessment", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    delete process.env.DOKTOR_MCP_ASSESSMENT_MIN_RELEVANCE_SCORE;
    resetConfig();
  });

  it("should include high-relevance precedent (score >= 2) in assessment", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [highRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.sentences.length).toBe(1);
    expect(result.preliminaryAssessment!.sentences[0].text).toContain("12. Ceza Dairesi");
  });

  it("should exclude low-relevance precedent (score 0) from assessment", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [lowRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    // Low relevance → no precedent sentences → no assessment at all
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  it("should exclude mid-relevance precedent (score 1) from assessment", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [midRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    // Score 1 < default threshold 2 → excluded
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  it("should include precedent at exact threshold (score 2 >= threshold 2)", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [highRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    // Score 2 >= threshold 2 (default) → included
    expect(result.preliminaryAssessment).toBeDefined();
  });

  it("should still include legislation sentences when all precedents filtered out", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [{
        legislationName: "Hasta Hakları Yönetmeliği",
        articleNumber: "5",
        verbatimText: "Hasta, sağlık hizmetlerinden faydalanma hakkına sahiptir.",
        connection: "direct",
        evidence: { documentId: "hh-5", sourceId: "mevzuat", sourceUrl: "" },
      }],
      [lowRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    // Legislation sentence should still appear even though precedent is filtered
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.sentences.length).toBe(1);
    expect(result.preliminaryAssessment!.sentences[0].text).toContain("Hasta Hakları Yönetmeliği");
  });

  it("should respect runtime config threshold via env var", () => {
    // Set threshold to 0 → even score-0 precedents should pass
    process.env.DOKTOR_MCP_ASSESSMENT_MIN_RELEVANCE_SCORE = "0";
    resetConfig();

    expect(readConfig().assessment.minRelevanceScore).toBe(0);

    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [lowRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    // Score 0 >= threshold 0 → included
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.sentences.length).toBe(1);
  });

  it("should exclude score-2+ precedent when threshold is set higher", () => {
    // Set threshold to 5 (max) → all precedents excluded
    process.env.DOKTOR_MCP_ASSESSMENT_MIN_RELEVANCE_SCORE = "5";
    resetConfig();

    expect(readConfig().assessment.minRelevanceScore).toBe(5);

    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [highRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    // Even high-relevance (score 4) < threshold 5 → excluded
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  it("should filter precedents independently — include high, exclude low", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [highRelevanceDecision(), lowRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    expect(result.preliminaryAssessment).toBeDefined();
    // Only the high-relevance precedent should produce a sentence
    expect(result.preliminaryAssessment!.sentences.length).toBe(1);
    expect(result.preliminaryAssessment!.sentences[0].text).toContain("12. Ceza Dairesi");
  });
});

describe("relevanceExplanation on verified precedents", () => {
  it("includes relevanceExplanation on high-relevance precedent entries", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [highRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    expect(result.verifiedHighCourtPrecedents.length).toBe(1);
    const entry = result.verifiedHighCourtPrecedents[0];
    expect(entry.relevanceExplanation).toBeDefined();
    expect(typeof entry.relevanceExplanation).toBe("string");
    expect(entry.relevanceExplanation!.length).toBeGreaterThan(0);
    expect(entry.relevanceExplanation).toContain("skor");
  });

  it("includes relevanceExplanation with matched terms when signals match", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [highRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    const entry = result.verifiedHighCourtPrecedents[0];
    // High-relevance decision has malpraktis + komplikasyon signals
    expect(entry.matchedHealthLawTerms).toBeDefined();
    expect(entry.matchedHealthLawTerms!.length).toBeGreaterThanOrEqual(1);
    // Explanation should reference the matched terms
    expect(entry.relevanceExplanation).toContain("terimleri eşleşti");
  });

  it("includes low relevance explanation for low-scoring precedents", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [lowRelevanceDecision()],
      [],
      undefined,
      undefined,
      "grounded-advisory"
    );
    const entry = result.verifiedHighCourtPrecedents[0];
    expect(entry.relevanceExplanation).toBeDefined();
    expect(entry.relevanceExplanation).toContain("Düşük skor");
  });
});
