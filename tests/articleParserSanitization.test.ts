import { describe, it, expect } from "vitest";
import { extractArticlesFromOfficialText } from "../src/sources/legislation/articleParser.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

describe("T21.1 — article extraction noise sanitization", () => {
  it("removes page markers and separators from synthetic text", () => {
    const raw = [
      "MADDE 1 – (1) Bu Yönetmeliğin amacı; sağlık hizmetlerinin yurt genelinde etkin bir şekilde yürütülmesini sağlamaktır.",
      "",
      "-- 1 of 3 --",
      "MADDE 2 – (1) Bu Yönetmelik kapsamına giren personel ve kurumlar bu hükümlere tabidir.",
      "",
      "_______",
      "-- 2 of 3 --",
      "MADDE 3 – (1) Hükümlerin yürütülmesinden Sağlık Bakanı sorumludur ve bu Yönetmelik yayımlandığı tarihte yürürlüğe girer.",
      "",
      "Yönetmeliğin Yayımlandığı Resmî Gazete",
      "Tarihi \t Sayısı",
      "1. \t 4/4/2015 \t 29316",
      "-- 3 of 3 --"
    ].join("\n");

    const articles = extractArticlesFromOfficialText(raw);
    expect(articles.length).toBe(3);
    expect(articles[0].text).not.toContain("-- 1 of 3 --");
    expect(articles[1].text).not.toContain("_______");
    expect(articles[2].text).not.toContain("Yönetmeliğin Yayımlandığı Resmî Gazete");
    expect(articles[2].text).not.toContain("29316");
    expect(articles[2].text).toContain("Hükümlerin yürütülmesinden");
  });

  it("filters out empty or fragment articles", () => {
    const raw = [
      "MADDE 1 – (1) Gerçek içerik burada yer alır ve bu madde yeterince uzundur.",
      "MADDE 2 – ",
      "MADDE 3 – x",
      "MADDE 4 – (1) Başka gerçek içerik de burada yer alır ve yeterince uzundur."
    ].join("\n");

    const articles = extractArticlesFromOfficialText(raw);
    expect(articles.map((a) => a.articleNumber)).toEqual(["1", "4"]);
  });

  it("live Atama Yönetmeliği articles contain no RG metadata or page markers", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    const doc = await adapter.fetchOfficialDocument("mevzuat:7.5.17232", { sourceName: "mevzuat.gov.tr" });
    expect(doc).toBeDefined();
    expect(typeof (doc as any).text).toBe("string");

    const text = (doc as any).text as string;
    const articles = extractArticlesFromOfficialText(text);
    expect(articles.length).toBeGreaterThan(0);

    for (const article of articles) {
      expect(article.text).not.toMatch(/--\s*\d+\s+of\s+\d+\s*--/);
      expect(article.text).not.toMatch(/Yönetmeliğin\s+Yayımlandığı\s+Resm[iî]\s*Gazete/i);
      expect(article.text).not.toMatch(/_{3,}/);
      expect(article.text.length).toBeGreaterThanOrEqual(25);
    }
  }, 30_000);

  it("live TUEY articles contain no RG metadata or page markers", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    const doc = await adapter.fetchOfficialDocument("mevzuat:7.5.39700", { sourceName: "mevzuat.gov.tr" });
    expect(doc).toBeDefined();
    expect(typeof (doc as any).text).toBe("string");

    const text = (doc as any).text as string;
    const articles = extractArticlesFromOfficialText(text);
    expect(articles.length).toBeGreaterThan(0);

    for (const article of articles) {
      expect(article.text).not.toMatch(/--\s*\d+\s+of\s+\d+\s*--/);
      expect(article.text).not.toMatch(/Yönetmeliğin\s+Yayımlandığı\s+Resm[iî]\s*Gazete/i);
      expect(article.text).not.toMatch(/_{3,}/);
      expect(article.text.length).toBeGreaterThanOrEqual(25);
    }
  }, 30_000);
});
