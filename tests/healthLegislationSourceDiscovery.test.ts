import { describe, it, expect } from "vitest";
import {
  discoverEntrySources,
  buildSourceDiscoveryReport,
  filterDiscoveryCandidates,
  OfficialSourceLead,
  OfficialSourceLeadKind,
  OfficialSourceLeadStatus,
  SourceDiscoveryReport
} from "../src/healthLegislationSourceDiscovery.js";
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

// ─── discoverEntrySources ─────────────────────────────────────────────────────

describe("discoverEntrySources", () => {
  it("returns result with entryKey and entryTitle", () => {
    const entry = makeEntry({ key: "test-key", title: "Test Title" });
    const result = discoverEntrySources(entry);
    expect(result.entryKey).toBe("test-key");
    expect(result.entryTitle).toBe("Test Title");
  });

  it("collects mevzuat_source_id lead when candidateLegacySourceId is set", () => {
    const entry = makeEntry({
      candidateLegacySourceId: "mevzuat:7.5.12345",
      expectedRgDate: "2020-01-15",
      expectedRgNumber: "31000"
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "mevzuat_source_id");
    expect(lead).toBeDefined();
    expect(lead!.sourceId).toBe("mevzuat:7.5.12345");
    expect(lead!.domain).toBe("mevzuat.gov.tr");
    expect(lead!.officialUrl).toContain("mevzuat.gov.tr");
    expect(lead!.confidence).toBe("low");
  });

  it("mevzuat_source_id lead has medium confidence when candidateOfficialUrlLead is also set", () => {
    const entry = makeEntry({
      candidateLegacySourceId: "mevzuat:7.5.12345",
      candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.12345.pdf"
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "mevzuat_source_id");
    expect(lead!.confidence).toBe("medium");
  });

  it("collects resmi_gazete_url lead when RG metadata is set", () => {
    const entry = makeEntry({
      expectedRgDate: "2014-03-27",
      expectedRgNumber: "29092"
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "resmi_gazete_url");
    expect(lead).toBeDefined();
    expect(lead!.domain).toBe("resmigazete.gov.tr");
    expect(lead!.rgDate).toBe("2014-03-27");
    expect(lead!.rgNumber).toBe("29092");
    expect(lead!.confidence).toBe("medium");
    expect(lead!.officialUrl).toContain("resmigazete.gov.tr");
  });

  it("resmi_gazete_url lead has low confidence when only date is set", () => {
    const entry = makeEntry({
      expectedRgDate: "2014-03-27"
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "resmi_gazete_url");
    expect(lead!.confidence).toBe("low");
  });

  it("collects candidate_title_match lead from aliases", () => {
    const entry = makeEntry({
      aliases: ["Test Yönetmeliği Alias", "Test Regulation"],
      searchTerms: ["test yonetmelik"]
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "candidate_title_match");
    expect(lead).toBeDefined();
    expect(lead!.domain).toBe("mevzuat.gov.tr");
    expect(lead!.confidence).toBe("medium"); // 2+ aliases
  });

  it("candidate_title_match lead has low confidence with < 2 aliases", () => {
    const entry = makeEntry({
      aliases: ["Test Alias"],
      searchTerms: ["test"]
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "candidate_title_match");
    expect(lead!.confidence).toBe("low");
  });

  it("collects saglik_gov_tr_page lead from candidateOfficialUrlLead", () => {
    const entry = makeEntry({
      candidateOfficialUrlLead: "https://www.saglik.gov.tr/mevzuat/ozel-hastaneler"
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "saglik_gov_tr_page");
    expect(lead).toBeDefined();
    expect(lead!.domain).toBe("saglik.gov.tr");
  });

  it("ignores non-gov.tr saglik_gov_tr_page lead", () => {
    const entry = makeEntry({
      candidateOfficialUrlLead: "https://www.example.com/mevzuat"
    });
    const result = discoverEntrySources(entry);
    const lead = result.leads.find((l) => l.leadKind === "saglik_gov_tr_page");
    expect(lead).toBeUndefined();
    expect(result.ignoredNonOfficialLeads.length).toBe(1);
    expect(result.ignoredNonOfficialLeads[0].officialUrl).toBe("https://www.example.com/mevzuat");
  });

  it("no lead is created when entry has no discovery metadata", () => {
    const entry = makeEntry();
    const result = discoverEntrySources(entry);
    // Only candidate_title_match with low confidence is created from searchTerms
    expect(result.leads.every((l) => l.confidence === "low")).toBe(true);
  });

  it("recommendedNextAction indicates missing sourceId when none set", () => {
    const entry = makeEntry();
    const result = discoverEntrySources(entry);
    expect(result.recommendedNextAction).toContain("Missing");
    expect(result.recommendedNextAction).toContain("sourceId");
  });

  it("recommendedNextAction references sourceId when high confidence", () => {
    const entry = makeEntry({
      candidateLegacySourceId: "mevzuat:7.5.12345",
      candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.12345.pdf"
    });
    const result = discoverEntrySources(entry);
    // confidence is "medium" because the URL is present
    expect(result.recommendedNextAction).toContain("mevzuat:7.5.12345");
  });

  it("RG lead alone (without sourceId) does not create high-confidence lead", () => {
    const entry = makeEntry({
      expectedRgDate: "2014-03-27",
      expectedRgNumber: "29092"
    });
    const result = discoverEntrySources(entry);
    const hasHighConfidence = result.leads.some((l) => l.confidence === "high");
    expect(hasHighConfidence).toBe(false);
    // RG lead is medium, title match is low (1 alias)
    const rgLead = result.leads.find((l) => l.leadKind === "resmi_gazete_url");
    expect(rgLead!.confidence).toBe("medium");
  });
});

// ─── buildSourceDiscoveryReport ───────────────────────────────────────────────

describe("buildSourceDiscoveryReport", () => {
  it("returns correct counts for empty input", () => {
    const report = buildSourceDiscoveryReport([]);
    expect(report.entriesScanned).toBe(0);
    expect(report.leadsFound).toBe(0);
    expect(report.officialLeadsFound).toBe(0);
    expect(report.nonOfficialLeadsIgnored).toBe(0);
    expect(report.needsManualReviewCount).toBe(0);
  });

  it("returns correct counts for entries with leads", () => {
    const entries = [
      makeEntry({
        key: "e1",
        candidateLegacySourceId: "mevzuat:7.5.29092",
        candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.29092.pdf",
        expectedRgDate: "2014-03-27",
        expectedRgNumber: "29092",
        aliases: ["Alias 1", "Alias 2"]
      })
    ];
    const report = buildSourceDiscoveryReport(entries);
    expect(report.entriesScanned).toBe(1);
    expect(report.leadsFound).toBeGreaterThanOrEqual(2);
    expect(report.officialLeadsFound).toBeGreaterThanOrEqual(2);
    expect(report.nonOfficialLeadsIgnored).toBe(0);
    expect(report.leadsSentToVerifier).toBe(1);
  });

  it("counts nonOfficialLeadsIgnored correctly", () => {
    const entries = [
      makeEntry({
        key: "non-gov",
        candidateOfficialUrlLead: "https://www.example.com/fake"
      })
    ];
    const report = buildSourceDiscoveryReport(entries);
    expect(report.nonOfficialLeadsIgnored).toBe(1);
  });

  it("needsManualReviewCount includes entries with only low-confidence leads", () => {
    const entries = [
      makeEntry({ key: "low-only" }) // no strong metadata
    ];
    const report = buildSourceDiscoveryReport(entries);
    expect(report.needsManualReviewCount).toBe(1);
  });

  it("needsManualReviewCount excludes entries with medium+ confidence leads", () => {
    const entries = [
      makeEntry({
        candidateLegacySourceId: "mevzuat:7.5.29092",
        candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.29092.pdf"
      })
    ];
    const report = buildSourceDiscoveryReport(entries);
    expect(report.needsManualReviewCount).toBe(0);
  });

  it("has generatedAt ISO timestamp", () => {
    const report = buildSourceDiscoveryReport([makeEntry()]);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("verifierVerifiedCount and verifierRejectedCount start at 0", () => {
    const report = buildSourceDiscoveryReport([makeEntry()]);
    expect(report.verifierVerifiedCount).toBe(0);
    expect(report.verifierRejectedCount).toBe(0);
  });

  it("leadsSentToVerifier counts entries with mevzuat_source_id leads", () => {
    const entries = [
      makeEntry({ key: "has-sourceid", candidateLegacySourceId: "mevzuat:7.5.99999" }),
      makeEntry({ key: "no-sourceid" })
    ];
    const report = buildSourceDiscoveryReport(entries);
    expect(report.leadsSentToVerifier).toBe(1);
  });
});

// ─── filterDiscoveryCandidates ────────────────────────────────────────────────

describe("filterDiscoveryCandidates", () => {
  it("returns only gap and candidate entries", () => {
    const entries = [
      makeEntry({ key: "gap", coverageStatus: "gap", officialSourceStatus: "gap" }),
      makeEntry({ key: "candidate", coverageStatus: "candidate", officialSourceStatus: "candidate" }),
      makeEntry({ key: "covered", coverageStatus: "covered", officialSourceStatus: "verified" }),
      makeEntry({ key: "deferred", coverageStatus: "deferred", officialSourceStatus: "deferred" })
    ];
    const result = filterDiscoveryCandidates(entries);
    expect(result.length).toBe(2);
    expect(result.map((e) => e.key)).toEqual(["gap", "candidate"]);
  });
});

// ─── Remaining 6 entries contract ─────────────────────────────────────────────

describe("remaining 6 entries — discovery contract", () => {
  const remaining6Keys = [
    "ozel-hastaneler-yonetmeligi",
    "ayakta-teshis-ozel-saglik",
    "acil-saglik-hizmetleri-yonetmeligi",
    "isyeri-hekimi-yonetmeligi",
    "kisisel-saglik-verileri-yonetmeligi",
    "saglik-bakanligi-disiplin-yonetmeligi"
  ];

  // Build entries matching the inventory shapes
  const ozelHastaneler = makeEntry({
    key: "ozel-hastaneler-yonetmeligi",
    title: "Özel Hastaneler Yönetmeliği",
    candidateLegacySourceId: "mevzuat:7.5.29092",
    candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.29092.pdf",
    expectedRgDate: "2014-03-27",
    expectedRgNumber: "29092",
    aliases: ["Özel Hastaneler Hakkında Yönetmelik", "Özel Hastane Yönetmeliği"],
    searchTerms: ["özel hastane", "özel sağlık kuruluşu"],
    coverageStatus: "gap",
    officialSourceStatus: "gap"
  });

  const ayaktaTeshis = makeEntry({
    key: "ayakta-teshis-ozel-saglik",
    title: "Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik",
    expectedRgDate: "2014-02-17",
    expectedRgNumber: "29058",
    aliases: ["Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Yönetmeliği"],
    searchTerms: ["ayakta tedavi", "özel sağlık kuruluşu"],
    coverageStatus: "gap",
    officialSourceStatus: "gap"
  });

  const acilSaglik = makeEntry({
    key: "acil-saglik-hizmetleri-yonetmeligi",
    title: "Acil Sağlık Hizmetleri Yönetmeliği",
    expectedRgDate: "2015-04-12",
    expectedRgNumber: "29332",
    aliases: ["Acil Sağlık Hizmetleri Hakkında Yönetmelik"],
    searchTerms: ["acil sağlık", "acil servis"],
    coverageStatus: "candidate",
    officialSourceStatus: "candidate"
  });

  const isyeriHekimi = makeEntry({
    key: "isyeri-hekimi-yonetmeligi",
    title: "İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
    expectedRgDate: "2016-08-27",
    expectedRgNumber: "29818",
    aliases: ["İşyeri Hekimi Yönetmeliği"],
    searchTerms: ["işyeri hekimi", "iş yeri hekimi"],
    coverageStatus: "candidate",
    officialSourceStatus: "candidate"
  });

  const kisiselVeri = makeEntry({
    key: "kisisel-saglik-verileri-yonetmeligi",
    title: "Kişisel Sağlık Verileri Hakkında Yönetmelik",
    expectedRgDate: "2019-06-21",
    expectedRgNumber: "30867",
    aliases: ["Kişisel Sağlık Verileri Yönetmeliği"],
    searchTerms: ["kişisel sağlık verisi", "sağlık verisi yönetmelik"],
    coverageStatus: "candidate",
    officialSourceStatus: "candidate"
  });

  const bakanlikDisiplin = makeEntry({
    key: "saglik-bakanligi-disiplin-yonetmeligi",
    title: "Sağlık Bakanlığı Disiplin Amirleri ve Disiplin Kurulları ile İlgili Yönetmelik",
    expectedRgDate: "2004-04-26",
    expectedRgNumber: "25450",
    aliases: ["Sağlık Bakanlığı Disiplin Yönetmeliği"],
    searchTerms: ["disiplin soruşturması", "disiplin kurulu"],
    coverageStatus: "candidate",
    officialSourceStatus: "candidate"
  });

  const fixtures = [ozelHastaneler, ayaktaTeshis, acilSaglik, isyeriHekimi, kisiselVeri, bakanlikDisiplin];

  it("all 6 entries produce a discovery result", () => {
    const results = fixtures.map(discoverEntrySources);
    expect(results.length).toBe(6);
    for (const r of results) {
      expect(r.entryKey).toBeTruthy();
      expect(r.entryTitle).toBeTruthy();
      expect(r.recommendedNextAction).toBeTruthy();
    }
  });

  it("ozel-hastaneler has mevzuat_source_id and resmi_gazete leads", () => {
    const result = discoverEntrySources(ozelHastaneler);
    const kinds = result.leads.map((l) => l.leadKind);
    expect(kinds).toContain("mevzuat_source_id");
    expect(kinds).toContain("resmi_gazete_url");
  });

  it("ozel-hastaneler has medium confidence sourceId lead", () => {
    const result = discoverEntrySources(ozelHastaneler);
    const lead = result.leads.find((l) => l.leadKind === "mevzuat_source_id");
    expect(lead!.confidence).toBe("medium");
  });

  it("ayakta-teshis has resmi_gazete_url lead but no sourceId lead", () => {
    const result = discoverEntrySources(ayaktaTeshis);
    const kinds = result.leads.map((l) => l.leadKind);
    expect(kinds).toContain("resmi_gazete_url");
    expect(kinds).not.toContain("mevzuat_source_id");
    // Missing sourceId, RG number — should need manual review
    expect(result.recommendedNextAction).toContain("sourceId");
  });

  it("acil-saglik has resmi_gazete_url lead and candidate_title_match", () => {
    const result = discoverEntrySources(acilSaglik);
    const kinds = result.leads.map((l) => l.leadKind);
    expect(kinds).toContain("resmi_gazete_url");
    expect(kinds).toContain("candidate_title_match");
  });

  it("isyeri-hekimi has resmi_gazete_url lead — no sourceId", () => {
    const result = discoverEntrySources(isyeriHekimi);
    expect(result.leads.some((l) => l.leadKind === "mevzuat_source_id")).toBe(false);
    expect(result.leads.some((l) => l.leadKind === "resmi_gazete_url")).toBe(true);
    expect(result.recommendedNextAction).toContain("sourceId");
  });

  it("kisisel-saglik-verileri has resmi_gazete_url lead", () => {
    const result = discoverEntrySources(kisiselVeri);
    expect(result.leads.some((l) => l.leadKind === "resmi_gazete_url")).toBe(true);
  });

  it("saglik-bakanligi-disiplin has resmi_gazete_url lead — old regulation warning", () => {
    const result = discoverEntrySources(bakanlikDisiplin);
    const rgLead = result.leads.find((l) => l.leadKind === "resmi_gazete_url");
    expect(rgLead!.rgDate).toBe("2004-04-26");
    // Old regulation — may have been updated
    expect(result.recommendedNextAction).toBeTruthy();
  });

  it("all 6 entries have recommendedNextAction", () => {
    for (const entry of fixtures) {
      const result = discoverEntrySources(entry);
      expect(result.recommendedNextAction.length).toBeGreaterThan(10);
    }
  });

  it("none of the 6 entries verify as active coverage automatically", () => {
    for (const entry of fixtures) {
      const result = discoverEntrySources(entry);
      expect(result.verifiedLead).toBeUndefined();
    }
  });

  it("report JSON is structurally valid", () => {
    const report = buildSourceDiscoveryReport(fixtures);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as SourceDiscoveryReport;
    expect(parsed.entriesScanned).toBe(6);
    expect(parsed.entries.length).toBe(6);
    expect(parsed.leadsFound).toBeGreaterThan(0);
    expect(parsed.generatedAt).toBeTruthy();
  });

  it("report has all required top-level fields", () => {
    const report = buildSourceDiscoveryReport(fixtures);
    const requiredFields = [
      "entriesScanned", "leadsFound", "officialLeadsFound",
      "nonOfficialLeadsIgnored", "leadsSentToVerifier",
      "verifierVerifiedCount", "verifierRejectedCount",
      "needsManualReviewCount", "entries", "generatedAt"
    ];
    for (const field of requiredFields) {
      expect(report).toHaveProperty(field);
    }
  });
});

// ─── Safety invariants ────────────────────────────────────────────────────────

describe("safety invariants", () => {
  it("no non-gov.tr domain appears in leads", () => {
    const entry = makeEntry({
      candidateOfficialUrlLead: "https://www.saglik.gov.tr/page"
    });
    const result = discoverEntrySources(entry);
    const nonGovTr = result.leads.filter(
      (l) => !l.domain.endsWith(".gov.tr")
    );
    expect(nonGovTr.length).toBe(0);
  });

  it("non-gov.tr URLs are captured in ignoredNonOfficialLeads", () => {
    const entry = makeEntry({
      candidateOfficialUrlLead: "https://www.example.com/fake"
    });
    const result = discoverEntrySources(entry);
    expect(result.ignoredNonOfficialLeads.length).toBe(1);
    expect(result.ignoredNonOfficialLeads[0].domain).toContain("example.com");
  });

  it("discovery does not set verifiedLead — verification is external", () => {
    const entry = makeEntry({
      candidateLegacySourceId: "mevzuat:7.5.12345",
      candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.12345.pdf"
    });
    const result = discoverEntrySources(entry);
    expect(result.verifiedLead).toBeUndefined();
  });
});
