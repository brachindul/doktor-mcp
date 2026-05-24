import { describe, it, expect, vi } from "vitest";
import {
  resolveRgEntry,
  buildRgResolutionReport,
  filterRgOnlyLeads,
  RgLeadResolutionCandidate,
  HealthLegislationRgResolutionResult
} from "../src/healthLegislationRgResolver.js";
import type { LegislationSearchAdapter } from "../src/healthLegislationAccessVerifier.js";
import type { HealthLegislationInventoryEntry } from "../src/healthLegislationInventory.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HealthLegislationInventoryEntry> = {}): HealthLegislationInventoryEntry {
  return {
    key: "test-entry",
    title: "Test Yönetmeliği",
    titleNormalized: "test yonetmeligi",
    category: "patient_rights",
    relevanceLevel: "core",
    officialSourceRequired: true,
    officialSourceStatus: "candidate",
    relatedIssueIds: [],
    relatedTopicClusters: [],
    searchTerms: ["test"],
    coverageStatus: "candidate",
    notes: [],
    ...overrides
  };
}

function makeSearchResult(overrides: Record<string, unknown> = {}) {
  return {
    sourceId: "mevzuat:7.5.12345",
    title: "Test Yönetmeliği",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12345",
    documentUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.12345.pdf",
    legislationNumber: "12345",
    legislationType: "7",
    legislationArrangement: "5",
    ...overrides
  };
}

function makeDocResult(overrides: { title?: string; text?: string } = {}) {
  return {
    title: overrides.title ?? "Test Yönetmeliği",
    text: overrides.text ?? "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\n\nSağlık test yönetmelik sağlık bakanlığı.\nMadde 2 – Test yönetmelik kapsamındaki kurumlar.",
    retrievedAt: "2026-05-24T00:00:00.000Z"
  };
}

// ─── filterRgOnlyLeads ─────────────────────────────────────────────────────────

describe("filterRgOnlyLeads", () => {
  it("returns entries with expectedRgNumber but no mevzuatSourceId", () => {
    const entries = [
      makeEntry({ key: "rg-only", expectedRgNumber: "30867" }),
      makeEntry({ key: "verified", expectedRgNumber: "29007", mevzuatSourceId: "mevzuat:7.5.19696", officialSourceStatus: "verified" }),
      makeEntry({ key: "no-rg" }),
      makeEntry({ key: "deferred", expectedRgNumber: "12345", officialSourceStatus: "deferred", coverageStatus: "deferred" })
    ];
    const result = filterRgOnlyLeads(entries);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe("rg-only");
  });

  it("returns empty for entries with no RG number", () => {
    const entries = [
      makeEntry({ key: "no-rg-1" }),
      makeEntry({ key: "no-rg-2" })
    ];
    const result = filterRgOnlyLeads(entries);
    expect(result.length).toBe(0);
  });

  it("excludes verified entries", () => {
    const entries = [
      makeEntry({ key: "v", expectedRgNumber: "30867", mevzuatSourceId: "mevzuat:7.5.111", officialSourceStatus: "verified" })
    ];
    const result = filterRgOnlyLeads(entries);
    expect(result.length).toBe(0);
  });

  it("excludes deferred entries", () => {
    const entries = [
      makeEntry({ key: "d", expectedRgNumber: "30867", officialSourceStatus: "deferred" })
    ];
    const result = filterRgOnlyLeads(entries);
    expect(result.length).toBe(0);
  });
});

// ─── resolveRgEntry ────────────────────────────────────────────────────────────

describe("resolveRgEntry", () => {
  it("returns not_attempted when entry has no expectedRgNumber", async () => {
    const entry = makeEntry({ key: "no-rg" });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("not_attempted");
    expect(result.queryVariantsAttempted).toEqual([]);
  });

  it("returns no_candidate_found when search returns empty", async () => {
    const entry = makeEntry({ key: "rg-test", expectedRgNumber: "99999" });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn()
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("no_candidate_found");
    expect(result.queryVariantsAttempted.length).toBeGreaterThan(0);
  });

  it("ignores non-gov.tr search results", async () => {
    const entry = makeEntry({ key: "non-gov", expectedRgNumber: "99999" });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "unknown:1",
          sourceUrl: "https://example.com/kanun",
          documentUrl: "https://example.com/kanun.pdf"
        })
      ]),
      fetchOfficialDocument: vi.fn()
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("no_candidate_found");
    expect(result.candidatesFound.length).toBe(0);
  });

  it("finds candidate when RG+title search matches", async () => {
    const entry = makeEntry({
      key: "kisisel-saglik-verileri",
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      expectedRgNumber: "30867"
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockImplementation((query: string) => {
        if (query.includes("30867")) {
          return Promise.resolve([
            makeSearchResult({
              sourceId: "mevzuat:7.5.30867",
              title: "Kişisel Sağlık Verileri Hakkında Yönetmelik"
            })
          ]);
        }
        return Promise.resolve([]);
      })
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.candidatesFound.length).toBeGreaterThan(0);
    expect(result.candidatesFound[0].sourceId).toBe("mevzuat:7.5.30867");
    expect(result.candidatesFound[0].matchScore).toBeGreaterThan(0);
  });

  it("returns candidate_found when verifier is not available", async () => {
    const entry = makeEntry({
      key: "candidate-only",
      title: "Test",
      expectedRgNumber: "12345"
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({ sourceId: "mevzuat:7.5.12345", title: "Test" })
      ])
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("candidate_found");
    expect(result.bestCandidate).toBeDefined();
  });

  it("returns verified when verifier confirms", async () => {
    const entry = makeEntry({
      key: "verified-entry",
      title: "Test Yönetmeliği",
      expectedRgNumber: "30867",
      markerTerms: ["test", "yönetmelik", "sağlık"],
      searchTerms: ["test"]
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.30867",
          title: "Test Yönetmeliği"
        })
      ]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Test Yönetmeliği",
        text: "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\nSağlık test yönetmelik sağlık bakanlığı.\nMadde 2 – Test yönetmelik kapsamı."
      }))
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("verified");
    expect(result.bestCandidate).toBeDefined();
    expect(result.titleScore).toBeGreaterThanOrEqual(0.50);
    expect(result.markerScore).toBeGreaterThanOrEqual(0.30);
  });

  it("returns rejected when verifier rejects", async () => {
    // Title has partial overlap so candidate is found, but document content
    // does not match expected health regulation criteria
    const entry = makeEntry({
      key: "rejected-entry",
      title: "Çevre ve Şehircilik Hizmetleri Yönetmeliği",
      expectedRgNumber: "99999",
      markerTerms: ["nonexistent", "wrong"],
      searchTerms: ["wrong"]
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.99999",
          title: "Çevre ve Şehircilik Yönetmeliği"
        })
      ]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Çevre ve Şehircilik Yönetmeliği",
        text: "ÇEVRE VE ŞEHİRCİLİK YÖNETMELİĞİ\n\nMadde 1 – Çevre düzenlemesi amacı.\nÇevre ve şehircilik hizmetleri."
      }))
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("rejected");
    expect(result.rejectReason).toBeTruthy();
  });

  it("generates query variants from RG number and title", async () => {
    const entry = makeEntry({
      key: "query-variants",
      title: "Acil Sağlık Hizmetleri Yönetmeliği",
      expectedRgNumber: "29332",
      aliases: ["Acil Sağlık Hizmetleri Hakkında Yönetmelik"]
    });
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn()
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.queryVariantsAttempted.length).toBeGreaterThanOrEqual(4);
    expect(result.queryVariantsAttempted[0]).toBe("29332");
    expect(result.queryVariantsAttempted.some((q) => q.includes("29332"))).toBe(true);
    expect(result.queryVariantsAttempted.some((q) => q.includes("Acil"))).toBe(true);
  });
});

// ─── buildRgResolutionReport ───────────────────────────────────────────────────

describe("buildRgResolutionReport", () => {
  it("returns correct summary when no RG-only entries", async () => {
    const entries = [
      makeEntry({ key: "verified", mevzuatSourceId: "mevzuat:7.5.111", officialSourceStatus: "verified" })
    ];
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };
    const report = await buildRgResolutionReport(entries, adapter);
    expect(report.entriesScanned).toBe(1);
    expect(report.rgLeadsProcessed).toBe(0);
    expect(report.verifiedCount).toBe(0);
  });

  it("processes RG-only entries", async () => {
    const entries = [
      makeEntry({ key: "rg-1", expectedRgNumber: "11111", searchTerms: ["test"] }),
      makeEntry({ key: "rg-2", expectedRgNumber: "22222", searchTerms: ["test"] }),
      makeEntry({ key: "no-rg", searchTerms: ["test"] })
    ];
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn()
    };
    const report = await buildRgResolutionReport(entries, adapter);
    expect(report.entriesScanned).toBe(3);
    expect(report.rgLeadsProcessed).toBe(2);
    expect(report.entries.length).toBe(2);
  });

  it("report JSON is parseable", async () => {
    const entries = [
      makeEntry({ key: "json-test", expectedRgNumber: "33333", searchTerms: ["test"] })
    ];
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn()
    };
    const report = await buildRgResolutionReport(entries, adapter);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as HealthLegislationRgResolutionResult;
    expect(parsed.rgLeadsProcessed).toBe(1);
    expect(parsed.generatedAt).toBeTruthy();
  });

  it("has required top-level fields", async () => {
    const report = await buildRgResolutionReport([], {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    });
    const requiredFields = [
      "entriesScanned", "rgLeadsProcessed", "sourceIdCandidatesFound",
      "officialPdfCandidatesFound", "candidatesSentToVerifier",
      "verifiedCount", "rejectedCount", "needsManualReviewCount",
      "nonGovIgnoredCount", "entries", "generatedAt"
    ];
    for (const field of requiredFields) {
      expect(report).toHaveProperty(field);
    }
  });

  it("has generatedAt ISO timestamp", async () => {
    const report = await buildRgResolutionReport([], {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    });
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ─── Real inventory fixtures ───────────────────────────────────────────────────

describe("real inventory RG-only entries — resolver contract", () => {
  const rgOnlyKeys = [
    "kisisel-saglik-verileri-yonetmeligi",
    "acil-saglik-hizmetleri-yonetmeligi",
    "ayakta-teshis-ozel-saglik",
    "isyeri-hekimi-yonetmeligi",
    "saglik-bakanligi-disiplin-yonetmeligi"
  ];

  const rgOnlyEntries: HealthLegislationInventoryEntry[] = [
    {
      key: "kisisel-saglik-verileri-yonetmeligi",
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      titleNormalized: "kisisel saglik verileri hakkinda yonetmelik",
      category: "data_privacy",
      relevanceLevel: "supporting",
      officialSourceRequired: true,
      officialSourceStatus: "candidate",
      relatedIssueIds: ["personal_health_data"],
      relatedTopicClusters: ["personal_health_data"],
      searchTerms: ["kişisel sağlık verisi", "sağlık verisi yönetmelik"],
      coverageStatus: "candidate",
      expectedLegislationType: "yonetmelik",
      expectedRgDate: "2019-06-21",
      expectedRgNumber: "30867",
      aliases: ["Kişisel Sağlık Verileri Yönetmeliği", "Sağlık Verileri Hakkında Yönetmelik"],
      markerTerms: ["kişisel sağlık verileri", "sağlık verisi", "mahremiyet"],
      negativeMarkerTerms: ["kişisel verilerin korunması kanunu", "6698"],
      knownWrongMatches: ["mevzuat:1.5.6698"],
      notes: ["Fixture for kisisel-saglik-verileri"]
    },
    {
      key: "acil-saglik-hizmetleri-yonetmeligi",
      title: "Acil Sağlık Hizmetleri Yönetmeliği",
      titleNormalized: "acil saglik hizmetleri yonetmeligi",
      category: "emergency_services",
      relevanceLevel: "core",
      officialSourceRequired: true,
      officialSourceStatus: "candidate",
      relatedIssueIds: ["emergency_intervention"],
      relatedTopicClusters: ["emergency_intervention", "emergency_exception"],
      searchTerms: ["acil sağlık", "acil servis", "acil müdahale"],
      coverageStatus: "candidate",
      expectedLegislationType: "yonetmelik",
      expectedRgDate: "2015-04-12",
      expectedRgNumber: "29332",
      aliases: ["Acil Sağlık Hizmetleri Hakkında Yönetmelik"],
      markerTerms: ["acil sağlık hizmetleri", "acil servis", "ambulans"],
      knownWrongMatches: ["mevzuat:1.5.6475", "mevzuat:1.5.6001"],
      notes: ["Fixture for acil-saglik"]
    },
    {
      key: "ayakta-teshis-ozel-saglik",
      title: "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik",
      titleNormalized: "ayakta teshis ve tedavi yapilan ozel saglik kuruluslari hakkinda yonetmelik",
      category: "private_health_facility",
      relevanceLevel: "core",
      officialSourceRequired: true,
      officialSourceStatus: "gap",
      relatedIssueIds: ["private_health_facility"],
      relatedTopicClusters: ["private_health_facility"],
      searchTerms: ["ayakta tedavi", "özel sağlık kuruluşu", "poliklinik"],
      coverageStatus: "gap",
      expectedLegislationType: "yonetmelik",
      expectedRgDate: "2014-02-17",
      expectedRgNumber: "29058",
      aliases: ["Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Yönetmeliği"],
      markerTerms: ["ayakta teşhis", "tedavi yapılan özel sağlık kuruluşları", "tıp merkezi"],
      knownWrongMatches: ["mevzuat:1.5.7191", "mevzuat:7.5.29134"],
      notes: ["Fixture for ayakta-teshis"]
    },
    {
      key: "isyeri-hekimi-yonetmeligi",
      title: "İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
      titleNormalized: "isyeri hekimi ve diger saglik personelinin gorev yetki sorumluluk egitim yonetmeligi",
      category: "occupational_health",
      relevanceLevel: "specialized",
      officialSourceRequired: true,
      officialSourceStatus: "candidate",
      relatedIssueIds: ["occupational_health"],
      relatedTopicClusters: ["professional_scope_of_practice"],
      searchTerms: ["işyeri hekimi", "iş yeri hekimi", "işyeri sağlık"],
      coverageStatus: "candidate",
      expectedLegislationType: "yonetmelik",
      expectedRgDate: "2016-08-27",
      expectedRgNumber: "29818",
      aliases: ["İşyeri Hekimi Yönetmeliği", "İşyeri Hekimi Görev Yetki Sorumluluk Yönetmeliği"],
      markerTerms: ["işyeri hekimi", "diğer sağlık personeli", "görev yetki sorumluluk"],
      knownWrongMatches: ["mevzuat:1.5.5510", "mevzuat:1.5.6331"],
      notes: ["Fixture for isyeri-hekimi"]
    },
    {
      key: "saglik-bakanligi-disiplin-yonetmeligi",
      title: "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik",
      titleNormalized: "saglik bakanligi disiplin amirleri disiplin kurullari ile ilgili yonetmelik",
      category: "discipline",
      relevanceLevel: "supporting",
      officialSourceRequired: true,
      officialSourceStatus: "candidate",
      relatedIssueIds: ["disciplinary_administrative"],
      relatedTopicClusters: ["professional_ethics"],
      searchTerms: ["disiplin soruşturması", "disiplin kurulu", "Sağlık Bakanlığı disiplin"],
      coverageStatus: "candidate",
      expectedLegislationType: "yonetmelik",
      expectedRgDate: "2004-04-26",
      expectedRgNumber: "25450",
      aliases: ["Sağlık Bakanlığı Disiplin Yönetmeliği", "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği"],
      markerTerms: ["disiplin amiri", "sağlık bakanlığı", "disiplin", "memur", "soruşturma"],
      negativeMarkerTerms: ["türk silahlı kuvvetleri", "asker", "tsk disiplin", "polis"],
      knownWrongMatches: ["mevzuat:1.5.6413", "mevzuat:1.5.657"],
      notes: ["Fixture for saglik-bakanligi-disiplin"]
    }
  ];

  it("all 5 RG-only entries are identified by filterRgOnlyLeads", () => {
    const result = filterRgOnlyLeads(rgOnlyEntries);
    expect(result.length).toBe(5);
    const keys = result.map((e) => e.key).sort();
    expect(keys).toEqual([...rgOnlyKeys].sort());
  });

  it("kisisel-saglik-verileri fixture with correct mock produces verified", async () => {
    const entry = rgOnlyEntries[0]; // kisisel-saglik-verileri-yonetmeligi
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.30867",
          title: "Kişisel Sağlık Verileri Hakkında Yönetmelik"
        })
      ]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
        text: "KİŞİSEL SAĞLIK VERİLERİ HAKKINDA YÖNETMELİK\n\nMadde 1 – Amaç: Kişisel sağlık verilerinin işlenmesi ve mahremiyetinin sağlanması.\nMadde 2 – Sağlık verisi sağlık hizmetleri kapsamında değerlendirilir.\nMadde 3 – Veri sorumlusu ve açık rıza yükümlülüğü."
      }))
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("verified");
    expect(result.bestCandidate?.sourceId).toBe("mevzuat:7.5.30867");
  });

  it("acil-saglik fixture with correct mock produces verified", async () => {
    const entry = rgOnlyEntries[1]; // acil-saglik-hizmetleri-yonetmeligi
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.29332",
          title: "Acil Sağlık Hizmetleri Yönetmeliği"
        })
      ]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Acil Sağlık Hizmetleri Yönetmeliği",
        text: "ACİL SAĞLIK HİZMETLERİ YÖNETMELİĞİ\n\nMadde 1 – Acil sağlık hizmetlerinin sunumu ve acil servis standartları düzenlenir.\nMadde 2 – Ambulans ve komuta kontrol merkezi hizmetleri.\nMadde 3 – Acil müdahale yükümlülüğü."
      }))
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("verified");
    expect(result.bestCandidate?.sourceId).toBe("mevzuat:7.5.29332");
  });

  it("wrong document fixture is rejected", async () => {
    const entry = rgOnlyEntries[0]; // kisisel-saglik-verileri
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:1.5.6698",
          title: "Kişisel Verilerin Korunması Kanunu"
        })
      ]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Kişisel Verilerin Korunması Kanunu",
        text: "KİŞİSEL VERİLERİN KORUNMASI KANUNU\n\nMadde 1 – Kişisel verilerin işlenmesine ilişkin usul ve esaslar.\nMadde 6 – Özel nitelikli kişisel veriler."
      }))
    };
    const result = await resolveRgEntry(entry, adapter);
    expect(result.verificationStatus).toBe("rejected");
  });

  it("RG-only lead never becomes active coverage without verifier approval", async () => {
    // Even if search finds a candidate, without verifier it stays candidate_found
    const entry = rgOnlyEntries[0];
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.30867",
          title: "Kişisel Sağlık Verileri Hakkında Yönetmelik"
        })
      ])
    };
    const result = await resolveRgEntry(entry, adapter);
    // Without fetchOfficialDocument, verifier cannot run → candidate_found, not verified
    expect(result.verificationStatus).toBe("candidate_found");
    expect(result.bestCandidate).toBeDefined();
    expect(result.recommendedNextAction).toContain("verifier");
  });

  it("no non-gov.tr sourceId appears in candidates", async () => {
    const entries = rgOnlyEntries.slice(0, 1);
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.30867",
          title: "Kişisel Sağlık Verileri Hakkında Yönetmelik"
        }),
        {
          sourceId: "external:1",
          title: "Fake",
          sourceUrl: "https://example.com/fake",
          documentUrl: "https://example.com/fake.pdf",
          legislationNumber: "",
          legislationType: "",
          legislationArrangement: ""
        }
      ])
    };
    const report = await buildRgResolutionReport(entries, adapter);
    // Only the gov.tr candidate should be in candidatesFound
    const result = report.entries[0];
    expect(result.candidatesFound.every((c: RgLeadResolutionCandidate) => c.sourceId.startsWith("mevzuat:"))).toBe(true);
  });

  it("report JSON is parseable for multiple entries", async () => {
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn()
    };
    const report = await buildRgResolutionReport(rgOnlyEntries, adapter);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as HealthLegislationRgResolutionResult;
    expect(parsed.rgLeadsProcessed).toBe(5);
    expect(parsed.entries.length).toBe(5);
    expect(parsed.generatedAt).toBeTruthy();
  });
});
