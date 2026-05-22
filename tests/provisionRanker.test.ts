import { describe, expect, it } from "vitest";
import { rankArticle, rankExtractedArticles } from "../src/sources/legislation/provisionRanker.js";
import type { HealthLegislationHint } from "../src/sources/legislation/liveTypes.js";

const hint: HealthLegislationHint = {
  topicCluster: "informed_consent",
  legislationRole: "health_primary",
  healthLawPriority: 10,
  selectionReason: "Test informed consent mapping.",
  terms: ["riza", "onam"],
  query: "Hasta Haklari Yonetmeligi",
  title: "Hasta Haklari Yonetmeligi",
  sourceId: "mevzuat:7.5.4847",
  legislationNumber: "4847",
  legislationType: "7",
  legislationArrangement: "5",
  articleNumbers: ["24"],
  dimensions: ["patient_rights"]
};

describe("health provision ranker", () => {
  it("adds a mapped article bonus and non-empty reasons", () => {
    const mapped = rankArticle("aydınlatılmış rıza", hint, {
      articleNumber: "24",
      text: "Rıza başlığı. Hastanın rızası tıbbi müdahalede aranır."
    });

    expect(mapped.fromMappedArticleList).toBe(true);
    expect(mapped.score).toBeGreaterThan(100);
    expect(mapped.rankingReasons).not.toEqual([]);
  });

  it("raises score for query terms and leaves unrelated articles low", () => {
    const related = rankArticle("aydınlatılmış rıza", hint, {
      articleNumber: "26",
      text: "Aydınlatılmış rıza formu hastaya anlatılır."
    });
    const unrelated = rankArticle("aydınlatılmış rıza", hint, {
      articleNumber: "99",
      text: "Kurumun çalışma saatleri ilan edilir."
    });

    expect(related.score).toBeGreaterThan(unrelated.score);
    expect(related.matchedTerms).toEqual(expect.arrayContaining(["riza"]));
    expect(unrelated.fromMappedArticleList).toBe(false);
  });

  it("rejects low-signal articles from the selected result", () => {
    const result = rankExtractedArticles("aydınlatılmış rıza", hint, [
      { articleNumber: "24", text: "Hastanın rızası alınır." },
      { articleNumber: "99", text: "Kurum binası düzenlenir." }
    ]);

    expect(result.selected.map(({ article }) => article.articleNumber)).toEqual(["24"]);
    expect(result.rejected.map(({ article }) => article.articleNumber)).toContain("99");
  });
});
