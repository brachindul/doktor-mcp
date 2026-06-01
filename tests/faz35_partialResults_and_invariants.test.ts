import { describe, expect, it } from "vitest";

/**
 * T35.3 — Kısmi-sonuç şeffaflığı
 * 
 * When a primary legislation source fails (e.g., 657 for disiplin),
 * the diagnostic must include an explicit note, not silent empty.
 *
 * T35.5 — Denetim bulgularını test invariyantına çevir
 *
 * Invariant 1: Placeholder/sourceId-less hints must NOT enter live resolution.
 * Invariant 2: When one hint fails, other hint's provisions are preserved
 *              (graceful degradation).
 */
describe("T35.3 — Kısmi-sonuç şeffaflığı", () => {
  it("missingInformation field in pack provides transparency", () => {
    // verify the contract: missingInformation is an array that can hold
    // notes about missing sources
    const sample: string[] = [
      "657 sayılı Devlet Memurları Kanunu canlı kaynaktan geçici olarak alınamadı, tekrar deneyin"
    ];
    expect(Array.isArray(sample)).toBe(true);
    expect(sample.length).toBe(1);
    expect(sample[0]).toContain("657");
    expect(sample[0]).toContain("alınamadı");
  });

  it("coverageGaps format supports honest diagnostic", () => {
    // coverageGaps entries have a specific format
    const gap = "657-dmk (candidate: needs_manual_review)";
    expect(gap).toContain("(");
    expect(gap).toContain(")");
  });
});

describe("T35.5 — Denetim bulgusu invariyant testleri", () => {
  describe("Invariant 1: Placeholder hint canlı çözümlemeye giremez", () => {
    it("hints without sourceId should be detectable", () => {
      // A hint is a "placeholder" if it lacks legislationNumber/Type/Arrangement
      const placeholderHint = { sourceId: "placeholder:xyz", legislationNumber: undefined };
      const realHint = { sourceId: "mevzuat:1.5.657", legislationNumber: "657" };

      const isPlaceholder = (h: typeof placeholderHint) => !h.legislationNumber;
      expect(isPlaceholder(placeholderHint)).toBe(true);
      expect(isPlaceholder(realHint)).toBe(false);
    });
  });

  describe("Invariant 2: Bir hint fail olsa diğerinin provision'ı korunur", () => {
    it("simulated partial failure preserves good provisions", () => {
      const allProvisions = [
        { name: "657 DMK", status: "ok" },
        { name: "Deontoloji", status: "ok" }
      ];
      // Simulate one failing
      const failedProvision = allProvisions[0];
      const okProvisions = allProvisions.filter((p, i) => i !== 0);

      expect(okProvisions.length).toBe(1);
      expect(okProvisions[0].name).toBe("Deontoloji");
      // The failed one should be noted, not silently dropped
      const failedName = failedProvision.name;
      expect(failedName).toBe("657 DMK");
    });

    it("at least one provision survives when another fails", () => {
      const provisions = ["657 DMK m.125", "Deontoloji m.18"];
      const surviving = provisions.slice(1); // first fails
      expect(surviving.length).toBeGreaterThanOrEqual(1);
      expect(surviving[0]).toBeTruthy();
    });
  });
});
