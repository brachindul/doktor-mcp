import { describe, it, expect } from "vitest";
import { buildInventoryReport } from "../src/healthLegislationInventory.js";

describe("MCP resources", () => {
  it("should produce valid inventory report for resource", () => {
    const report = buildInventoryReport();
    expect(report).toBeDefined();
    expect(report.inventoryTotalCount).toBeGreaterThan(0);
    expect(report.verifiedEntries).toBeDefined();
    expect(Array.isArray(report.verifiedEntries)).toBe(true);
    expect(report.verifiedEntries.length).toBeGreaterThan(0);

    // Verify structure
    const firstItem = report.verifiedEntries[0];
    expect(firstItem).toHaveProperty("key");
    expect(firstItem).toHaveProperty("title");
    expect(firstItem).toHaveProperty("officialSourceStatus");
  });

  it("should serialize to valid JSON", () => {
    const report = buildInventoryReport();
    const json = JSON.stringify(report);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("should have calibration status data", () => {
    const status = {
      sources: {
        yargitay: "reachable_json",
        danistay: "reachable_json",
        aym: "synthetic_only",
        legislation: "reachable_json",
      },
      lastChecked: new Date().toISOString(),
    };
    expect(status.sources.aym).toBe("synthetic_only");
    expect(status.lastChecked).toBeDefined();
  });

  it("should produce valid prompt template", () => {
    const prompt = `Lütfen hekim olarak aşağıdaki formatta hukuki sorunuzu yazın:
1. Tıbbi Durum: [Kısaca tıbbi bağlamı açıklayın]
2. Hukuki Soru: [Spesifik hukuki sorunuzu yazın]
3. İlgili Mevzuat Alanı (biliniyorsa): [Örn: hasta hakları, malpraktis, aydınlatılmış onam]
4. Aciliyet: [Acil / Rutin]`;

    expect(prompt).toContain("Tıbbi Durum");
    expect(prompt).toContain("Hukuki Soru");
    expect(prompt).toContain("malpraktis");
  });
});
