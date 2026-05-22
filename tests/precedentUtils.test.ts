import { describe, it, expect } from "vitest";
import {
  extractLegalReasoning,
  extractOutcome
} from "../src/sources/precedentUtils.js";

describe("extractLegalReasoning", () => {
  it("extracts reasoning using various markers", () => {
    const text1 = "Bazı giriş metinleri... GEREKÇE: Bu davanın reddine karar verilmelidir çünkü...";
    expect(extractLegalReasoning(text1)).toBe("GEREKÇE: Bu davanın reddine karar verilmelidir çünkü...");

    const text2 = "Ön bilgiler. Hukuki Değerlendirme: Taraflar arasındaki uyuşmazlık... Sonuç bölümü.";
    expect(extractLegalReasoning(text2)).toBe("Hukuki Değerlendirme: Taraflar arasındaki uyuşmazlık... Sonuç bölümü.");
  });

  it("returns truncated full text if no marker and length > 200", () => {
    const longText = "x".repeat(300);
    expect(extractLegalReasoning(longText)).toBe(longText);
  });

  it("returns undefined if no marker and length <= 200", () => {
    const shortText = "Kısa bir karar metni.";
    expect(extractLegalReasoning(shortText)).toBeUndefined();
  });
});

describe("extractOutcome", () => {
  it("extracts outcome using various markers", () => {
    const text1 = "x".repeat(500) + " SONUÇ: Davanın kabulüne karar verilmiştir.";
    expect(extractOutcome(text1)).toBe("SONUÇ: Davanın kabulüne karar verilmiştir.");

    const text2 = "x".repeat(500) + " HÜKÜM: Aşağıda yazılı hususlara hükmedildi.";
    expect(extractOutcome(text2)).toBe("HÜKÜM: Aşağıda yazılı hususlara hükmedildi.");
  });

  it("ignores markers in the first half of the text", () => {
    const text = "SONUÇ olarak başlangıçta belirttik. " + "x".repeat(1000);
    expect(extractOutcome(text)).toBeUndefined();
  });
});
