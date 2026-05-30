import { describe, it, expect } from "vitest";
import { detectForbiddenOutputPhrases, ALLOWED_ASSESSMENT_PHRASES } from "../src/mcp/formatDoctorPackResponse.js";

describe("forbidden phrase calibration", () => {
  describe("hard-blocked phrases", () => {
    it("should detect 'kesin olarak sorumlusunuz'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Bu durumda kesin olarak sorumlusunuz." });
      expect(result).toContain("kesin olarak sorumlusunuz");
    });

    it("should detect 'kesin beraat eder'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Bu şartlarda kesin beraat eder." });
      expect(result).toContain("kesin beraat eder");
    });

    it("should detect 'kesin hukuki kanaat'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Kesin hukuki kanaat şudur ki..." });
      expect(result).toContain("kesin hukuki kanaat");
    });

    it("should detect 'şu cezayı alırsınız'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Bu fiil için şu cezayı alırsınız." });
      expect(result).toContain("şu cezayı alırsınız");
    });

    it("should detect 'dilekçe taslağı'", () => {
      const result = detectForbiddenOutputPhrases({ text: "İşte dilekçe taslağı..." });
      expect(result).toContain("dilekçe taslağı");
    });

    it("should detect 'derhal şunu yapın'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Derhal şunu yapın: başvurun." });
      expect(result).toContain("derhal şunu yapın");
    });
  });

  describe("allowed phrases (no longer blocked)", () => {
    it("should NOT block 'risk seviyesi yüksek'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Kaynaklara göre risk seviyesi yüksek görünmektedir." });
      expect(result).not.toContain("risk seviyesi yüksek");
      expect(result).toHaveLength(0);
    });

    it("should NOT block 'risk seviyesi düşük'", () => {
      const result = detectForbiddenOutputPhrases({ text: "Mevcut içtihat ışığında risk seviyesi düşük değerlendirilmektedir." });
      expect(result).not.toContain("risk seviyesi düşük");
      expect(result).toHaveLength(0);
    });

    it("should NOT block 'risk seviyesi dusuk' (ascii)", () => {
      const result = detectForbiddenOutputPhrases({ text: "risk seviyesi dusuk olarak gorulmektedir." });
      expect(result).not.toContain("risk seviyesi dusuk");
      expect(result).toHaveLength(0);
    });
  });

  describe("ALLOWED_ASSESSMENT_PHRASES export", () => {
    it("should match the expected allowed phrases", () => {
      expect(ALLOWED_ASSESSMENT_PHRASES).toEqual([
        "risk seviyesi yüksek",
        "risk seviyesi dusuk",
        "risk seviyesi düşük"
      ]);
    });
  });

  describe("edge cases", () => {
    it("should return empty array for clean text", () => {
      const result = detectForbiddenOutputPhrases({ text: "Bu maddeye göre değerlendirilebilir." });
      expect(result).toHaveLength(0);
    });

    it("should detect multiple hard-blocked phrases", () => {
      const result = detectForbiddenOutputPhrases({
        text: "Kesin hukuki kanaat: beraat. Derhal şunu yapın."
      });
      expect(result).toHaveLength(2);
      expect(result).toContain("kesin hukuki kanaat");
      expect(result).toContain("derhal şunu yapın");
    });

    it("should be case-insensitive for ASCII input", () => {
      const result = detectForbiddenOutputPhrases({ text: "DERHAL SUNU YAPIN" });
      expect(result).toContain("derhal sunu yapin");
    });
  });
});
