import { describe, it, expect } from "vitest";
import { extractArticlesFromOfficialText } from "../src/sources/legislation/articleParser.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

describe("T21.2 — mülga / değişik madde tespiti", () => {
  it("synthetic: detects repealed article dominated by (Mülga:...) marker", () => {
    const raw = [
      "MADDE 1 – (1) Aktif madde metni burada yer alır ve yürürlükte olan hükümler içerir.",
      "MADDE 2 – (Mülga:RG-2/3/2018-30348)",
      "MADDE 3 – (1) Diğer aktif madde metni burada yer alır ve yürürlükte olan hükümler içerir."
    ].join("\n");

    const articles = extractArticlesFromOfficialText(raw);
    expect(articles.find((a) => a.articleNumber === "1")?.articleStatus).toBe("in_force");
    expect(articles.find((a) => a.articleNumber === "2")?.articleStatus).toBe("repealed");
    expect(articles.find((a) => a.articleNumber === "3")?.articleStatus).toBe("in_force");
  });

  it("synthetic: detects amended article containing (Değişik:...) marker", () => {
    const raw = [
      "MADDE 1 – (1) Bu madde metni (Değişik:RG-2/3/2018-30348) şeklinde değiştirilmiştir."
    ].join("\n");

    const articles = extractArticlesFromOfficialText(raw);
    expect(articles[0].articleStatus).toBe("amended");
  });

  it("synthetic: partially repealed article with substantive text is marked amended", () => {
    const raw = [
      "MADDE 1 – (1) Bu madde hala yürürlüktedir.\na) (Mülga:RG-2/3/2018-30348)\nb) Aktif bent burada yer almaktadır."
    ].join("\n");

    const articles = extractArticlesFromOfficialText(raw);
    expect(articles[0].articleStatus).toBe("amended");
  });

  it("live Atama Yönetmeliği contains correctly marked articles", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    const doc = await adapter.fetchOfficialDocument("mevzuat:7.5.17232", { sourceName: "mevzuat.gov.tr" });
    expect(doc).toBeDefined();
    expect(typeof (doc as any).text).toBe("string");

    const text = (doc as any).text as string;
    const articles = extractArticlesFromOfficialText(text);
    expect(articles.length).toBeGreaterThan(0);

    // Madde 4 contains (Mülga:...) sub-items but is not fully repealed → amended
    const m4 = articles.find((a) => a.articleNumber === "4");
    expect(m4).toBeDefined();
    expect(m4!.articleStatus).toBe("amended");

    // Most articles should be in_force
    const inForceCount = articles.filter((a) => a.articleStatus === "in_force").length;
    expect(inForceCount).toBeGreaterThan(articles.length * 0.5);
  }, 30_000);
});
