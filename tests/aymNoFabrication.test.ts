import { describe, it, expect } from "vitest";
import { MockAymAdapter } from "../src/sources/aym/mockAymAdapter.js";

describe("AYM no fabrication", () => {
  it("should return empty decisions list", async () => {
    const adapter = new MockAymAdapter();
    const result = await adapter.searchHealthPrecedents({
      question: "Test sorusu",
      dimensions: ["patient_rights"],
      searchTerms: ["test"],
      missingInformation: []
    });
    expect(result).toHaveLength(0);
  });

  it("should report synthetic_only calibration status", () => {
    const adapter = new MockAymAdapter();
    expect(adapter.calibrationStatus).toBe("synthetic_only");
  });

  it("should provide a clear reason for unavailability", () => {
    const adapter = new MockAymAdapter();
    expect(adapter.calibrationReason).toContain("HTML");
    expect(adapter.calibrationReason).toContain("JSON API");
    expect(adapter.calibrationReason).toContain("uydurma karar");
  });

  it("should have sourceId set to aym", () => {
    const adapter = new MockAymAdapter();
    expect(adapter.sourceId).toBe("aym");
  });
});
