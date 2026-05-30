import { describe, expect, it } from "vitest";
import { pickHealthLawQuery, pickHealthLawQueries } from "../src/health/healthLawQueryExpansion.js";
import type { ClassifiedMedicalLegalQuestion } from "../src/contracts/legal.js";

function makeClassification(overrides: Partial<ClassifiedMedicalLegalQuestion> = {}): ClassifiedMedicalLegalQuestion {
  return {
    question: "Test question",
    dimensions: [],
    searchTerms: [],
    missingInformation: [],
    ...overrides
  };
}

describe("healthLawQueryExpansion — public employment queries", () => {
  it("pickHealthLawQueries includes atama/nakil iptal query for tayin term", () => {
    const classification = makeClassification({
      question: "Tayin ve yer değiştirme iptal davası",
      searchTerms: ["tayin"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("atama"))).toBe(true);
  });

  it("pickHealthLawQueries includes idari dava query for yer değiştirme term", () => {
    const classification = makeClassification({
      question: "Hekimin yer değiştirme talebi",
      searchTerms: ["yer değiştirme"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("kamu görevlisi") || q.includes("idari"))).toBe(true);
  });

  it("pickHealthLawQueries includes atama/nakil query for atama term", () => {
    const classification = makeClassification({
      question: "Sağlık personeli atama işlemi",
      searchTerms: ["atama"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("atama"))).toBe(true);
  });

  it("pickHealthLawQueries includes atama/nakil query for nakil term", () => {
    const classification = makeClassification({
      question: "Hekim nakil işlemi iptal edildi",
      searchTerms: ["nakil"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("atama") || q.includes("nakil"))).toBe(true);
  });
});

describe("healthLawQueryExpansion — discipline queries", () => {
  it("pickHealthLawQueries includes discipline cezası iptali query for disiplin term", () => {
    const classification = makeClassification({
      question: "Sağlık personeline verilen disiplin cezası",
      searchTerms: ["disiplin"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("disiplin"))).toBe(true);
  });

  it("pickHealthLawQueries includes discipline cezası query for disiplin cezası term", () => {
    const classification = makeClassification({
      question: "Doktora verilen disiplin cezası iptali",
      searchTerms: ["disiplin cezası"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("disiplin"))).toBe(true);
  });

  it("pickHealthLawQueries includes idari soruşturma query", () => {
    const classification = makeClassification({
      question: "Hekim hakkında idari soruşturma başlatıldı",
      searchTerms: ["idari soruşturma"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.some((q) => q.includes("idari") || q.includes("soruşturma"))).toBe(true);
  });
});

describe("healthLawQueryExpansion — privacy queries", () => {
  it("pickHealthLawQueries includes kişisel veri ihlali query for kişisel veri term", () => {
    const classification = makeClassification({
      question: "Kişisel veri ihlali tazminat davası",
      searchTerms: ["kişisel veri"]
    });
    const queries = pickHealthLawQueries(classification, 10);
    expect(queries.some((q) => q.includes("kişisel veri") || q.includes("mahremiyet"))).toBe(true);
  });

  it("pickHealthLawQueries includes kişisel veri query for kvkk term", () => {
    const classification = makeClassification({
      question: "KVKK kapsamında sağlık verisi sızıntısı",
      searchTerms: ["kvkk"]
    });
    const queries = pickHealthLawQueries(classification, 10);
    expect(queries.some((q) => q.includes("kişisel veri") || q.includes("kvkk") || q.includes("mahremiyet"))).toBe(true);
  });

  it("pickHealthLawQueries includes özel hayatın gizliliği query", () => {
    const classification = makeClassification({
      question: "Özel hayatın gizliliği sağlık verisi",
      searchTerms: ["özel hayatın gizliliği"]
    });
    const queries = pickHealthLawQueries(classification, 10);
    expect(queries.some((q) => q.includes("özel hayatın gizliliği") || q.includes("sağlık verisi"))).toBe(true);
  });
});

describe("healthLawQueryExpansion — pickHealthLawQueries (multi)", () => {
  it("returns multiple queries for public employment + discipline mixed", () => {
    const classification = makeClassification({
      question: "Tayin ve disiplin cezası aynı anda",
      searchTerms: ["tayin", "disiplin"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    expect(queries.length).toBeGreaterThan(1);
    expect(queries.some((q) => q.includes("atama"))).toBe(true);
    expect(queries.some((q) => q.includes("disiplin"))).toBe(true);
  });

  it("QUERY_EXPANSION entries are accessible via pickHealthLawQueries", () => {
    // Test that the expansion map entries work when search terms match
    const classification = makeClassification({
      question: "Atama ve nakil iptal davası",
      searchTerms: ["atama", "nakil"]
    });
    const queries = pickHealthLawQueries(classification, 5);
    // Should include the atama/nakil expansion query
    expect(queries.some((q) => q.includes("sağlık personeli atama"))).toBe(true);
  });
});
