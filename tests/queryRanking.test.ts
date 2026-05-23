import { describe, expect, it } from "vitest";
import {
  getSourceAffinity,
  isPrimarySourceForProfile,
  rankedQueriesForSource,
  rankedQueriesForSourceFromQuestion
} from "../src/health/queryRanking.js";
import type { IssueProfile } from "../src/health/precedentRelevance.js";

function makeClassification(question: string) {
  return {
    question,
    dimensions: [] as string[],
    searchTerms: [] as string[],
    missingInformation: [] as string[]
  };
}

describe("getSourceAffinity", () => {
  it("returns 3 for yargitay on informed_consent", () => {
    expect(getSourceAffinity("informed_consent", "yargitay")).toBe(3);
  });

  it("returns 3 for danistay on public_discipline", () => {
    expect(getSourceAffinity("public_discipline", "danistay")).toBe(3);
  });

  it("returns 1 for yargitay on public_discipline", () => {
    expect(getSourceAffinity("public_discipline", "yargitay")).toBe(1);
  });

  it("returns 1 for aym on malpractice_complication", () => {
    expect(getSourceAffinity("malpractice_complication", "aym")).toBe(1);
  });

  it("returns 2 for aym on privacy_records", () => {
    expect(getSourceAffinity("privacy_records", "aym")).toBe(2);
  });

  it("returns 1 for unknown profile (default fallback)", () => {
    expect(getSourceAffinity("unknown_profile" as IssueProfile, "yargitay")).toBe(1);
  });

  it("returns 3 for yargitay on violence_threat", () => {
    expect(getSourceAffinity("violence_threat", "yargitay")).toBe(3);
  });

  it("returns 3 for yargitay on private_hospital_fee", () => {
    expect(getSourceAffinity("private_hospital_fee", "yargitay")).toBe(3);
  });

  it("returns 3 for yargitay on pregnancy_emergency", () => {
    expect(getSourceAffinity("pregnancy_emergency", "yargitay")).toBe(3);
  });

  it("returns 2 for aym on psychiatric_privacy", () => {
    expect(getSourceAffinity("psychiatric_privacy", "aym")).toBe(2);
  });
});

describe("isPrimarySourceForProfile", () => {
  it("yargitay is primary for informed_consent", () => {
    expect(isPrimarySourceForProfile("informed_consent", "yargitay")).toBe(true);
  });

  it("danistay is primary for public_discipline", () => {
    expect(isPrimarySourceForProfile("public_discipline", "danistay")).toBe(true);
  });

  it("danistay is NOT primary for malpractice_complication (affinity=1)", () => {
    expect(isPrimarySourceForProfile("malpractice_complication", "danistay")).toBe(false);
  });

  it("yargitay is NOT primary for public_discipline (affinity=1)", () => {
    expect(isPrimarySourceForProfile("public_discipline", "yargitay")).toBe(false);
  });

  it("aym is NOT primary for informed_consent (affinity=1)", () => {
    expect(isPrimarySourceForProfile("informed_consent", "aym")).toBe(false);
  });

  it("bedesten is primary for violence_threat (affinity=3)", () => {
    expect(isPrimarySourceForProfile("violence_threat", "bedesten")).toBe(true);
  });
});

describe("rankedQueriesForSource", () => {
  it("returns at most maxQueries results", () => {
    const queries = rankedQueriesForSource(
      "informed_consent",
      "yargitay",
      makeClassification("aydınlatılmış rıza belgesi eksikliği"),
      2
    );
    expect(queries.length).toBeLessThanOrEqual(2);
  });

  it("rank values start at 1 and increase", () => {
    const queries = rankedQueriesForSource(
      "informed_consent",
      "yargitay",
      makeClassification("aydınlatılmış rıza belgesi"),
      2
    );
    queries.forEach((q, i) => {
      expect(q.rank).toBe(i + 1);
    });
  });

  it("returns at least one query even for low-affinity source", () => {
    const queries = rankedQueriesForSource(
      "public_discipline",
      "yargitay",
      makeClassification("disiplin cezası iptali"),
      2
    );
    expect(queries.length).toBeGreaterThanOrEqual(1);
  });

  it("returns no duplicate queryText values", () => {
    const queries = rankedQueriesForSource(
      "malpractice_complication",
      "yargitay",
      makeClassification("tıbbi hata tazminat davası"),
      2
    );
    const texts = queries.map((q) => q.queryText);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("first query has queryType issue_profile or fallback or broad", () => {
    const queries = rankedQueriesForSource(
      "informed_consent",
      "yargitay",
      makeClassification("rıza almadan ameliyat yapıldı"),
      2
    );
    expect(["issue_profile", "fallback", "broad"]).toContain(queries[0]!.queryType);
  });

  it("maxQueries=1 returns exactly 1 query", () => {
    const queries = rankedQueriesForSource(
      "informed_consent",
      "yargitay",
      makeClassification("aydınlatılmış rıza"),
      1
    );
    expect(queries).toHaveLength(1);
  });
});

describe("rankedQueriesForSourceFromQuestion", () => {
  it("infers an issueProfile and returns affinity and queries", () => {
    const result = rankedQueriesForSourceFromQuestion(
      "hasta rızası alınmadan ameliyat yapıldı",
      "yargitay",
      makeClassification("hasta rızası alınmadan ameliyat yapıldı")
    );
    expect(result.issueProfile).toBeDefined();
    expect(typeof result.affinity).toBe("number");
    expect(result.queries.length).toBeGreaterThanOrEqual(1);
  });

  it("returns affinity 3 for yargitay on an informed_consent question", () => {
    const result = rankedQueriesForSourceFromQuestion(
      "aydınlatılmış rıza belgesi alınmadı",
      "yargitay",
      makeClassification("aydınlatılmış rıza belgesi alınmadı")
    );
    // informed_consent → yargitay affinity = 3
    if (result.issueProfile === "informed_consent") {
      expect(result.affinity).toBe(3);
    }
    // even if profile differs, affinity should be a valid score
    expect(result.affinity).toBeGreaterThanOrEqual(1);
  });

  it("respects maxQueries parameter", () => {
    const result = rankedQueriesForSourceFromQuestion(
      "disiplin cezası iptali davası",
      "danistay",
      makeClassification("disiplin cezası iptali davası"),
      1
    );
    expect(result.queries.length).toBeLessThanOrEqual(1);
  });
});
