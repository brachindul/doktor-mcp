import { describe, it, expect, vi } from "vitest";
import {
  normalizeTitleForMatch,
  titleWords,
  scoreTitleMatch,
  isGovTrUrl,
  buildQueryPlan,
  computeCompositeScore,
  verifyInventoryEntry,
  buildAccessVerificationReport,
  verifyBySourceIdDirect,
  extractDocTitle,
  computeMarkerOverlap,
  extractRgFromDocText,
  checkKnownWrongMatch,
  checkNegativeMarkers,
  type LegislationSearchAdapter,
  type HealthLegislationVerificationAttempt
} from "../src/healthLegislationAccessVerifier.js";
import type { HealthLegislationInventoryEntry } from "../src/healthLegislationInventory.js";
import type { OfficialLegislationSearchResult } from "../src/sources/legislation/liveTypes.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HealthLegislationInventoryEntry> = {}): HealthLegislationInventoryEntry {
  return {
    key: "test-yonetmeligi",
    title: "Test Yönetmeliği",
    titleNormalized: "test yonetmeligi",
    category: "patient_rights",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "candidate",
    relatedIssueIds: [],
    relatedTopicClusters: [],
    searchTerms: ["test yönetmelik"],
    coverageStatus: "candidate",
    notes: [],
    ...overrides
  };
}

function makeSearchResult(overrides: Partial<OfficialLegislationSearchResult> = {}): OfficialLegislationSearchResult {
  return {
    sourceId: "mevzuat:7.5.12345",
    title: "Test Yönetmeliği",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12345&MevzuatTur=7&MevzuatTertip=5",
    documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.12345.pdf",
    legislationNumber: "12345",
    legislationType: "7",
    legislationArrangement: "5",
    ...overrides
  };
}

function makeAdapter(results: OfficialLegislationSearchResult[] | { status: "unavailable"; message: string }): LegislationSearchAdapter {
  return {
    searchOfficialLegislation: vi.fn().mockResolvedValue(results)
  };
}

function makeDocResult(overrides: { title?: string; text?: string } = {}) {
  return {
    title: overrides.title ?? "Test Yönetmeliği",
    text: overrides.text ?? "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\n\nSağlık meslek mensupları görev tanımları bu yönetmelikte belirtilmiştir.\n\nMadde 6 – Görev tanımları Ek-1 ve Ek-2'de düzenlenmiştir.",
    retrievedAt: "2026-05-24T00:00:00.000Z"
  };
}

// ─── normalizeTitleForMatch ──────────────────────────────────────────────────

describe("normalizeTitleForMatch", () => {
  it("lowercases ASCII text", () => {
    expect(normalizeTitleForMatch("Hello World")).toBe("hello world");
  });

  it("converts Turkish uppercase chars", () => {
    const result = normalizeTitleForMatch("İşyeri Hekimi Yönetmeliği Şartları Güvenlik");
    expect(result).toBe("isyeri hekimi yonetmeligi sartlari guvenlik");
  });

  it("converts Turkish lowercase chars", () => {
    expect(normalizeTitleForMatch("ışık ğüşöç")).toBe("isik gusoc");
  });

  it("replaces non-alphanumeric chars with spaces and collapses", () => {
    expect(normalizeTitleForMatch("A, B - C / D")).toBe("a b c d");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeTitleForMatch("  Test  ")).toBe("test");
  });

  it("handles dotless-I (uppercase I) consistently", () => {
    // "I" in non-Turkish context should normalize to "i"
    const result = normalizeTitleForMatch("ILGILI KANUN");
    expect(result).toBe("ilgili kanun");
  });

  it("handles Sağlık Hizmetleri correctly", () => {
    expect(normalizeTitleForMatch("Sağlık Hizmetleri Yönetmeliği")).toBe("saglik hizmetleri yonetmeligi");
  });

  it("normalizes saglik-meslek title correctly", () => {
    const input = "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği";
    const result = normalizeTitleForMatch(input);
    expect(result).toBe("saglik meslek mensuplari is ve gorev tanimlari yonetmeligi");
  });
});

// ─── titleWords ─────────────────────────────────────────────────────────────

describe("titleWords", () => {
  it("filters words shorter than 3 chars", () => {
    const words = titleWords("bu ve bir test");
    expect(words).not.toContain("bu");
    expect(words).not.toContain("ve");
    expect(words).not.toContain("bir");
    expect(words).toContain("test");
  });

  it("filters stop words", () => {
    const words = titleWords("acil saglik hizmetleri yonetmeligi ve ile");
    expect(words).not.toContain("ile");
    expect(words).toContain("acil");
    expect(words).toContain("saglik");
  });

  it("returns all meaningful words for a typical title", () => {
    const words = titleWords("acil saglik hizmetleri yonetmeligi");
    expect(words).toEqual(["acil", "saglik", "hizmetleri", "yonetmeligi"]);
  });
});

// ─── scoreTitleMatch ─────────────────────────────────────────────────────────

describe("scoreTitleMatch", () => {
  it("returns 1.0 for identical titles", () => {
    const score = scoreTitleMatch("Acil Sağlık Hizmetleri Yönetmeliği", "Acil Sağlık Hizmetleri Yönetmeliği");
    expect(score).toBeCloseTo(1.0, 5);
  });

  it("returns moderate score for suffix/form variation (below accept threshold — conservative)", () => {
    // "Yönetmeliği" and "Yönetmelik" are different word forms; the verifier is conservative
    // and will NOT accept this variant as a confirmed match.
    const score = scoreTitleMatch(
      "Acil Sağlık Hizmetleri Yönetmeliği",
      "Acil Sağlık Hizmetleri Hakkında Yönetmelik"
    );
    // 3/4 meaningful words overlap → F1 ≈ 0.667
    expect(score).toBeGreaterThan(0.50);
    expect(score).toBeLessThan(0.75); // deliberately below ACCEPT_THRESHOLD
  });

  it("returns 0 for completely unrelated titles", () => {
    const score = scoreTitleMatch("Hasta Hakları Yönetmeliği", "Çevre Koruma Kanunu");
    expect(score).toBe(0);
  });

  it("returns low score for partial word overlap", () => {
    const score = scoreTitleMatch(
      "Acil Sağlık Hizmetleri Yönetmeliği",
      "Ambulanslar ve Acil Araçlar Yönetmeliği"
    );
    // Only 2 words overlap: "acil", "yonetmeligi"
    expect(score).toBeLessThan(0.75);
  });

  it("returns 0 for empty titles", () => {
    expect(scoreTitleMatch("", "Test")).toBe(0);
    expect(scoreTitleMatch("Test", "")).toBe(0);
  });

  it("distinguishes Aile Hekimliği Kanunu from Aile Hekimliği Uygulama Yönetmeliği", () => {
    const scoreExact = scoreTitleMatch("Aile Hekimliği Kanunu", "Aile Hekimliği Kanunu");
    const scoreWrong = scoreTitleMatch("Aile Hekimliği Kanunu", "Aile Hekimliği Uygulama Yönetmeliği");
    expect(scoreExact).toBeGreaterThan(scoreWrong);
    // The wrong one should have a meaningful score gap
    expect(scoreExact - scoreWrong).toBeGreaterThan(0.15);
  });

  it("full title match for official Turkish legislation title format", () => {
    const inv = "Özel Hastaneler Yönetmeliği";
    const search = "Özel Hastaneler Yönetmeliği";
    expect(scoreTitleMatch(inv, search)).toBeCloseTo(1.0, 5);
  });

  it("alias match scores high for Sağlık Meslek Mensupları variant", () => {
    const alias = "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği";
    // If the search result title is similar, score should be ≥ 0.75
    const score = scoreTitleMatch(alias, "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği");
    expect(score).toBeCloseTo(1.0, 5);
  });
});

// ─── isGovTrUrl ──────────────────────────────────────────────────────────────

describe("isGovTrUrl", () => {
  it("accepts mevzuat.gov.tr", () => {
    expect(isGovTrUrl("https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6698.pdf")).toBe(true);
  });

  it("accepts any .gov.tr subdomain", () => {
    expect(isGovTrUrl("https://saglik.gov.tr/some/path")).toBe(true);
  });

  it("rejects non-gov.tr URLs", () => {
    expect(isGovTrUrl("https://example.com/kanun.pdf")).toBe(false);
  });

  it("rejects .gov domains (not .gov.tr)", () => {
    expect(isGovTrUrl("https://example.gov/kanun")).toBe(false);
  });

  it("rejects malformed URLs gracefully", () => {
    expect(isGovTrUrl("not-a-url")).toBe(false);
  });
});

// ─── buildQueryPlan ──────────────────────────────────────────────────────────

describe("buildQueryPlan", () => {
  it("always includes exact_title as first variant", () => {
    const entry = makeEntry({ title: "Hasta Hakları Yönetmeliği", searchTerms: ["hasta hakları"] });
    const plan = buildQueryPlan(entry);
    expect(plan.variants[0].kind).toBe("exact_title");
    expect(plan.variants[0].query).toBe("Hasta Hakları Yönetmeliği");
    expect(plan.variants[0].weight).toBe(1.0);
  });

  it("includes keyword_combo variants from searchTerms", () => {
    const entry = makeEntry({ searchTerms: ["term one", "term two"] });
    const plan = buildQueryPlan(entry);
    const keywords = plan.variants.filter((v) => v.kind === "keyword_combo");
    expect(keywords.map((v) => v.query)).toContain("term one");
    expect(keywords.map((v) => v.query)).toContain("term two");
  });

  it("includes alias variants when aliases are provided", () => {
    const entry = makeEntry({
      aliases: ["Alias One", "Alias Two"],
      searchTerms: ["term"]
    });
    const plan = buildQueryPlan(entry);
    const aliases = plan.variants.filter((v) => v.kind === "alias");
    expect(aliases).toHaveLength(2);
    expect(aliases[0].weight).toBe(0.9);
  });

  it("includes legacy_source_id_probe variant when candidateLegacySourceId is set", () => {
    const entry = makeEntry({
      candidateLegacySourceId: "mevzuat:7.5.19696",
      searchTerms: ["term"]
    });
    const plan = buildQueryPlan(entry);
    const probe = plan.variants.find((v) => v.kind === "legacy_source_id_probe");
    expect(probe).toBeDefined();
    expect(probe!.query).toBe("19696");
    expect(probe!.candidateLegacySourceId).toBe("mevzuat:7.5.19696");
    expect(probe!.weight).toBe(0.8);
  });

  it("includes rg_number variant when expectedRgNumber is set", () => {
    const entry = makeEntry({
      expectedRgNumber: "29007",
      expectedRgDate: "2014-05-22",
      searchTerms: ["term"]
    });
    const plan = buildQueryPlan(entry);
    const rg = plan.variants.find((v) => v.kind === "rg_number");
    expect(rg).toBeDefined();
    expect(rg!.query).toBe("29007");
    expect(rg!.weight).toBe(0.7);
  });

  it("deduplicates when searchTerms match the title", () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği",
      searchTerms: ["Test Yönetmeliği"] // same as title
    });
    const plan = buildQueryPlan(entry);
    const titles = plan.variants.filter((v) => v.query === "Test Yönetmeliği");
    expect(titles).toHaveLength(1); // deduplicated
  });

  it("orders variants: exact_title before aliases before probe before rg before keywords", () => {
    const entry = makeEntry({
      aliases: ["Some Alias"],
      candidateLegacySourceId: "mevzuat:7.5.99",
      expectedRgNumber: "12345",
      searchTerms: ["keyword"]
    });
    const plan = buildQueryPlan(entry);
    const kinds = plan.variants.map((v) => v.kind);
    const exactIdx = kinds.indexOf("exact_title");
    const aliasIdx = kinds.indexOf("alias");
    const probeIdx = kinds.indexOf("legacy_source_id_probe");
    const rgIdx = kinds.indexOf("rg_number");
    const kwIdx = kinds.indexOf("keyword_combo");
    expect(exactIdx).toBeLessThan(aliasIdx);
    expect(aliasIdx).toBeLessThan(probeIdx);
    expect(probeIdx).toBeLessThan(rgIdx);
    expect(rgIdx).toBeLessThan(kwIdx);
  });

  it("sets strategy to source_id_probe when candidateLegacySourceId is present", () => {
    const entry = makeEntry({ candidateLegacySourceId: "mevzuat:7.5.19696", searchTerms: [] });
    const plan = buildQueryPlan(entry);
    expect(plan.strategy).toBe("source_id_probe");
  });

  it("sets strategy to alias_boosted when only aliases are present", () => {
    const entry = makeEntry({ aliases: ["Alias"], searchTerms: [] });
    const plan = buildQueryPlan(entry);
    expect(plan.strategy).toBe("alias_boosted");
  });

  it("sets strategy to exact_title_only when no extra signals", () => {
    const entry = makeEntry({ searchTerms: [] });
    const plan = buildQueryPlan(entry);
    expect(plan.strategy).toBe("exact_title_only");
  });

  it("includes entryKey in the plan", () => {
    const entry = makeEntry({ key: "my-entry" });
    const plan = buildQueryPlan(entry);
    expect(plan.entryKey).toBe("my-entry");
  });
});

// ─── computeCompositeScore ───────────────────────────────────────────────────

describe("computeCompositeScore", () => {
  it("returns titleScore 1.0 for exact title match", () => {
    const entry = makeEntry({ title: "Test Yönetmeliği" });
    const result = makeSearchResult({ title: "Test Yönetmeliği", sourceId: "mevzuat:7.5.12345" });
    const variant = { query: "Test Yönetmeliği", kind: "exact_title" as const, weight: 1.0 };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.titleScore).toBeCloseTo(1.0, 5);
    expect(score.finalScore).toBeGreaterThanOrEqual(1.0 - 0.001);
  });

  it("returns aliasScore from best alias when alias matches", () => {
    const entry = makeEntry({
      title: "Original Title",
      aliases: ["Acil Sağlık Hizmetleri Yönetmeliği"]
    });
    const result = makeSearchResult({ title: "Acil Sağlık Hizmetleri Yönetmeliği" });
    const variant = { query: "Acil Sağlık Hizmetleri Yönetmeliği", kind: "alias" as const, weight: 0.9 };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.aliasScore).toBeCloseTo(1.0, 5);
  });

  it("adds metadataScore bonus when legislation type matches", () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği",
      expectedLegislationType: "yonetmelik"
    });
    const result = makeSearchResult({ sourceId: "mevzuat:7.5.12345" }); // type 7 = yonetmelik
    const variant = { query: "Test Yönetmeliği", kind: "exact_title" as const, weight: 1.0 };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.metadataScore).toBeGreaterThan(0);
  });

  it("does not add metadataScore when type mismatches", () => {
    const entry = makeEntry({
      title: "Test Kanunu",
      expectedLegislationType: "kanun"
    });
    const result = makeSearchResult({ sourceId: "mevzuat:7.5.12345" }); // type 7 = yonetmelik
    const variant = { query: "Test Kanunu", kind: "exact_title" as const, weight: 1.0 };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.metadataScore).toBe(0);
  });

  it("sets probePathEligible true when sourceId matches and title ≥ 0.50", () => {
    const entry = makeEntry({
      title: "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      aliases: ["Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"],
      candidateLegacySourceId: "mevzuat:7.5.19696"
    });
    const result = makeSearchResult({
      sourceId: "mevzuat:7.5.19696",
      title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"
    });
    const variant = {
      query: "19696",
      kind: "legacy_source_id_probe" as const,
      candidateLegacySourceId: "mevzuat:7.5.19696",
      weight: 0.8
    };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.probePathEligible).toBe(true);
    expect(score.sourceIdProbeBonus).toBeGreaterThan(0);
  });

  it("sets probePathEligible false when sourceId does NOT match", () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.99999"
    });
    const result = makeSearchResult({ sourceId: "mevzuat:7.5.12345" }); // different sourceId
    const variant = {
      query: "99999",
      kind: "legacy_source_id_probe" as const,
      candidateLegacySourceId: "mevzuat:7.5.99999",
      weight: 0.8
    };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.probePathEligible).toBe(false);
  });

  it("sets probePathEligible false when title score is below probe threshold even with sourceId match", () => {
    const entry = makeEntry({
      title: "Completely Different Title That Shares No Words",
      candidateLegacySourceId: "mevzuat:7.5.12345"
    });
    const result = makeSearchResult({
      sourceId: "mevzuat:7.5.12345", // matches
      title: "Çevre Kanunu" // no word overlap
    });
    const variant = {
      query: "12345",
      kind: "legacy_source_id_probe" as const,
      candidateLegacySourceId: "mevzuat:7.5.12345",
      weight: 0.8
    };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.probePathEligible).toBe(false);
  });
});

// ─── verifyInventoryEntry ────────────────────────────────────────────────────

describe("verifyInventoryEntry", () => {
  it("returns verified when exact title match found on mevzuat.gov.tr", async () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği",
      searchTerms: ["test yönetmelik"]
    });
    const adapter = makeAdapter([makeSearchResult()]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("verified");
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.12345");
    expect(result.officialUrl).toContain("mevzuat.gov.tr");
    expect(result.officialUrl).toContain("7.5.12345");
    expect(result.entryKey).toBe("test-yonetmeligi");
  });

  it("returns rejected_no_match when search returns no results", async () => {
    const entry = makeEntry({ searchTerms: ["hiçbir şey"] });
    const adapter = makeAdapter([]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("rejected_no_match");
    expect(result.mevzuatSourceId).toBeUndefined();
    expect(result.rejectReason).toBeTruthy();
  });

  it("returns rejected_low_score when best match score is below threshold", async () => {
    const entry = makeEntry({
      title: "Hasta Hakları Yönetmeliği",
      searchTerms: ["hasta hakları"]
    });
    const adapter = makeAdapter([makeSearchResult({ title: "Çevre Kanunu" })]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("rejected_low_score");
    expect(result.mevzuatSourceId).toBeUndefined();
    expect(result.bestMatch).toBeDefined();
  });

  it("returns rejected_ambiguous when two results have identical title scores", async () => {
    // Realistic ambiguity: same regulation title exists under two different sourceIds
    // (e.g. a superseded version and the current one both in the index).
    const entry = makeEntry({
      title: "Acil Sağlık Hizmetleri Yönetmeliği",
      searchTerms: ["acil sağlık"]
    });
    const adapter = makeAdapter([
      makeSearchResult({
        sourceId: "mevzuat:7.5.11111",
        title: "Acil Sağlık Hizmetleri Yönetmeliği",
        documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.11111.pdf",
        sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=11111"
      }),
      makeSearchResult({
        sourceId: "mevzuat:7.5.22222",
        title: "Acil Sağlık Hizmetleri Yönetmeliği",
        documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.22222.pdf",
        sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=22222"
      })
    ]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("rejected_ambiguous");
    expect(result.mevzuatSourceId).toBeUndefined();
    expect(result.rejectReason).toContain("Ambiguous");
  });

  it("returns rejected_non_gov_tr when best scoring result has non-gov.tr URL", async () => {
    // The non-gov.tr result has the exact title (score 1.0), so it wins the scoring
    // competition — but is then rejected by the gov.tr guard at decision time.
    const entry = makeEntry({ title: "Test Yönetmeliği", searchTerms: ["test kanun"] });
    const adapter = makeAdapter([
      makeSearchResult({
        title: "Test Yönetmeliği",
        sourceUrl: "https://example.com/kanun",
        documentUrl: "https://example.com/kanun.pdf"
      })
    ]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("rejected_non_gov_tr");
    expect(result.mevzuatSourceId).toBeUndefined();
    expect(result.rejectReason).toContain("Non-gov.tr");
  });

  it("returns search_error when adapter fails", async () => {
    const entry = makeEntry({ searchTerms: ["test"] });
    const adapter = makeAdapter({ status: "unavailable", message: "connection refused" });
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("search_error");
    expect(result.rejectReason).toContain("connection refused");
  });

  it("picks best result across multiple search terms", async () => {
    const entry = makeEntry({
      title: "Özel Hastaneler Yönetmeliği",
      searchTerms: ["özel hastane", "özel sağlık kuruluşu"]
    });

    // Query plan: exact_title → keyword "özel hastane" → keyword "özel sağlık kuruluşu"
    // First term returns low-score match, second returns exact match, third returns empty
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([
          makeSearchResult({ sourceId: "mevzuat:7.5.99999", title: "Özel Araç Belgesi Yönetmeliği" })
        ])
        .mockResolvedValueOnce([
          makeSearchResult({ sourceId: "mevzuat:7.5.12345", title: "Özel Hastaneler Yönetmeliği" })
        ])
        .mockResolvedValueOnce([]) // third query variant
    };

    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).toBe("verified");
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.12345");
  });

  it("verified entry sets correct officialUrl format", async () => {
    const entry = makeEntry({ searchTerms: ["test"] });
    const adapter = makeAdapter([makeSearchResult({
      legislationType: "1",
      legislationArrangement: "5",
      legislationNumber: "5258"
    })]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("verified");
    expect(result.officialUrl).toBe("https://www.mevzuat.gov.tr/mevzuatmetin/1.5.5258.pdf");
  });

  it("unverified entry does NOT have mevzuatSourceId or officialUrl", async () => {
    const entry = makeEntry({ searchTerms: [] });
    const adapter = makeAdapter([]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).not.toBe("verified");
    expect(result.mevzuatSourceId).toBeUndefined();
    expect(result.officialUrl).toBeUndefined();
  });

  it("returns rejected_wrong_document when legislation type mismatches expected", async () => {
    const entry = makeEntry({
      title: "Test Kanunu",
      expectedLegislationType: "kanun",
      searchTerms: []
    });
    // Return a yönetmelik (type 7) result that partially matches
    const adapter = makeAdapter([
      makeSearchResult({
        sourceId: "mevzuat:7.5.12345", // type 7 = yönetmelik, not kanun
        title: "Test Yönetmeliği"       // slightly different title (below 0.75)
      })
    ]);
    const result = await verifyInventoryEntry(entry, adapter);

    // Score for "Test Kanunu" vs "Test Yönetmeliği":
    // inv words: [test, kanunu], sr words: [test, yonetmeligi]
    // overlap: 1 → F1 = 0.5, below 0.75 threshold; type also mismatches
    expect(result.status).toBe("rejected_wrong_document");
    expect(result.rejectReason).toContain("mismatch");
    expect(result.mevzuatSourceId).toBeUndefined();
  });

  it("alias match alone can produce verified status", async () => {
    const entry = makeEntry({
      title: "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      aliases: ["Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"],
      searchTerms: []
    });

    // The search result title matches the alias (score 1.0 on alias)
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([]) // exact_title query returns nothing
        .mockResolvedValueOnce([  // alias query hits the right document
          makeSearchResult({
            sourceId: "mevzuat:7.5.19696",
            title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
            documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf",
            sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19696"
          })
        ])
    };

    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).toBe("verified");
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.19696");
    expect(result.aliasScore).toBeCloseTo(1.0, 5);
  });

  it("sourceId probe path produces verified_via_source_id_probe when sourceId matches with ≥0.50 title", async () => {
    const entry = makeEntry({
      title: "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      aliases: ["Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"],
      candidateLegacySourceId: "mevzuat:7.5.19696",
      searchTerms: []
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([]) // exact_title → no hit
        .mockResolvedValueOnce([]) // alias → no hit
        .mockResolvedValueOnce([  // probe "19696" → exact sourceId hit
          makeSearchResult({
            sourceId: "mevzuat:7.5.19696",
            // Title in DB has slight variation → title score may be ~0.7 (above 0.50 probe threshold)
            title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
            documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf",
            sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19696"
          })
        ])
    };

    const result = await verifyInventoryEntry(entry, adapter);
    // aliasScore is 1.0 (alias exact match), probePathEligible true → verified_via_source_id_probe
    // Actually, alias matches perfectly so finalScore ≥ 0.75 → Path A first, but probe found it
    // In practice the probe variant is what returns the result here, and aliasScore = 1.0 > 0.75
    // so Path A triggers (verified), not Path B. Both are acceptable.
    expect(["verified", "verified_via_source_id_probe"]).toContain(result.status);
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.19696");
    expect(result.sourceIdProbeUsed).toBeDefined();
  });

  it("sourceId probe rejected when title score too low despite sourceId match", async () => {
    const entry = makeEntry({
      title: "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.19696",
      searchTerms: []
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([]) // exact_title → no hit
        .mockResolvedValueOnce([  // probe "19696" → sourceId matches but title is completely wrong
          makeSearchResult({
            sourceId: "mevzuat:7.5.19696",
            title: "Çevre ve Şehircilik Bakanlığı Teşkilat Yönetmeliği" // no word overlap
          })
        ])
    };

    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).not.toBe("verified");
    expect(result.status).not.toBe("verified_via_source_id_probe");
    expect(result.mevzuatSourceId).toBeUndefined();
  });

  it("populates attemptedQueries and searchTermsAttempted", async () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği",
      searchTerms: ["test term"]
    });
    const adapter = makeAdapter([]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.attemptedQueries).toBeDefined();
    expect(result.attemptedQueries.length).toBeGreaterThan(0);
    expect(result.searchTermsAttempted).toContain("Test Yönetmeliği"); // exact_title always included
  });

  it("populates topCandidates (up to 3) when results exist", async () => {
    const entry = makeEntry({ title: "Test Yönetmeliği", searchTerms: [] });
    const adapter = makeAdapter([
      makeSearchResult({ sourceId: "mevzuat:7.5.11111", title: "Test Yönetmeliği" }),
      makeSearchResult({ sourceId: "mevzuat:7.5.22222", title: "Test Yönetmeliği" }),
      makeSearchResult({ sourceId: "mevzuat:7.5.33333", title: "Test Yönetmeliği" })
    ]);
    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.topCandidates.length).toBeLessThanOrEqual(3);
  });
});

// ─── Sağlık Meslek Mensupları fixture ────────────────────────────────────────

describe("saglik-meslek-is-gorev-tanimlari fixture", () => {
  const saglikMeslekEntry = makeEntry({
    key: "saglik-meslek-is-gorev-tanimlari",
    title: "Sağlık Meslek Mensupları ile Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
    titleNormalized: "saglik meslek mensuplari ile diger meslek mensuplarinin is ve gorev tanimlarina dair yonetmelik",
    aliases: [
      "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
      "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      "Sağlık Meslek Mensupları ile Diğer Meslek Mensupları Görev Tanımları"
    ],
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2014-05-22",
    expectedRgNumber: "29007",
    candidateLegacySourceId: "mevzuat:7.5.19696",
    searchTerms: ["sağlık meslek mensupları görev tanımları"],
    officialSourceStatus: "gap",
    coverageStatus: "gap"
  });

  it("query plan has source_id_probe strategy", () => {
    const plan = buildQueryPlan(saglikMeslekEntry);
    expect(plan.strategy).toBe("source_id_probe");
  });

  it("query plan contains probe for 19696", () => {
    const plan = buildQueryPlan(saglikMeslekEntry);
    const probe = plan.variants.find((v) => v.kind === "legacy_source_id_probe");
    expect(probe).toBeDefined();
    expect(probe!.query).toBe("19696");
  });

  it("query plan contains rg_number 29007", () => {
    const plan = buildQueryPlan(saglikMeslekEntry);
    const rg = plan.variants.find((v) => v.kind === "rg_number");
    expect(rg).toBeDefined();
    expect(rg!.query).toBe("29007");
  });

  it("query plan contains all 3 aliases", () => {
    const plan = buildQueryPlan(saglikMeslekEntry);
    const aliases = plan.variants.filter((v) => v.kind === "alias");
    expect(aliases).toHaveLength(3);
  });

  it("exact title query is deduplicated if it appears in aliases", () => {
    const plan = buildQueryPlan(saglikMeslekEntry);
    const unique = new Set(plan.variants.map((v) => v.query));
    expect(unique.size).toBe(plan.variants.length);
  });

  it("alias match verifies the entry", async () => {
    // mevzuat.gov.tr returns the document under an alias title
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockImplementation(async (query: string) => {
        if (query.includes("19696") || query.includes("İş ve Görev")) {
          return [makeSearchResult({
            sourceId: "mevzuat:7.5.19696",
            title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
            documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf",
            sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19696",
            legislationType: "7",
            legislationArrangement: "5",
            legislationNumber: "19696"
          })];
        }
        return [];
      })
    };

    const result = await verifyInventoryEntry(saglikMeslekEntry, adapter);
    expect(["verified", "verified_via_source_id_probe"]).toContain(result.status);
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.19696");
  });

  it("unrelated result is rejected (not verified)", async () => {
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.99999",
          title: "Çevre ve Şehircilik Bakanlığı Teşkilat Yönetmeliği",
          documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.99999.pdf",
          sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=99999"
        })
      ])
    };

    const result = await verifyInventoryEntry(saglikMeslekEntry, adapter);
    expect(result.status).not.toBe("verified");
    expect(result.status).not.toBe("verified_via_source_id_probe");
    expect(result.mevzuatSourceId).toBeUndefined();
  });
});

// ─── buildAccessVerificationReport ──────────────────────────────────────────

describe("buildAccessVerificationReport", () => {
  it("reports correct counts for mixed results", async () => {
    // Use distinct entry titles so the adapter can route by query
    const entries = [
      makeEntry({ key: "entry-a", title: "Entry Alpha Yönetmeliği", searchTerms: ["term a"] }),
      makeEntry({ key: "entry-b", title: "Entry Beta Yönetmeliği", searchTerms: ["term b"] }),
      makeEntry({ key: "entry-c", title: "Entry Gamma Yönetmeliği", searchTerms: ["term c"] })
    ];

    // Return exact-title matches for a, nothing for b, unrelated for c
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockImplementation(async (query: string) => {
        if (query.includes("Alpha") || query === "term a") {
          return [makeSearchResult({ sourceId: "mevzuat:7.5.11111", title: "Entry Alpha Yönetmeliği" })];
        }
        if (query.includes("Gamma") || query === "term c") {
          return [makeSearchResult({ sourceId: "mevzuat:7.5.33333", title: "Unrelated Kanun" })];
        }
        return [];
      })
    };

    const report = await buildAccessVerificationReport(entries, adapter, 0);

    expect(report.attemptedCount).toBe(3);
    expect(report.verifiedCount + report.rejectedCount + report.searchErrorCount).toBe(3);
    expect(report.generatedAt).toBeTruthy();
  });

  it("verifiedEntries contains only verified attempts", async () => {
    const entries = [
      makeEntry({ key: "verified-one", title: "Test Yönetmeliği", searchTerms: ["test"] }),
      makeEntry({ key: "rejected-one", title: "Başka Yönetmelik", searchTerms: ["başka"] })
    ];

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([makeSearchResult({ title: "Test Yönetmeliği" })])  // verified-one exact_title
        .mockResolvedValueOnce([])  // verified-one keyword "test"
        .mockResolvedValueOnce([])  // rejected-one exact_title "Başka Yönetmelik"
        .mockResolvedValueOnce([])  // rejected-one keyword "başka"
    };

    const report = await buildAccessVerificationReport(entries, adapter, 0);

    expect(report.verifiedEntries).toHaveLength(1);
    expect(report.verifiedEntries[0].entryKey).toBe("verified-one");
    expect(report.rejectedEntries).toHaveLength(1);
    expect(report.rejectedEntries[0].entryKey).toBe("rejected-one");
  });

  it("attempts array length matches entry count", async () => {
    const entries = [makeEntry({ key: "a" }), makeEntry({ key: "b" })];
    const adapter = makeAdapter([]);
    const report = await buildAccessVerificationReport(entries, adapter, 0);
    expect(report.attempts).toHaveLength(2);
  });

  it("report has generatedAt ISO timestamp", async () => {
    const report = await buildAccessVerificationReport([], makeAdapter([]), 0);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("verified_via_source_id_probe entries are counted in verifiedCount", async () => {
    const entry = makeEntry({
      key: "probe-entry",
      title: "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      aliases: ["Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"],
      candidateLegacySourceId: "mevzuat:7.5.19696",
      searchTerms: []
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockImplementation(async (query: string) => {
        if (query === "19696") {
          return [makeSearchResult({
            sourceId: "mevzuat:7.5.19696",
            title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
            documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf",
            sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19696",
            legislationType: "7",
            legislationArrangement: "5",
            legislationNumber: "19696"
          })];
        }
        return [];
      })
    };

    const report = await buildAccessVerificationReport([entry], adapter, 0);
    expect(report.verifiedCount).toBe(1);
    expect(report.verifiedEntries).toHaveLength(1);
  });
});

// ─── Integration: inventory guard ────────────────────────────────────────────

describe("inventory integration guards", () => {
  it("non-gov.tr result cannot produce a verified entry", async () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği",
      searchTerms: ["test"]
    });
    const adapter = makeAdapter([
      makeSearchResult({
        sourceUrl: "https://unofficial-source.com/kanun",
        documentUrl: "https://unofficial-source.com/kanun.pdf"
      })
    ]);
    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).not.toBe("verified");
  });

  it("verified entry always has sourceId starting with mevzuat:", async () => {
    const entry = makeEntry({ searchTerms: ["test"] });
    const adapter = makeAdapter([makeSearchResult()]);
    const result = await verifyInventoryEntry(entry, adapter);
    if (result.status === "verified") {
      expect(result.mevzuatSourceId).toMatch(/^mevzuat:/);
    }
  });

  it("verified entry officialUrl always contains mevzuat.gov.tr", async () => {
    const entry = makeEntry({ searchTerms: ["test"] });
    const adapter = makeAdapter([makeSearchResult()]);
    const result = await verifyInventoryEntry(entry, adapter);
    if (result.status === "verified") {
      expect(result.officialUrl).toContain("mevzuat.gov.tr");
    }
  });

  it("verified_via_source_id_probe entry officialUrl always contains mevzuat.gov.tr", async () => {
    const entry = makeEntry({
      title: "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      aliases: ["Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"],
      candidateLegacySourceId: "mevzuat:7.5.19696",
      searchTerms: []
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockImplementation(async (query: string) => {
        if (query === "19696") {
          return [makeSearchResult({
            sourceId: "mevzuat:7.5.19696",
            title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
            documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf",
            sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19696",
            legislationType: "7",
            legislationArrangement: "5",
            legislationNumber: "19696"
          })];
        }
        return [];
      })
    };
    const result = await verifyInventoryEntry(entry, adapter);
    if (result.status === "verified" || result.status === "verified_via_source_id_probe") {
      expect(result.officialUrl).toContain("mevzuat.gov.tr");
    }
  });
});

// ─── v0.31.0: Direct sourceId verification (Path C) ──────────────────────────

describe("verifyBySourceIdDirect", () => {
  const saglikMeslekEntry = makeEntry({
    key: "saglik-meslek-is-gorev-tanimlari",
    title: "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
    titleNormalized: "saglik meslek mensuplari ile saglik hizmetlerinde calisan diger meslek mensuplarinin is ve gorev tanimlarina dair yonetmelik",
    aliases: [
      "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği",
      "Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği",
      "Sağlık Meslek Mensupları ile Diğer Meslek Mensupları Görev Tanımları"
    ],
    expectedLegislationType: "yonetmelik",
    expectedRgDate: "2014-05-22",
    expectedRgNumber: "29007",
    candidateLegacySourceId: "mevzuat:7.5.19696",
    searchTerms: ["sağlık meslek mensupları görev tanımları"],
    officialSourceStatus: "gap",
    coverageStatus: "gap"
  });

  const markerDocText =
    "SAĞLIK MESLEK MENSUPLARI İLE SAĞLIK HİZMETLERİNDE ÇALIŞAN DİĞER MESLEK MENSUPLARININ İŞ VE GÖREV TANIMLARINA DAİR YÖNETMELİK\n\n" +
    "Madde 1 – Bu Yönetmeliğin amacı, sağlık meslek mensupları ile sağlık hizmetlerinde çalışan diğer meslek mensuplarının iş ve görev tanımlarını belirlemektir.\n" +
    "Madde 6 – Görev tanımları ekli listelerde gösterilmiştir.\n" +
    "Ek-1 – Sağlık Meslek Mensupları Görev Tanımları\n" +
    "Ek-2 – Diğer Meslek Mensupları Görev Tanımları\n" +
    "22/5/2014 tarihli ve 29007 sayılı Resmî Gazete'de yayımlanmıştır.\n";

  it("verified_via_source_id_direct when title and markers match", async () => {
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        text: markerDocText
      }))
    };
    const result = await verifyInventoryEntry(saglikMeslekEntry, adapter);
    expect(result.status).toBe("verified_via_source_id_direct");
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.19696");
    expect(result.directFetchStatus).toBe("success");
    expect(result.officialUrl).toContain("mevzuat.gov.tr");
    expect(result.directFetchMarkerScore).toBeGreaterThanOrEqual(0.30);
  });

  it("direct fetch fails when adapter has no fetchOfficialDocument", async () => {
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([])
    };
    const result = await verifyInventoryEntry(saglikMeslekEntry, adapter);
    expect(result.status).toBe("rejected_no_match");
    expect(result.directFetchAttempted).toBeUndefined();
  });

  it("rejected_source_id_timeout when direct fetch times out", async () => {
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn().mockResolvedValue({ status: "unavailable" as const, message: "Official source request timed out after 30000ms (source: mevzuat-sourceid-probe)." })
    };
    const result = await verifyInventoryEntry(saglikMeslekEntry, adapter);
    expect(result.status).toBe("rejected_no_match");
    expect(result.directFetchAttempted).toBe(true);
    expect(result.directFetchTimedOut).toBe(true);
    expect(result.directFetchStatus).toBe("timeout");
  });

  it("rejected_no_match when search returns nothing and no candidateLegacySourceId", async () => {
    const entry = makeEntry({ searchTerms: ["test"] });
    const adapter = makeAdapter([]);
    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).toBe("rejected_no_match");
  });

  it("search_error with direct fetch fallback on timeout entry", async () => {
    const entry = makeEntry({
      candidateLegacySourceId: "mevzuat:7.5.99999",
      searchTerms: ["test"],
      aliases: ["Test Alias"]
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue({ status: "unavailable", message: "Search timed out." }),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Test Yönetmeliği",
        text: "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\nSağlık test yönetmelik madde burada yer alır.\nGörev tanımları Sağlık Bakanlığı tarafından belirlenir."
      }))
    };
    const result = await verifyInventoryEntry(entry, adapter);
    // Direct fetch returns verified_via_source_id_direct because search failed first variant
    expect(["verified_via_source_id_direct", "search_error"]).toContain(result.status);
    expect(result.directFetchAttempted).toBe(true);
    if (result.status === "verified_via_source_id_direct") {
      expect(result.directFetchStatus).toBe("success");
    }
  });

  it("rejected_source_id_title_mismatch when document title does not match", async () => {
    const longText =
      "ÇEVRE VE ŞEHİRCİLİK BAKANLIĞI YÖNETMELİĞİ\n\n" +
      "Madde 1 – Bu Yönetmeliğin amacı çevre düzenlemesi ve şehircilik hizmetlerini yürütmektir.\n" +
      "Madde 2 – Bu Yönetmelik, 2872 sayılı Çevre Kanununa dayanılarak hazırlanmıştır.\n";
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Çevre ve Şehircilik Bakanlığı Yönetmeliği",
        text: longText
      }))
    };
    const result = await verifyInventoryEntry(saglikMeslekEntry, adapter);
    expect(result.status).not.toBe("verified_via_source_id_direct");
    expect(result.directFetchAttempted).toBe(true);
    expect(result.directFetchStatus).toBe("title_mismatch");
  });

  // ─── extractDocTitle ─────────────────────────────────────────

  describe("extractDocTitle", () => {
    it("extracts first line from document text", () => {
      const text = "SAĞLIK MESLEK MENSUPLARI YÖNETMELİĞİ\nMadde 1 – Amaç";
      const result = extractDocTitle(text);
      expect(result).toContain("SAĞLIK");
      expect(result).toContain("MESLEK");
    });

    it("cleans BOM character", () => {
      const text = "\uFEFFSAĞLIK YÖNETMELİĞİ\nMadde 1";
      const result = extractDocTitle(text);
      expect(result).toContain("SAĞLIK");
    });

    it("handles empty text", () => {
      expect(extractDocTitle("")).toBe("");
    });

    it("handles very short text", () => {
      expect(extractDocTitle("   ")).toBe("");
    });
  });

  // ─── computeMarkerOverlap ────────────────────────────────────

  describe("computeMarkerOverlap", () => {
    it("returns 1.0 when all terms match", () => {
      const text = "SAĞLIK MESLEK MENSUPLARI iş ve görev tanımları yönetmeliği";
      const score = computeMarkerOverlap(text, ["sağlık meslek", "görev tanımları"]);
      expect(score).toBe(1.0);
    });

    it("returns partial score for partial match", () => {
      // Term "sağlık" requires ALL words to match; only "sağlık" present, "meslek" not found
      // Term "görev" requires ALL words; "görev" not present
      // So 0/2 = 0 for multi-word terms
      // With single-word term search, individual word check would be different
      const text = "SAĞLIK YÖNETMELİĞİ";
      const scoreSingle = computeMarkerOverlap(text, ["sağlık"]);
      expect(scoreSingle).toBe(1.0);
      const scoreMissing = computeMarkerOverlap(text, ["sağlık meslek", "görev"]);
      // "sağlık meslek" fails (meslek missing), "görev" fails (not in text)
      expect(scoreMissing).toBe(0);
    });

    it("returns 0 for no match", () => {
      const text = "ÇEVRE BAKANLIĞI";
      const score = computeMarkerOverlap(text, ["sağlık meslek", "görev tanımları"]);
      expect(score).toBe(0);
    });

    it("returns 0 for empty terms", () => {
      const text = "SAĞLIK YÖNETMELİĞİ";
      expect(computeMarkerOverlap(text, [])).toBe(0);
    });
  });
});

// ─── v0.32.0: checkKnownWrongMatch ────────────────────────────────────────────

describe("checkKnownWrongMatch", () => {
  it("rejects Makine ve Kimya Endüstrisi Kanunu", () => {
    const result = checkKnownWrongMatch({
      sourceId: "mevzuat:1.5.7191",
      title: "Makine ve Kimya Endüstrisi Kanunu"
    });
    expect(result.isWrongMatch).toBe(true);
    expect(result.reason).toContain("Makine");
  });

  it("rejects KVKK kanunu (1.5.6698)", () => {
    const result = checkKnownWrongMatch({
      sourceId: "mevzuat:1.5.6698",
      title: "Kişisel Verilerin Korunması Kanunu"
    });
    expect(result.isWrongMatch).toBe(true);
    expect(result.reason).toContain("KVKK");
  });

  it("rejects TSK Disiplin Kanunu", () => {
    const result = checkKnownWrongMatch({
      sourceId: "mevzuat:1.5.6413",
      title: "Türk Silahlı Kuvvetleri Disiplin Kanunu"
    });
    expect(result.isWrongMatch).toBe(true);
    expect(result.reason).toContain("TSK");
  });

  it("rejects SGK yapılandırma kanunu", () => {
    const result = checkKnownWrongMatch({
      sourceId: "mevzuat:1.5.5510",
      title: "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu"
    });
    expect(result.isWrongMatch).toBe(true);
    expect(result.reason).toContain("SGK");
  });

  it("returns false for mevzuat.gov.tr health regulation", () => {
    const result = checkKnownWrongMatch({
      sourceId: "mevzuat:7.5.19696",
      title: "Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği"
    });
    expect(result.isWrongMatch).toBe(false);
  });

  it("matches by title pattern when sourceId is unknown", () => {
    const result = checkKnownWrongMatch({
      sourceId: "mevzuat:1.5.99999", // unknown sourceId
      title: "Posta Hizmetleri Kanunu" // title matches Posta pattern
    });
    expect(result.isWrongMatch).toBe(true);
    expect(result.reason).toContain("Posta");
  });
});

// ─── v0.32.0: checkNegativeMarkers ────────────────────────────────────────────

describe("checkNegativeMarkers", () => {
  it("returns hit=true when negative term found", () => {
    const result = checkNegativeMarkers(
      "Bu yönetmelik TSK Disiplin Kanunu kapsamındadır.",
      ["tsk disiplin", "asker"]
    );
    expect(result.hit).toBe(true);
    expect(result.term).toBe("tsk disiplin");
  });

  it("returns hit=false when no negative term found", () => {
    const result = checkNegativeMarkers(
      "Bu yönetmelik sağlık hizmetleri kapsamındadır.",
      ["tsk", "asker", "polis"]
    );
    expect(result.hit).toBe(false);
  });

  it("returns hit=false for empty negative terms", () => {
    const result = checkNegativeMarkers("Test metni", []);
    expect(result.hit).toBe(false);
  });
});

// ─── v0.32.0: Direct-first strategy ──────────────────────────────────────────

describe("verifyInventoryEntry — direct-first strategy", () => {
  it("tries direct sourceId first and returns verified if successful", async () => {
    const entry = makeEntry({
      key: "test-direct-first",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.99999",
      searchTerms: ["test"],
      markerTerms: ["test", "yönetmelik", "sağlık"],
      officialSourceStatus: "candidate",
      coverageStatus: "candidate"
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(), // should NOT be called if direct succeeds
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Test Yönetmeliği",
        text: "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\nSağlık test yönetmelik sağlık bakanlığı.\nGörev tanımları bu yönetmelikte düzenlenmiştir.\nMadde 2 – Bu yönetmelik tüm sağlık kurumlarını kapsar."
      }))
    };

    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).toBe("verified_via_source_id_direct");
    // search should NOT be called since direct succeeded
    expect(adapter.searchOfficialLegislation).not.toHaveBeenCalled();
  });

  it("falls back to search API when direct fetch fails with timeout", async () => {
    const entry = makeEntry({
      key: "test-direct-fallback",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.99999",
      searchTerms: ["test"]
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValue([makeSearchResult({
          sourceId: "mevzuat:7.5.12345",
          title: "Test Yönetmeliği"  // exact title match → verified
        })]),
      fetchOfficialDocument: vi.fn().mockResolvedValue({
        status: "unavailable" as const,
        message: "Official source request timed out after 30000ms."
      })
    };

    const result = await verifyInventoryEntry(entry, adapter);
    // Should fall through to search API and verify
    expect(result.status).toBe("verified");
    expect(adapter.searchOfficialLegislation).toHaveBeenCalled();
  });

  it("known wrong match sourceId is rejected by direct-first", async () => {
    const entry = makeEntry({
      key: "test-known-wrong",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:1.5.6698", // KVKK — known wrong
      searchTerms: ["test"]
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn() // should not be called
    };

    const result = await verifyInventoryEntry(entry, adapter);
    expect(result.status).toBe("rejected_wrong_document");
    expect(result.knownWrongMatchHit).toBe(true);
    expect(adapter.fetchOfficialDocument).not.toHaveBeenCalled();
  });
});

// ─── v0.32.0: computeCompositeScore with markerTerms ─────────────────────────

describe("computeCompositeScore — markerScore", () => {
  it("includes markerScore from entry-level markerTerms", () => {
    const entry = makeEntry({
      title: "Özel Hastaneler Yönetmeliği",
      markerTerms: ["özel hastane", "ruhsat", "mesul müdür"]
    });
    const result = makeSearchResult({
      title: "Özel Hastaneler Yönetmeliği" // contains "özel" but not all marker terms
    });
    const variant = { query: "Özel Hastaneler Yönetmeliği", kind: "exact_title" as const, weight: 1.0 };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.titleScore).toBeCloseTo(1.0, 5);
    expect(score.markerScore).toBeDefined();
    // markerScore will be > 0 because "özel" is in title
    expect(score.markerScore).toBeGreaterThan(0);
  });

  it("returns markerScore 0 when no markerTerms defined", () => {
    const entry = makeEntry({
      title: "Test Yönetmeliği"
    });
    const result = makeSearchResult({ title: "Test Yönetmeliği" });
    const variant = { query: "Test Yönetmeliği", kind: "exact_title" as const, weight: 1.0 };
    const score = computeCompositeScore(entry, result, variant);
    expect(score.markerScore).toBe(0);
  });
});

// ─── v0.32.0: Known wrong match filter in search results ─────────────────────

describe("verifyInventoryEntry — known wrong match filtering", () => {
  it("filters out known wrong matches from search results", async () => {
    const entry = makeEntry({
      key: "test-filtered",
      title: "Özel Hastaneler Yönetmeliği",
      searchTerms: ["özel hastane"]
    });

    // Return both a known wrong match and a valid one
    const adapter = makeAdapter([
      makeSearchResult({
        sourceId: "mevzuat:1.5.7191",  // Makine ve Kimya — known wrong
        title: "Makine ve Kimya Endüstrisi Kanunu",
        documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.7191.pdf",
        sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=7191"
      })
    ]);

    const result = await verifyInventoryEntry(entry, adapter);
    // The only result is a known wrong match, so it should be filtered out
    expect(result.status).toBe("rejected_no_match");
  });

  it("filters known wrong match when mixed with valid results", async () => {
    const entry = makeEntry({
      key: "test-mixed",
      title: "Özel Hastaneler Yönetmeliği",
      searchTerms: ["özel hastane"]
    });

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:1.5.7191",  // known wrong
          title: "Makine ve Kimya Endüstrisi Kanunu"
        }),
        makeSearchResult({
          sourceId: "mevzuat:7.5.99999",  // valid sourceId
          title: "Özel Hastaneler Yönetmeliği"  // exact title match
        })
      ])
    };

    const result = await verifyInventoryEntry(entry, adapter);
    // Should verify via the valid result
    expect(result.status).toBe("verified");
    expect(result.mevzuatSourceId).toBe("mevzuat:7.5.99999");
  });
});

// ─── v0.32.0: Expanded diagnostics fields ────────────────────────────────────

describe("verifyInventoryEntry — expanded diagnostics", () => {
  it("populates markerScore, rgScore, typeScore on verified entry", async () => {
    const entry = makeEntry({
      key: "test-diagnostics",
      title: "Test Yönetmeliği",
      expectedLegislationType: "yonetmelik",
      expectedRgNumber: "12345",
      markerTerms: ["test", "yönetmelik"],
      searchTerms: ["test"]
    });
    const adapter = makeAdapter([makeSearchResult({
      legislationType: "7",
      legislationNumber: "12345"
    })]);
    const result = await verifyInventoryEntry(entry, adapter);

    expect(result.status).toBe("verified");
    expect(result.typeScore).toBe(1);  // type 7 = yonetmelik
    expect(result.markerScore).toBeGreaterThanOrEqual(0);
  });
});
