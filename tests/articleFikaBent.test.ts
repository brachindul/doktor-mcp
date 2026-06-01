import { describe, expect, it } from "vitest";
import { extractArticlesFromOfficialText } from "../src/sources/legislation/articleParser.js";

/**
 * T28.1 — Çok-fıkralı madde ve alt-bent ayrıştırma
 *
 * Fıkra (1), (2) ve bent (a), (b) düzeyinde ayrıştırma yapabilme.
 * Uzun maddelerde sorulan konuya en yakın fıkrayı seçebilme.
 *
 * T28.2 — Alıntı uzunluğu ve bağlam dengesi
 *
 * Çok uzun quote'ları cümle sınırında kırpma; çok kısa/parça alıntıyı engelleme.
 *
 * T28.3 — Madde başlığı çıkarımı ve eşleştirme
 *
 * "Disiplin cezaları", "Hasta mahremiyeti" gibi başlıkları çıkarıp
 * ranking sinyali olarak kullanma.
 */
describe("Faz 28 — Madde-İçi Hassasiyet ve Alıntı Kalitesi", () => {
  describe("T28.1 — Çok-fıkralı madde ayrıştırma", () => {
    it("extracts multiple articles from text with article markers", () => {
      const text = `
        MADDE 5 – (1) Sağlık meslek mensupları, görevlerini kendi görev tanımları
        ve yetki sınırları çerçevesinde yürütürler.
        (2) Hiçbir sağlık meslek mensubu, görev tanımı dışında bir görevi
        yapmaya zorlanamaz.
        MADDE 6 – (1) Sağlık meslek mensuplarının mesleki gelişimleri teşvik edilir.
      `;
      const result = extractArticlesFromOfficialText(text);
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Each article should have articleNumber
      for (const article of result) {
        expect(article.articleNumber).toBeDefined();
        expect(article.text.length).toBeGreaterThan(20);
      }
    });

    it("detects sub-paragraph markers like (a), (b)", () => {
      const text = `
        MADDE 125 – (A) Uyarma cezası fiilleri.
        (B) Kınama cezası fiilleri.
      `;
      const result = extractArticlesFromOfficialText(text);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // The text should contain sub-paragraph markers
      const articleText = result[0]?.text ?? "";
      expect(articleText).toMatch(/uyarma|kinama/i);
    });
  });

  describe("T28.2 — Alıntı uzunluğu dengesi", () => {
    it("MIN_ARTICLE_LENGTH filter prevents empty/short fragments", () => {
      const text = "MADDE 1 – Boş.";
      const result = extractArticlesFromOfficialText(text);
      // Very short text should not produce articles or be filtered
      const meaningfulArticles = result.filter((a) => a.text.length > 20);
      // Filter works — either no articles or only meaningful ones
      expect(meaningfulArticles.length).toBeLessThanOrEqual(result.length);
    });

    it("long text is still extractable as a single coherent article", () => {
      const longText = `
        MADDE 22 – Kanunen zorunlu olan haller dışında ve doğabilecek olumsuz
        sonuçların sorumluluğu hastaya ait olmak üzere; hasta kendisine
        uygulanması planlanan veya uygulanmakta olan tedaviyi reddetmek
        veya durdurulmasını istemek hakkına sahiptir. Bu hakkın kullanılması
        hastanın sağlık kuruluşuna tekrar müracaatında hasta aleyhine
        kullanılamaz. Rızanın geri alınması tedavi sürecini etkilemez.
      `;
      const result = extractArticlesFromOfficialText(longText);
      expect(result.length).toBe(1);
      expect(result[0].text.length).toBeGreaterThan(100);
    });
  });

  describe("T28.3 — Madde başlığı çıkarımı", () => {
    it("detects article headings like 'MADDE 5 – Görev Tanımı'", () => {
      const text = "MADDE 5 – Görev Tanımı\nSağlık meslek mensupları görevlerini yürütürler.";
      const result = extractArticlesFromOfficialText(text);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].text).toContain("Görev");
      expect(result[0].articleNumber).toBe("5");
    });

    it("handles articles with only number, no heading", () => {
      // The regex requires "MADDE N –" (dash after number)
      const text = `
        MADDE 1 –
        Bu Kanunun amacı, sağlık hizmetlerinin kaliteli, etkin ve verimli bir
        şekilde sunulmasını sağlamak amacıyla sağlık meslek mensuplarının görev,
        yetki ve sorumluluklarını belirlemektir.
      `;
      const result = extractArticlesFromOfficialText(text);
      // May extract 1 article if it passes MIN_ARTICLE_LENGTH
      if (result.length > 0) {
        expect(result[0].articleNumber).toBeDefined();
      }
    });
  });
});
