import { describe, it, expect, vi } from "vitest";
import {
  verifyRgDocument,
  buildRgDocumentVerificationReport,
  filterRgOnlyLeads,
  buildRgUrl,
  RgDocumentVerificationReport
} from "../src/officialGazetteDocumentVerifier.js";
import type { RgDocumentFetcher } from "../src/officialGazetteDocumentVerifier.js";
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

function makeRgPage(overrides: {
  title?: string;
  content?: string;
  statusCode?: number;
  returnNull?: boolean;
} = {}) {
  if (overrides.returnNull) return null;
  const title = overrides.title ?? "";
  const content = overrides.content ?? `<html><head><title>Test</title></head><body>Test içeriği</body></html>`;
  return {
    title,
    content,
    statusCode: overrides.statusCode ?? 200
  };
}

function makeFetcher(overrides: {
  returnNull?: boolean;
  statusCode?: number;
  title?: string;
  content?: string;
} = {}): RgDocumentFetcher {
  return {
    fetchRgPage: vi.fn().mockResolvedValue(makeRgPage(overrides))
  };
}

// ─── buildRgUrl ────────────────────────────────────────────────────────────────

describe("buildRgUrl", () => {
  it("builds date-based RG URL", () => {
    const url = buildRgUrl("2019-06-21");
    expect(url).toBe("https://www.resmigazete.gov.tr/eskiler/2019/06/20190621.htm");
  });

  it("builds number-based RG URL when no date", () => {
    const url = buildRgUrl(undefined, "30867");
    expect(url).toBe("https://www.resmigazete.gov.tr/eskiler/30867.htm");
  });

  it("returns empty string when neither date nor number", () => {
    const url = buildRgUrl();
    expect(url).toBe("");
  });

  it("prefers date over number when both given", () => {
    const url = buildRgUrl("2019-06-21", "30867");
    expect(url).toContain("2019/06/20190621");
    expect(url).not.toContain("30867");
  });
});

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

// ─── verifyRgDocument ──────────────────────────────────────────────────────────

describe("verifyRgDocument", () => {
  it("returns rg_verification_error when no RG number or date", async () => {
    const entry = makeEntry({ key: "no-rg" });
    const fetcher = makeFetcher();
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verification_error");
    expect(result.rgUrl).toBe("");
  });

  it("returns rg_unavailable when fetcher returns null", async () => {
    const entry = makeEntry({ key: "unavailable", expectedRgNumber: "30867", expectedRgDate: "2019-06-21" });
    const fetcher = makeFetcher({ returnNull: true });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_unavailable");
  });

  it("returns rg_not_found when HTTP status >= 400", async () => {
    const entry = makeEntry({ key: "not-found", expectedRgNumber: "99999", expectedRgDate: "2020-01-01" });
    const fetcher = makeFetcher({ statusCode: 404 });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_not_found");
    expect(result.errorMessage).toContain("HTTP 404");
  });

  it("returns rg_wrong_document when title score < 0.50", async () => {
    const entry = makeEntry({
      key: "wrong-doc",
      title: "Completele Farklı Yönetmelik",
      expectedRgNumber: "30867",
      expectedRgDate: "2019-06-21"
    });
    const fetcher = makeFetcher({
      title: "İlgisiz Başka Bir Düzenleme",
      content: "<html><head><title>İlgisiz Başka Bir Düzenleme</title></head><body>Farklı içerik</body></html>"
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_wrong_document");
    expect(result.titleScore).toBeLessThan(0.50);
  });

  it("returns rg_wrong_document when markerScore is 0 and markerTerms exist", async () => {
    const entry = makeEntry({
      key: "no-markers",
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      expectedRgNumber: "30867",
      expectedRgDate: "2019-06-21",
      markerTerms: ["mahremiyet", "veri sorumlusu", "açık rıza"]
    });
    const fetcher = makeFetcher({
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      content: "<html><head><title>Kişisel Sağlık Verileri Hakkında Yönetmelik</title></head><body>İlgisiz içerik burada</body></html>"
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_wrong_document");
    expect(result.markerScore).toBe(0);
  });

  it("returns rg_verified when title and markers match", async () => {
    const entry = makeEntry({
      key: "verified-test",
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      expectedRgNumber: "30867",
      expectedRgDate: "2019-06-21",
      markerTerms: ["kişisel sağlık verileri", "sağlık verisi"]
    });
    const fetcher = makeFetcher({
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      content: "<html><head><title>Kişisel Sağlık Verileri Hakkında Yönetmelik</title></head><body>kişisel sağlık verileri mahremiyet ve sağlık verisi işleme esasları</body></html>"
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
    expect(result.titleScore).toBeGreaterThanOrEqual(0.50);
    expect(result.markerScore).toBeGreaterThan(0);
  });

  it("extracts title from <h1> when <title> is missing", async () => {
    const entry = makeEntry({
      key: "h1-title",
      title: "Acil Sağlık Hizmetleri Yönetmeliği",
      expectedRgNumber: "29332",
      expectedRgDate: "2015-04-12",
      markerTerms: ["acil sağlık"]
    });
    const fetcher = makeFetcher({
      title: "",
      content: "<html><head></head><body><h1>Acil Sağlık Hizmetleri Yönetmeliği</h1>Acil sağlık hizmetleri sunumu</body></html>"
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
  });

  it("returns rg_verification_error when fetcher throws", async () => {
    const entry = makeEntry({ key: "throws", expectedRgNumber: "30867", expectedRgDate: "2019-06-21" });
    const fetcher: RgDocumentFetcher = {
      fetchRgPage: vi.fn().mockRejectedValue(new Error("Network failure"))
    };
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verification_error");
    expect(result.errorMessage).toContain("Network failure");
  });

  it("accepts entry with no markerTerms as verified if title matches", async () => {
    const entry = makeEntry({
      key: "no-marker-terms",
      title: "Test Yönetmeliği",
      expectedRgNumber: "12345",
      expectedRgDate: "2020-01-01"
    });
    const fetcher = makeFetcher({
      title: "Test Yönetmeliği",
      content: "<html><head><title>Test Yönetmeliği</title></head><body>Herhangi bir içerik</body></html>"
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
    expect(result.markerScore).toBe(0);
  });
});

// ─── buildRgDocumentVerificationReport ────────────────────────────────────────

describe("buildRgDocumentVerificationReport", () => {
  it("returns correct summary when no RG-only entries", async () => {
    const entries = [
      makeEntry({ key: "verified", mevzuatSourceId: "mevzuat:7.5.111", officialSourceStatus: "verified" })
    ];
    const fetcher = makeFetcher();
    const report = await buildRgDocumentVerificationReport(entries, fetcher);
    expect(report.entriesScanned).toBe(1);
    expect(report.rgEntriesProcessed).toBe(0);
    expect(report.rgVerifiedCount).toBe(0);
  });

  it("processes RG-only entries", async () => {
    const entries = [
      makeEntry({ key: "rg-1", expectedRgNumber: "11111", expectedRgDate: "2020-01-01", markerTerms: ["test"] }),
      makeEntry({ key: "rg-2", expectedRgNumber: "22222", expectedRgDate: "2020-02-02", markerTerms: ["test"] }),
      makeEntry({ key: "no-rg" })
    ];
    const fetcher = makeFetcher({
      title: "Test Yönetmeliği",
      content: "<html><head><title>Test Yönetmeliği</title></head><body>test içeriği</body></html>"
    });
    const report = await buildRgDocumentVerificationReport(entries, fetcher);
    expect(report.entriesScanned).toBe(3);
    expect(report.rgEntriesProcessed).toBe(2);
    expect(report.entries.length).toBe(2);
  });

  it("report JSON is parseable", async () => {
    const entries = [
      makeEntry({ key: "json-test", expectedRgNumber: "33333", expectedRgDate: "2020-03-03", markerTerms: ["test"] })
    ];
    const fetcher = makeFetcher({
      title: "Test Yönetmeliği",
      content: "<html><head><title>Test Yönetmeliği</title></head><body>test içeriği</body></html>"
    });
    const report = await buildRgDocumentVerificationReport(entries, fetcher);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as RgDocumentVerificationReport;
    expect(parsed.rgEntriesProcessed).toBe(1);
    expect(parsed.generatedAt).toBeTruthy();
  });

  it("has required top-level fields", async () => {
    const report = await buildRgDocumentVerificationReport([], makeFetcher());
    const requiredFields = [
      "entriesScanned", "rgEntriesProcessed", "rgVerifiedCount",
      "rgVerifiedNoSourceIdCount", "rgNotFoundCount", "rgWrongDocumentCount",
      "rgUnavailableCount", "rgErrorCount", "entries", "generatedAt"
    ];
    for (const field of requiredFields) {
      expect(report).toHaveProperty(field);
    }
  });

  it("counts rgVerifiedNoSourceId correctly", async () => {
    const entry = makeEntry({
      key: "verified-no-sid",
      title: "Test Yönetmeliği",
      expectedRgNumber: "44444",
      expectedRgDate: "2020-04-04",
      markerTerms: ["test"]
    });
    const fetcher = makeFetcher({
      title: "Test Yönetmeliği",
      content: "<html><head><title>Test Yönetmeliği</title></head><body>test içeriği</body></html>"
    });
    const report = await buildRgDocumentVerificationReport([entry], fetcher);
    expect(report.rgVerifiedCount).toBe(1);
    expect(report.rgVerifiedNoSourceIdCount).toBe(1);
  });
});

// ─── Real inventory fixtures ───────────────────────────────────────────────────

describe("real inventory RG-only entries — verifier contract", () => {
  const rgOnlyKeys = [
    "kisisel-saglik-verileri-yonetmeligi",
    "acil-saglik-hizmetleri-yonetmeligi",
    "ayakta-teshis-ozel-saglik",
    "isyeri-hekimi-yonetmeligi",
    "saglik-bakanligi-disiplin-yonetmeligi",
    "ozel-hastaneler-yonetmeligi"
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
    },
    {
      key: "ozel-hastaneler-yonetmeligi",
      title: "Özel Hastaneler Yönetmeliği",
      titleNormalized: "ozel hastaneler yonetmeligi",
      category: "private_health_facility",
      relevanceLevel: "core",
      officialSourceRequired: true,
      officialSourceStatus: "gap",
      relatedIssueIds: ["private_health_facility"],
      relatedTopicClusters: ["private_health_facility"],
      searchTerms: ["özel hastane", "özel sağlık kuruluşu"],
      coverageStatus: "gap",
      expectedLegislationType: "yonetmelik",
      expectedRgDate: "2014-03-27",
      expectedRgNumber: "29092",
      aliases: ["Özel Hastaneler Hakkında Yönetmelik", "Özel Hastane Yönetmeliği"],
      markerTerms: ["özel hastane", "ruhsat", "mesul müdür", "sağlık kuruluşu"],
      knownWrongMatches: ["mevzuat:1.5.7191", "mevzuat:1.5.6001", "mevzuat:7.5.29134"],
      notes: ["Fixture for ozel-hastaneler"]
    }
  ];

  it("all 6 RG-only entries are identified by filterRgOnlyLeads", () => {
    const result = filterRgOnlyLeads(rgOnlyEntries);
    expect(result.length).toBe(6);
    const keys = result.map((e) => e.key).sort();
    expect(keys).toEqual([...rgOnlyKeys].sort());
  });

  it("kisisel-saglik-verileri fixture with correct mock produces rg_verified", async () => {
    const entry = rgOnlyEntries[0];
    const fetcher = makeFetcher({
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      content: [
        "<html><head><title>Kişisel Sağlık Verileri Hakkında Yönetmelik</title></head><body>",
        "KİŞİSEL SAĞLIK VERİLERİ HAKKINDA YÖNETMELİK",
        "Madde 1 – Kişisel sağlık verilerinin işlenmesi ve mahremiyet.",
        "Madde 2 – Sağlık verisi işleme esasları.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
    expect(result.rgUrl).toContain("2019/06/20190621");
  });

  it("acil-saglik fixture with correct mock produces rg_verified", async () => {
    const entry = rgOnlyEntries[1];
    const fetcher = makeFetcher({
      title: "Acil Sağlık Hizmetleri Yönetmeliği",
      content: [
        "<html><head><title>Acil Sağlık Hizmetleri Yönetmeliği</title></head><body>",
        "ACİL SAĞLIK HİZMETLERİ YÖNETMELİĞİ",
        "Madde 1 – Acil sağlık hizmetleri sunumu ve acil servis standartları.",
        "Madde 2 – Ambulans ve komuta kontrol merkezi hizmetleri.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
  });

  it("ayakta-teshis fixture with correct mock produces rg_verified", async () => {
    const entry = rgOnlyEntries[2];
    const fetcher = makeFetcher({
      title: "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik",
      content: [
        "<html><head><title>Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik</title></head><body>",
        "AYAKTA TEŞHİS VE TEDAVİ YAPILAN ÖZEL SAĞLIK KURULUŞLARI HAKKINDA YÖNETMELİK",
        "Madde 1 – Ayakta teşhis ve tedavi yapılan özel sağlık kuruluşları.",
        "Madde 2 – Tıp merkezi ve poliklinik standartları.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
  });

  it("isyeri-hekimi fixture with correct mock produces rg_verified", async () => {
    const entry = rgOnlyEntries[3];
    const fetcher = makeFetcher({
      title: "İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
      content: [
        "<html><head><title>İşyeri Hekimi ve Diğer Sağlık Personelinin Görev Yetki Sorumluluk ve Eğitimleri Hakkında Yönetmelik</title></head><body>",
        "İŞYERİ HEKİMİ VE DİĞER SAĞLIK PERSONELİNİN GÖREV YETKİ SORUMLULUK VE EĞİTİMLERİ HAKKINDA YÖNETMELİK",
        "Madde 1 – İşyeri hekimi görev yetki ve sorumlulukları.",
        "Madde 2 – İş sağlığı ve güvenliği hizmetleri.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
  });

  it("saglik-bakanligi-disiplin fixture with correct mock produces rg_verified", async () => {
    const entry = rgOnlyEntries[4];
    const fetcher = makeFetcher({
      title: "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik",
      content: [
        "<html><head><title>Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik</title></head><body>",
        "SAĞLIK BAKANLIĞI DİSİPLİN AMİRLERİ VE DİSİPLİN KURULLARI İLE İLGİLİ YÖNETMELİK",
        "Madde 1 – Sağlık bakanlığı disiplin amirleri.",
        "Madde 2 – Disiplin soruşturması usulleri.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
  });

  it("ozel-hastaneler fixture with correct mock produces rg_verified", async () => {
    const entry = rgOnlyEntries[5];
    const fetcher = makeFetcher({
      title: "Özel Hastaneler Yönetmeliği",
      content: [
        "<html><head><title>Özel Hastaneler Yönetmeliği</title></head><body>",
        "ÖZEL HASTANELER YÖNETMELİĞİ",
        "Madde 1 – Özel hastanelerin ruhsatlandırılması.",
        "Madde 2 – Mesul müdür ve sağlık kuruluşu standartları.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_verified");
  });

  it("wrong document fixture is rejected as rg_wrong_document", async () => {
    const entry = rgOnlyEntries[0]; // kisisel-saglik-verileri
    const fetcher = makeFetcher({
      title: "Kişisel Verilerin Korunması Kanunu",
      content: [
        "<html><head><title>Kişisel Verilerin Korunması Kanunu</title></head><body>",
        "KİŞİSEL VERİLERİN KORUNMASI KANUNU",
        "Madde 1 – Kişisel verilerin işlenmesi usul ve esasları.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_wrong_document");
  });

  it("RG-only verified entry reports rgVerifiedNoSourceIdCount", async () => {
    const fetcher = makeFetcher({
      title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
      content: [
        "<html><head><title>Kişisel Sağlık Verileri Hakkında Yönetmelik</title></head><body>",
        "kişisel sağlık verileri mahremiyet ve sağlık verisi",
        "</body></html>"
      ].join("\n")
    });
    const report = await buildRgDocumentVerificationReport(rgOnlyEntries.slice(0, 1), fetcher);
    expect(report.rgVerifiedCount).toBe(1);
    expect(report.rgVerifiedNoSourceIdCount).toBe(1);
  });

  it("report JSON is parseable for all 6 entries", async () => {
    const fetcher = makeFetcher({
      title: "Test",
      content: "<html><head><title>Test</title></head><body>Test</body></html>"
    });
    const report = await buildRgDocumentVerificationReport(rgOnlyEntries, fetcher);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as RgDocumentVerificationReport;
    expect(parsed.rgEntriesProcessed).toBe(6);
    expect(parsed.entries.length).toBe(6);
    expect(parsed.generatedAt).toBeTruthy();
  });

  // ── RG body marker / generic HTML title tests (v0.36.0) ──────────────

  it("generic RG page title with body marker terms reports markerScore > 0 but rg_wrong_document", async () => {
    // Real resmigazete.gov.tr pages have <title>T.C. Resmî Gazete</title>
    // but the regulation title and content appear in the <body>
    const entry = rgOnlyEntries[1]; // acil-saglik
    const fetcher = makeFetcher({
      title: "T.C. Resmî Gazete",
      content: [
        "<html><head><title>T.C. Resmî Gazete</title></head><body>",
        "T.C. RESMÎ GAZETE",
        "12 Nisan 2015 PAZAR",
        "Sayı : 29332",
        "",
        "ACİL SAĞLIK HİZMETLERİ YÖNETMELİĞİ",
        "Madde 1 – Acil sağlık hizmetleri sunumu ve acil servis standartları.",
        "Madde 2 – Ambulans ve komuta kontrol merkezi hizmetleri.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    // Title extracted from <title> is generic → titleScore is 0
    expect(result.titleScore).toBeLessThan(0.50);
    // Body contains marker terms → markerScore is > 0
    expect(result.markerScore).toBeGreaterThan(0);
    // Title mismatch still gates as rg_wrong_document (body-level extraction not applied)
    expect(result.status).toBe("rg_wrong_document");
    expect(result.fetchedTitle).toBe("T.C. Resmî Gazete");
  });

  it("body-level regulation title extraction not implemented — generic title limitation documented", async () => {
    // The verifier extracts <title> and <h1> tags but does NOT parse the HTML body
    // to find the specific regulation title. Real RG pages have generic page titles,
    // so body-level parsing (e.g. finding the first <p> or <div> with regulation name)
    // would be needed for accurate rg_verified status.
    // This test documents that limitation — see CHANGELOG v0.36.0 "deferred" note.
    const genericTitle = "T.C. Resmî Gazete";
    const bodyContainsTitle = "Kişisel Sağlık Verileri Hakkında Yönetmelik";

    const entry = rgOnlyEntries[0]; // kisisel-saglik-verileri
    const fetcher = makeFetcher({
      title: genericTitle,
      content: [
        "<html><head><title>T.C. Resmî Gazete</title></head><body>",
        "21 Haziran 2019 CUMA",
        `Sayı : ${entry.expectedRgNumber}`,
        "",
        bodyContainsTitle.toUpperCase(),
        "Madde 1 – Kişisel sağlık verilerinin işlenmesi ve mahremiyeti.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    // Body contains the actual regulation title, but verifier only checks <title>/<h1>
    expect(result.status).toBe("rg_wrong_document");
    expect(result.titleScore).toBeLessThan(0.50);
    // markerScore reflects body content match
    expect(result.markerScore).toBeGreaterThan(0);
    // Even if we fixed body extraction, promotion would still require mevzuat sourceId
  });

  it("RG verified alone never promotes to active coverage without mevzuat sourceId", async () => {
    // This test verifies the safety invariant: RG document verification alone
    // (even if rg_verified) does NOT add to active HealthLegislationHint.
    const entry = rgOnlyEntries[4]; // saglik-bakanligi-disiplin
    expect(entry.mevzuatSourceId).toBeUndefined();
    expect(entry.officialSourceStatus).toBe("candidate");

    const fetcher = makeFetcher({
      title: "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik",
      content: [
        "<html><head><title>Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik</title></head><body>",
        "SAĞLIK BAKANLIĞI DİSİPLİN AMİRLERİ VE DİSİPLİN KURULLARI İLE İLGİLİ YÖNETMELİK",
        "Madde 1 – disiplin amiri görevleri.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    // Document verifies correctly
    expect(result.status).toBe("rg_verified");
    // But inventory status is unchanged — still candidate
    expect(entry.mevzuatSourceId).toBeUndefined();
    expect(entry.officialSourceStatus).toBe("candidate");
    // Report correctly counts this as rgVerifiedButNoMevzuatSourceId
    const report = await buildRgDocumentVerificationReport([entry], fetcher);
    expect(report.rgVerifiedCount).toBe(1);
    expect(report.rgVerifiedNoSourceIdCount).toBe(1);
    // No active hint promotion — coverage would require verification module change
  });

  it("generic title with body markers — markerScore shows content match exists", async () => {
    // Demonstrate that markerScore is computed from full body content even when
    // title extraction fails. This validates the verifier reports partial signal.
    const entry = rgOnlyEntries[3]; // isyeri-hekimi — markerTerms: isyeri hekimi, diger saglik personeli, gorev yetki sorumluluk
    const fetcher = makeFetcher({
      title: "T.C. Resmî Gazete",
      content: [
        "<html><head><title>T.C. Resmî Gazete</title></head><body>",
        "Sayı : 29818",
        "İŞYERİ HEKİMİ VE DİĞER SAĞLIK PERSONELİNİN GÖREV YETKİ SORUMLULUK VE EĞİTİMLERİ HAKKINDA YÖNETMELİK",
        "Madde 1 – İşyeri hekimi görev yetki sorumluluk.",
        "</body></html>"
      ].join("\n")
    });
    const result = await verifyRgDocument(entry, fetcher);
    expect(result.status).toBe("rg_wrong_document");
    expect(result.titleScore).toBeLessThan(0.50);
    // All 3 marker terms are in body
    expect(result.markerScore).toBe(1);
    expect(result.fetchedTitle).toBe("T.C. Resmî Gazete");
  });
});
