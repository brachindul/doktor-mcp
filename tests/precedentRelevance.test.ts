import { describe, expect, it } from "vitest";
import type { CourtDecision } from "../src/contracts/legal.js";
import { assessPrecedentRelevance, suggestedQueriesForQuestion } from "../src/health/precedentRelevance.js";

function decision(text: string): CourtDecision {
  return {
    id: "yargitay:test",
    court: "yargitay",
    factSummary: "Fixture decision",
    legalReasoning: text,
    outcome: "Sonuc.",
    relevanceNote: "Fixture relevance note.",
    topicTags: [],
    fullText: text,
    evidence: {
      source: "yargitay",
      documentId: "test",
      retrievedAt: "2026-05-23T00:00:00.000Z",
      official: true,
      fullText: true
    }
  };
}

describe("precedent relevance classifier", () => {
  it("marks general health wording weak when specific issue overlap is missing", () => {
    const result = assessPrecedentRelevance(
      "Ameliyat oncesi aydinlatilmis riza formu eksik.",
      decision("Hastane ve hasta arasindaki tazminat uyusmazligi incelenmistir.")
    );

    expect(result.issueProfile).toBe("informed_consent");
    expect(result.score).toBe(0);
    expect(result.whyWeak).toContain("specific informed_consent");
  });

  it("scores informed consent high when consent, disclosure, and complication signals appear", () => {
    const result = assessPrecedentRelevance(
      "Ameliyat oncesi aydinlatilmis riza formu eksik.",
      decision("Ameliyat oncesi bilgilendirme, aydinlatilmis riza ve komplikasyon hakkinda bilgilendirme tartisilmistir.")
    );

    expect(result.score).toBe(2);
    expect(result.matchedIssueSignals.length).toBeGreaterThanOrEqual(2);
  });

  it("scores malpractice complication high with standard-of-care signals", () => {
    const result = assessPrecedentRelevance(
      "Komplikasyon malpraktis ayrimi ve hekimin ozen yukumlulugu nedir?",
      decision("Kararda komplikasyon, tibbi hata, hekim kusuru ve ozen yukumlulugu degerlendirilmistir.")
    );

    expect(result.issueProfile).toBe("malpractice_complication");
    expect(result.score).toBe(2);
  });

  it("scores white code violence high with threat and healthcare worker signals", () => {
    const result = assessPrecedentRelevance(
      "Beyaz kod verdim, saglik personeline tehdit ve hakaret var.",
      decision("Saglik personeline tehdit, saglik personeline hakaret ve hekime siddet nedeniyle ceza sorumlulugu tartisilmistir.")
    );

    expect(result.issueProfile).toBe("violence_threat");
    expect(result.score).toBe(2);
  });

  it("returns targeted query suggestions for benchmark-style questions", () => {
    expect(suggestedQueriesForQuestion("Hasta tedaviye uymuyor, hastayi reddedebilir miyim?", 2)).toEqual([
      "tedaviyi reddeden hasta",
      "hastanın tedaviye uymaması"
    ]);
  });
});
