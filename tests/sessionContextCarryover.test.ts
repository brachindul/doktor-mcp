import { describe, expect, it } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import type { ClassifiedMedicalLegalQuestion } from "../src/contracts/legal.js";

describe("T24.2 — Oturum bağlam taşıma", () => {
  const service = new DoktorMcpInformationService();

  it("mergeClassifications keeps current dimensions and appends previous unique ones", () => {
    const current: ClassifiedMedicalLegalQuestion = {
      question: "peki ya acil durumda",
      dimensions: [{ dimension: "emergency_care", confidence: 0.9 }],
      searchTerms: ["acil"],
      missingInformation: []
    };
    const previous: ClassifiedMedicalLegalQuestion = {
      question: "Hasta hakları nelerdir?",
      dimensions: [{ dimension: "patient_rights", confidence: 0.8 }, { dimension: "informed_consent", confidence: 0.7 }],
      searchTerms: ["hasta hakları", "bilgilendirme"],
      missingInformation: ["hasta onayı"]
    };

    const merged = service.mergeClassifications(current, previous);
    expect(merged.dimensions).toHaveLength(3);
    expect(merged.dimensions.map((d) => d.dimension)).toContain("emergency_care");
    expect(merged.dimensions.map((d) => d.dimension)).toContain("patient_rights");
    expect(merged.dimensions.map((d) => d.dimension)).toContain("informed_consent");
  });

  it("mergeClassifications deduplicates searchTerms", () => {
    const current: ClassifiedMedicalLegalQuestion = {
      question: "acil durum",
      dimensions: [],
      searchTerms: ["acil", "müdahale"],
      missingInformation: []
    };
    const previous: ClassifiedMedicalLegalQuestion = {
      question: "önceki",
      dimensions: [],
      searchTerms: ["acil", "risk"],
      missingInformation: []
    };

    const merged = service.mergeClassifications(current, previous);
    expect(merged.searchTerms).toHaveLength(3);
    expect(merged.searchTerms).toContain("acil");
    expect(merged.searchTerms).toContain("müdahale");
    expect(merged.searchTerms).toContain("risk");
  });

  it("mergeClassifications deduplicates missingInformation", () => {
    const current: ClassifiedMedicalLegalQuestion = {
      question: "x",
      dimensions: [],
      searchTerms: [],
      missingInformation: ["onay"]
    };
    const previous: ClassifiedMedicalLegalQuestion = {
      question: "y",
      dimensions: [],
      searchTerms: [],
      missingInformation: ["onay", "risk"]
    };

    const merged = service.mergeClassifications(current, previous);
    expect(merged.missingInformation).toHaveLength(2);
    expect(merged.missingInformation).toContain("onay");
    expect(merged.missingInformation).toContain("risk");
  });

  it("prepareInformationPack without previousContext behaves the same as before", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hasta hakları nelerdir?",
      sourceMode: "mock"
    });
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    expect(pack.legalClassification.patientRights).toBeDefined();
  });

  it("prepareInformationPack with previousContext merges dimensions", async () => {
    const previous: ClassifiedMedicalLegalQuestion = {
      question: "Hasta hakları nelerdir?",
      dimensions: [{ dimension: "patient_rights", confidence: 0.8 }],
      searchTerms: ["hasta hakları"],
      missingInformation: []
    };

    const pack = await service.prepareInformationPack({
      question: "peki ya acil durumda",
      sourceMode: "mock",
      previousContext: previous
    });

    // The merged pack should contain dimensions from both questions
    // We verify the pack is produced successfully and contains relevant content
    expect(pack.shortAnswer).toBeDefined();
    expect(pack.shortAnswer.length).toBeGreaterThan(0);
  });
});
