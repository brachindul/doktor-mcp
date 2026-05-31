import { describe, expect, it } from "vitest";
import { extractArticlesFromOfficialText } from "../src/sources/legislation/articleParser.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

describe("T21.3 — madde içi çapraz-referans tespiti", () => {
  it("synthetic: detects madde, fıkra, and bent cross-references", () => {
    const raw = `
MADDE 1 – Hüküm.
Bu hüküm 5 inci maddede ve 3. fıkrasında belirtilmiştir.

MADDE 2 – Diğer.
2'nci bendinde ve 4 üncü maddesinde düzenlenmiştir.

MADDE 3 – Son.
Başka bir atıf yok.
`;
    const articles = extractArticlesFromOfficialText(raw);
    const art1 = articles.find((a) => a.articleNumber === "1");
    const art2 = articles.find((a) => a.articleNumber === "2");
    const art3 = articles.find((a) => a.articleNumber === "3");

    expect(art1?.crossReferences).toContain("madde:5");
    expect(art1?.crossReferences).toContain("fikra:3");
    expect(art2?.crossReferences).toContain("bent:2");
    expect(art2?.crossReferences).toContain("madde:4");
    expect(art3?.crossReferences).toBeUndefined();
  });

  it("synthetic: deduplicates repeated references", () => {
    const raw = `
MADDE 1 – Hüküm.
5 inci maddede ve tekrar 5. maddede belirtilmiştir.
`;
    const articles = extractArticlesFromOfficialText(raw);
    const art1 = articles.find((a) => a.articleNumber === "1");
    expect(art1?.crossReferences?.filter((r) => r === "madde:5")).toHaveLength(1);
  });

  it("synthetic: ignores non-reference numbers", () => {
    const raw = `
MADDE 1 – Hüküm.
Kanun No. 2015 tarihli değişiklikle düzenlenmiştir.
`;
    const articles = extractArticlesFromOfficialText(raw);
    const art1 = articles.find((a) => a.articleNumber === "1");
    expect(art1?.crossReferences).toBeUndefined();
  });

  it("live Atama Yönetmeliği contains cross-references in expected articles", async () => {
    const adapter = new LiveOfficialLegislationAdapter();
    const doc = await adapter.fetchOfficialDocument("mevzuat:7.5.39700", { sourceName: "mevzuat.gov.tr" });
    if ((doc as any).status === "unavailable") {
      return;
    }
    const text = (doc as any).text as string;
    const articles = extractArticlesFromOfficialText(text);
    // At least one article should contain a cross-reference to another article/fıkra/bent
    const withRefs = articles.filter((a) => a.crossReferences && a.crossReferences.length > 0);
    expect(withRefs.length).toBeGreaterThanOrEqual(1);
    // Validate format: all refs should match "type:number"
    for (const a of withRefs) {
      for (const ref of a.crossReferences!) {
        expect(ref).toMatch(/^(madde|fikra|bent):\d+[A-Za-z]?$/);
      }
    }
  }, 30_000);
});
