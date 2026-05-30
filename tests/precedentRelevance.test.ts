import { describe, expect, it } from "vitest";
import type { CourtDecision } from "../src/contracts/legal.js";
import { assessPrecedentRelevance, suggestedQueriesForQuestion } from "../src/health/precedentRelevance.js";

function decision(text: string, overrides: Partial<CourtDecision> = {}): CourtDecision {
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
    },
    ...overrides
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

    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.matchedIssueSignals.length).toBeGreaterThanOrEqual(2);
  });

  it("scores malpractice complication high with standard-of-care signals", () => {
    const result = assessPrecedentRelevance(
      "Komplikasyon malpraktis ayrimi ve hekimin ozen yukumlulugu nedir?",
      decision("Kararda komplikasyon, tibbi hata, hekim kusuru ve ozen yukumlulugu degerlendirilmistir.")
    );

    expect(result.issueProfile).toBe("malpractice_complication");
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("scores white code violence high with threat and healthcare worker signals", () => {
    const result = assessPrecedentRelevance(
      "Beyaz kod verdim, saglik personeline tehdit ve hakaret var.",
      decision("Saglik personeline tehdit, saglik personeline hakaret ve hekime siddet nedeniyle ceza sorumlulugu tartisilmistir.")
    );

    expect(result.issueProfile).toBe("violence_threat");
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("returns targeted query suggestions for benchmark-style questions", () => {
    expect(suggestedQueriesForQuestion("Hasta tedaviye uymuyor, hastayi reddedebilir miyim?", 2)).toEqual([
      "tedaviyi reddeden hasta",
      "hastanın tedaviye uymaması"
    ]);
  });
});

describe("precedent relevance — irrelevant fixture (tapu/trafik)", () => {
  it("scores tapu (land registry) decision below threshold for malpractice query", () => {
    const result = assessPrecedentRelevance(
      "Hekimin tıbbi müdahalesi sırasında komplikasyon oluştu.",
      decision(
        "Tapu iptali ve tescil davasında, taşınmazın mülkiyet uyuşmazlığı incelenmiştir. Kayıt düzeltme talebi değerlendirilmiştir.",
        { court: "yargitay", topicTags: ["tapu", "mülkiyet"] }
      )
    );
    expect(result.score).toBeLessThan(2);
  });

  it("scores trafik (traffic) decision below threshold for malpractice query", () => {
    const result = assessPrecedentRelevance(
      "Hekimin tıbbi müdahalesi sırasında komplikasyon oluştu.",
      decision(
        "Trafik kazası nedeniyle tazminat davasında, araç sürücüsünün kusur oranı belirlenmiştir. Karayolları Trafik Kanunu hükümleri değerlendirilmiştir.",
        { court: "yargitay", topicTags: ["trafik", "kaza"] }
      )
    );
    expect(result.score).toBeLessThan(2);
  });
});

describe("precedent relevance — relevant fixture scores above threshold", () => {
  it("scores health-law malpractice decision above threshold", () => {
    const result = assessPrecedentRelevance(
      "Komplikasyon ve tıbbi hata iddiası var.",
      decision(
        "Hekimin özen yükümlülüğü ihlal edilmiş, komplikasyon yönetimi tıbbi standartlara aykırı bulunmuştur. Hizmet kusuru ve tıbbi hata değerlendirmesi yapılmıştır.",
        { court: "danistay", topicTags: ["malpraktis", "komplikasyon"] }
      )
    );
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("scores informed consent decision with core-body signals above threshold", () => {
    const result = assessPrecedentRelevance(
      "Ameliyat öncesi aydınlatılmış rıza formu eksik.",
      decision(
        "Hastanın aydınlatılmış rızası alınmadan tıbbi müdahale gerçekleştirilmiştir. Onam ve bilgilendirme yükümlülüğü ihlal edilmiştir.",
        {
          court: "yargitay",
          topicTags: ["aydınlatılmış rıza", "onam"],
          legalReasoning: "Hekimin aydınlatma yükümlülüğü ve hasta rızası değerlendirilmiştir.",
          outcome: "Aydınlatılmış rıza alınmadığından tıbbi müdahale hukuka aykırıdır."
        }
      )
    );
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.matchedIssueSignals.length).toBeGreaterThanOrEqual(1);
  });
});

describe("precedent relevance — core-body bonus", () => {
  it("gives higher score when matched signals appear in legalReasoning and outcome", () => {
    const resultNoCore = assessPrecedentRelevance(
      "Komplikasyon ve tıbbi hata iddiası.",
      decision("Kararda komplikasyon ve tıbbi hata tartışılmıştır.")
    );

    const resultWithCore = assessPrecedentRelevance(
      "Komplikasyon ve tıbbi hata iddiası.",
      decision("Detaylı bilgi.", {
        legalReasoning: "Komplikasyon yönetimi ve tıbbi hata değerlendirmesi yapılmıştır.",
        outcome: "Hekimin özen yükümlülüğü ihlal edilerek komplikasyona yol açılmıştır."
      })
    );

    expect(resultWithCore.score).toBeGreaterThanOrEqual(resultNoCore.score);
  });
});

describe("precedent relevance — generic-only penalty", () => {
  it("applies penalty when only generic sağlık/hasta matches without specific issue signals", () => {
    const result = assessPrecedentRelevance(
      "Tıbbi müdahale sırasında komplikasyon oluştu.",
      decision(
        "Sağlık hizmeti sunumu kapsamında hasta tedavi edilmiştir.",
        { topicTags: [] }
      )
    );
    // Score should be low — only generic "sağlık", "hasta", "tedavi" matched
    expect(result.score).toBeLessThan(2);
    expect(result.whyWeak).not.toBeNull();
  });
});
