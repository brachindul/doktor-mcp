import { describe, it, expect } from "vitest";
import { buildInventoryReport } from "../src/healthLegislationInventory.js";

describe("coverageMatrix", () => {
  it("should produce a report with verified entries", () => {
    const r = buildInventoryReport();
    expect(r.verifiedEntries.length).toBeGreaterThan(0);
  });

  it("verified entries should have title and legislationType", () => {
    const r = buildInventoryReport();
    for (const e of r.verifiedEntries) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.legislationType).toBe("string");
    }
  });

  it("should include total count stats", () => {
    const r = buildInventoryReport();
    expect(r.inventoryTotalCount).toBeGreaterThan(0);
    expect(r.verifiedOfficialSourceCount).toBeGreaterThan(0);
  });
});
