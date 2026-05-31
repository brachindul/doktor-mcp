import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

describe("doctorDiagnoseCli", () => {
  it("should produce a valid diagnosis output shape", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hasta hakları nelerdir",
      sourceMode: "mock",
    });
    expect(pack.legalClassification).toBeDefined();
    expect(Array.isArray(pack.relevantLegislation)).toBe(true);
    expect(Array.isArray(pack.verifiedHighCourtPrecedents)).toBe(true);
    expect(Array.isArray(pack.sourceWarnings)).toBe(true);
    expect(Array.isArray(pack.missingInformation)).toBe(true);
  });

  it("should return legislationOrder mapping", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hekim sorumluluğu nedir",
      sourceMode: "mock",
    });
    const legislationOrder = pack.relevantLegislation.map((l: any) => l.legislationName);
    expect(legislationOrder.length).toBeGreaterThan(0);
    expect(legislationOrder.every((n: string) => typeof n === "string")).toBe(true);
  });
});
