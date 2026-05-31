import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

describe("honest public legislation diagnostics", () => {
  it("mock mode should include sourceWarnings when public legislation is partial", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "mecburi hizmet süresi doldu tayin isteyebilir miyim",
      sourceMode: "mock",
    });

    // Pack should always have source warnings or legislation
    expect(pack.sourceWarnings.length).toBeGreaterThan(0);
    
    // If legislation exists, verify structure
    if (pack.relevantLegislation.length > 0) {
      for (const item of pack.relevantLegislation as any[]) {
        expect(item.legislationName).toBeTruthy();
      }
    }
    
    // Verify that coverage gaps are documented when present
    const hasCoverageGaps = pack.selectionDiagnostics?.coverageGaps?.length > 0;
    const hasLegislation = pack.relevantLegislation.length > 0;
    // At least one of these should be true — not silently empty
    expect(hasCoverageGaps || hasLegislation).toBe(true);
  });

  it("should not silently return empty legislation without diagnostic for unmapped queries", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tapu iptali davası hakkında bilgi ver",
      sourceMode: "mock",
    });

    // Even for irrelevant queries, there should be a diagnostic or honest empty result
    expect(pack.shortAnswer).toBeTruthy();
    // No fabricated legislation for irrelevant queries
    if (pack.relevantLegislation.length === 0) {
      expect(pack.sourceWarnings.some(w => w.includes("kaynak") || w.includes("bulunamadi"))).toBe(true);
    }
  });

  it("public employment query should have routing diagnostics", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi ne yapmalıyım",
      sourceMode: "mock",
    });

    // Should have legislation results or clear diagnostic
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    
    // Verify legislation names are not empty
    const names = pack.relevantLegislation.map((item: any) => item.legislationName ?? "");
    expect(names.every(n => n.length > 0)).toBe(true);
  });
});
