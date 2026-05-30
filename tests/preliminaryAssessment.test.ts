import { describe, it, expect } from "vitest";
import { composeDoctorLegalInformationPack } from "../src/health/answerComposer.js";

describe("preliminaryAssessment — meaningful content", () => {
  // Helper: minimal pack data
  function makeClassification(overrides = {}) {
    return {
      question: "test question",
      dimensions: ["patient_rights"] as any[],
      searchTerms: ["test"],
      missingInformation: [],
      ...overrides,
    };
  }

  // ── Legislation tests ──
  it("should include concrete obligation snippet from legislation", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [{
        legislationName: "Hasta Hakları Yönetmeliği",
        articleNumber: "5",
        verbatimText: "Hasta, sağlık hizmetlerinden faydalanma hakkına sahiptir. Sağlık hizmeti sunucuları bu hakkı ihlal edemez.",
        connection: "direct",
        evidence: { documentId: "hh-5", sourceId: "mevzuat", sourceUrl: "" },
      }],
      [],
    );
    expect(result.preliminaryAssessment).toBeDefined();
    const sentence = result.preliminaryAssessment!.sentences[0];
    expect(sentence.text).toContain("Hasta Hakları Yönetmeliği");
    expect(sentence.text).toContain("md. 5");
    expect(sentence.text).toContain("Hasta, sağlık hizmetlerinden");
    expect(sentence.sourceRef).toBe("hh-5");
  });

  // ── Outcome-based precedent tests ──
  it("should use real outcome in precedent sentences", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [{
        id: "test-1",
        court: "yargitay" as any,
        chamber: "12. Ceza Dairesi",
        outcome: "Beraat",
        legalReasoning: "Sanığın kastı bulunmadığından beraatine karar verilmiştir.",
        topicTags: ["patient_rights"],
        evidence: { documentId: "yargitay-123", sourceId: "yargitay", sourceUrl: "" },
      }],
      [],
      undefined,
      undefined,
      "grounded-advisory",
    );
    expect(result.preliminaryAssessment).toBeDefined();
    const sentence = result.preliminaryAssessment!.sentences[0];
    expect(sentence.text).toContain("Beraat");
    expect(sentence.sourceRef).toBe("yargitay-123");
  });

  // ── Deduplication by court+chamber ──
  it("should deduplicate same court+chamber — keep only one", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [
        {
          id: "dec-1", court: "yargitay" as any, chamber: "12. Ceza Dairesi",
          outcome: "Beraat", legalReasoning: "Reasoning 1",
          topicTags: ["patient_rights"],
          evidence: { documentId: "y-1", sourceId: "yargitay", sourceUrl: "" },
        },
        {
          id: "dec-2", court: "yargitay" as any, chamber: "12. Ceza Dairesi",
          outcome: "Mahkumiyet", legalReasoning: "Reasoning 2",
          topicTags: ["patient_rights"],
          evidence: { documentId: "y-2", sourceId: "yargitay", sourceUrl: "" },
        },
      ],
      [],
      undefined,
      undefined,
      "grounded-advisory",
    );
    expect(result.preliminaryAssessment).toBeDefined();
    // Should only have 1 sentence for Yargitay/12.Ceza (deduped)
    expect(result.preliminaryAssessment!.sentences.length).toBe(1);
  });

  // ── Skip entries without outcome or reasoning ──
  it("should skip precedents without outcome AND reasoning", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [{
        id: "empty", court: "danistay" as any, chamber: "10. Daire",
        outcome: "Kaynakta sonuc yok", legalReasoning: "Kaynakta hukuki degerlendirme yok",
        topicTags: [],
        evidence: { documentId: "d-empty", sourceId: "danistay", sourceUrl: "" },
      }],
      [],
      undefined,
      undefined,
      "grounded-advisory",
    );
    // No meaningful content → no assessment
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  // ── Every sentence must have sourceRef ──
  it("every produced sentence must have a non-empty sourceRef", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [{
        legislationName: "Test Law",
        verbatimText: "Test provision text.",
        evidence: { documentId: "test-doc", sourceId: "test", sourceUrl: "" },
      }],
      [{
        id: "dec-ok", court: "yargitay" as any,
        outcome: "Ret", legalReasoning: "Reasoning",
        topicTags: ["patient_rights"],
        evidence: { documentId: "dec-ref", sourceId: "yargitay", sourceUrl: "" },
      }],
      [],
      undefined,
      undefined,
      "grounded-advisory",
    );
    expect(result.preliminaryAssessment).toBeDefined();
    for (const s of result.preliminaryAssessment!.sentences) {
      expect(s.sourceRef).toBeTruthy();
      expect(s.sourceRef.length).toBeGreaterThan(0);
    }
  });

  // ── Empty when no meaningful sources ──
  it("should produce undefined when no meaningful sources exist", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [],
      [],
      undefined,
      undefined,
      "grounded-advisory",
    );
    expect(result.preliminaryAssessment).toBeUndefined();
  });

  // ── Two different outcomes → two different sentences ──
  it("should produce different sentences for different outcomes", () => {
    const result = composeDoctorLegalInformationPack(
      makeClassification(),
      [],
      [
        {
          id: "a", court: "yargitay" as any, chamber: "12. Ceza",
          outcome: "Beraat", legalReasoning: "r1",
          topicTags: ["patient_rights"],
          evidence: { documentId: "a", sourceId: "yargitay", sourceUrl: "" },
        },
        {
          id: "b", court: "danistay" as any, chamber: "10. Daire",
          outcome: "Iptal", legalReasoning: "r2",
          topicTags: ["patient_rights"],
          evidence: { documentId: "b", sourceId: "danistay", sourceUrl: "" },
        },
      ],
      [],
      undefined,
      undefined,
      "grounded-advisory",
    );
    expect(result.preliminaryAssessment).toBeDefined();
    expect(result.preliminaryAssessment!.sentences.length).toBe(2);
    const texts = result.preliminaryAssessment!.sentences.map(s => s.text);
    expect(texts[0]).not.toBe(texts[1]);
  });
});
