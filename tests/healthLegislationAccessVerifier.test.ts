import { describe, it, expect, vi } from "vitest";
import {
  normalizeTitleForMatch,
  titleWords,
  scoreTitleMatch,
  isGovTrUrl,
  verifyInventoryEntry,
  buildAccessVerificationReport,
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

    // First term returns low-score match, second returns exact match
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([
          makeSearchResult({ sourceId: "mevzuat:7.5.99999", title: "Özel Araç Belgesi Yönetmeliği" })
        ])
        .mockResolvedValueOnce([
          makeSearchResult({ sourceId: "mevzuat:7.5.12345", title: "Özel Hastaneler Yönetmeliği" })
        ])
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
});

// ─── buildAccessVerificationReport ──────────────────────────────────────────

describe("buildAccessVerificationReport", () => {
  it("reports correct counts for mixed results", async () => {
    const entries = [
      makeEntry({ key: "entry-a", searchTerms: ["term a"] }),
      makeEntry({ key: "entry-b", searchTerms: ["term b"] }),
      makeEntry({ key: "entry-c", searchTerms: ["term c"] })
    ];

    const adapters: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn()
        .mockResolvedValueOnce([makeSearchResult({ sourceId: "mevzuat:7.5.11111", title: "Entry A Yönetmeliği" })])
        .mockResolvedValueOnce([]) // no match
        .mockResolvedValueOnce([makeSearchResult({ sourceId: "mevzuat:7.5.33333", title: "Unrelated Kanun" })])
    };

    const report = await buildAccessVerificationReport(entries, adapters, 0);

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
        .mockResolvedValueOnce([makeSearchResult({ title: "Test Yönetmeliği" })])
        .mockResolvedValueOnce([])
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
});
