import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

/**
 * T18.3: Final live verification notes — v1.0.0 readiness tests.
 *
 * These tests verify that the codebase is structurally ready for v1.0.0
 * release. Actual live verification requires manual running of:
 *
 *   npm run benchmark:doctor-questions:live-smoke
 *   npm run health:sources
 *   npm run doctor:diagnose -- "örnek soru" --sourceMode live
 */

const service = new DoktorMcpInformationService();

describe("v1.0.0 final checklist — structural readiness", () => {
  it("service can handle a basic mock question (smoke)", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hasta hakları nelerdir?",
      sourceMode: "mock",
    });
    expect(pack).toBeDefined();
    expect(pack.shortAnswer).toBeDefined();
    expect(pack.shortAnswer.length).toBeGreaterThan(0);
  });

  it("service returns legislation results for mock mode", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekim taksirle hastayı yaraladı",
      sourceMode: "mock",
    });
    expect(pack.relevantLegislation).toBeDefined();
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
  });

  it("safety invariants: no forbidden phrases in mock output", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekim hasta verisini paylaştı",
      sourceMode: "mock",
    });
    const forbidden = [
      "kesinlikle",
      "kaçılmaz",
      "garantiledim",
      "sizi temin ederim",
    ];
    const answerLower = pack.shortAnswer.toLowerCase("tr-TR");
    for (const phrase of forbidden) {
      expect(answerLower).not.toContain(phrase);
    }
  });

  it("inventory report is callable and returns valid structure", async () => {
    const { buildInventoryReport } = await import(
      "../src/healthLegislationInventory.js"
    );
    const report = buildInventoryReport();
    expect(report.inventoryTotalCount).toBeGreaterThan(0);
    expect(report.verifiedOfficialSourceCount).toBeGreaterThanOrEqual(0);
    expect(report.candidateOfficialSourceCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.coverageWarnings)).toBe(true);
  });

  it("question classifier returns dimensions for basic input", async () => {
    const { classifyMedicalLegalQuestion } = await import(
      "../src/health/questionClassifier.js"
    );
    const result = classifyMedicalLegalQuestion("Hasta rıza verdi mi?");
    expect(result.dimensions).toContain("patient_rights");
  });
});
