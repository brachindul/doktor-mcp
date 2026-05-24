import { describe, it, expect, vi } from "vitest";
import {
  verifyDiscoveredOfficialLeads,
  buildSourceDiscoveryReport,
  discoverEntrySources,
  filterDiscoveryCandidates,
  type SourceDiscoveryReport,
  type LeadVerificationReport,
  type OfficialSourceLead
} from "../src/healthLegislationSourceDiscovery.js";
import type { LegislationSearchAdapter, HealthLegislationVerificationAttempt } from "../src/healthLegislationAccessVerifier.js";
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

function makeDocResult(overrides: { title?: string; text?: string } = {}) {
  return {
    title: overrides.title ?? "Test Yönetmeliği",
    text: overrides.text ?? "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\n\nSağlık meslek mensupları görev tanımları bu yönetmelikte belirtilmiştir.\n\nMadde 6 – Görev tanımları Ek-1 ve Ek-2'de düzenlenmiştir.",
    retrievedAt: "2026-05-24T00:00:00.000Z"
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

/**
 * Build a minimal SourceDiscoveryReport from entries.
 */
function buildReportFromEntries(entries: HealthLegislationInventoryEntry[]): SourceDiscoveryReport {
  return buildSourceDiscoveryReport(entries);
}

// ─── verifyDiscoveredOfficialLeads ────────────────────────────────────────────

describe("verifyDiscoveredOfficialLeads", () => {
  it("returns report with correct counts when no entries", async () => {
    const emptyReport: SourceDiscoveryReport = {
      entriesScanned: 0,
      leadsFound: 0,
      officialLeadsFound: 0,
      nonOfficialLeadsIgnored: 0,
      leadsSentToVerifier: 0,
      verifierVerifiedCount: 0,
      verifierRejectedCount: 0,
      needsManualReviewCount: 0,
      entries: [],
      generatedAt: new Date().toISOString()
    };
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };
    const report = await verifyDiscoveredOfficialLeads(emptyReport, [], adapter);
    expect(report.leadsAttempted).toBe(0);
    expect(report.leadsVerified).toBe(0);
    expect(report.leadsRejected).toBe(0);
    expect(report.needsManualReviewCount).toBe(0);
  });

  it("verified_via_source_id_direct when sourceId lead + title/marker match", async () => {
    const entry = makeEntry({
      key: "test-verified",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.12345",
      candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.12345.pdf",
      markerTerms: ["test", "yönetmelik", "sağlık"],
      searchTerms: ["test"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Test Yönetmeliği",
        text: "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\nSağlık test yönetmelik sağlık bakanlığı.\nGörev tanımları bu yönetmelikte düzenlenmiştir.\nMadde 2 – Bu yönetmelik tüm sağlık kurumlarını kapsar."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(1);
    expect(result.leadsAttempted).toBe(1);
    expect(result.leadsRejected).toBe(0);
    expect(result.promotedToActiveCoverageCount).toBe(1);
    expect(result.results[0].verificationStatus).toBe("verified");
    expect(result.results[0].verifierStatus).toBe("verified_via_source_id_direct");
  });

  it("rejected when sourceId lead + fetch fails", async () => {
    const entry = makeEntry({
      key: "test-fetch-fail",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.99999",
      candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.99999.pdf",
      markerTerms: ["test"],
      searchTerms: ["test"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue({
        status: "unavailable" as const,
        message: "Document not found."
      })
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(0);
    expect(result.leadsRejected).toBe(1);
    expect(result.results[0].verificationStatus).toBe("not_verified");
    expect(result.results[0].rejectReason).toBeTruthy();
  });

  it("rejected when sourceId lead + title mismatch", async () => {
    const entry = makeEntry({
      key: "test-title-mismatch",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.99999",
      markerTerms: ["test"],
      searchTerms: ["test"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Çevre ve Şehircilik Yönetmeliği",
        text: "ÇEVRE VE ŞEHİRCİLİK YÖNETMELİĞİ\n\nMadde 1 – Çevre düzenlemesi amacı.\n\nÇevre ve şehircilik hizmetleri."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(0);
    expect(result.leadsRejected).toBe(1);
    expect(result.results[0].verificationStatus).toBe("not_verified");
  });

  it("known wrong match sourceId is rejected", async () => {
    const entry = makeEntry({
      key: "test-known-wrong",
      title: "Makine ve Kimya Endüstrisi Kanunu",
      candidateLegacySourceId: "mevzuat:1.5.7191",
      markerTerms: ["makine"],
      searchTerms: ["makine"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsRejected).toBe(1);
    expect(result.results[0].verificationStatus).toBe("not_verified");
    expect(result.results[0].rejectReason).toContain("Known wrong match");
  });

  it("needs_manual_review when no sourceId or RG lead", async () => {
    const entry = makeEntry({
      key: "test-no-lead",
      title: "Bilinmeyen Yönetmelik",
      searchTerms: ["bilinmeyen"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(0);
    expect(result.leadsRejected).toBe(0);
    expect(result.needsManualReviewCount).toBe(1);
    expect(result.results[0].verificationStatus).toBe("needs_manual_review");
  });

  it("RG lead + search success + verify success produces verified", async () => {
    const entry = makeEntry({
      key: "test-rg-discovered",
      title: "Test Yönetmeliği",
      expectedRgDate: "2020-01-15",
      expectedRgNumber: "31000",
      markerTerms: ["test", "yönetmelik", "sağlık"],
      searchTerms: ["test"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([
        makeSearchResult({
          sourceId: "mevzuat:7.5.31000",
          title: "Test Yönetmeliği"
        })
      ]),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Test Yönetmeliği",
        text: "TEST YÖNETMELİĞİ\n\nMadde 1 – Bu yönetmelik test amaçlıdır.\nSağlık test yönetmelik sağlık bakanlığı.\nGörev tanımları bu yönetmelikte düzenlenmiştir.\nMadde 2 – Bu yönetmelik tüm sağlık kurumlarını kapsar."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(1);
    expect(result.results[0].leadKind).toBe("rg_search_discovery");
    expect(result.results[0].verificationStatus).toBe("verified");
  });

  it("RG lead + search returns no results → needs_manual_review", async () => {
    const entry = makeEntry({
      key: "test-rg-no-results",
      title: "Test Yönetmeliği",
      expectedRgDate: "2020-01-15",
      expectedRgNumber: "99999",
      searchTerms: ["test"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn().mockResolvedValue([]),
      fetchOfficialDocument: vi.fn()
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(0);
    expect(result.needsManualReviewCount).toBe(1);
    expect(result.results[0].verificationStatus).toBe("needs_manual_review");
    expect(result.results[0].rejectReason).toContain("99999");
  });

  it("multiple entries produce correct aggregated counts", async () => {
    const entries = [
      makeEntry({
        key: "verified-entry",
        title: "Verified Test",
        candidateLegacySourceId: "mevzuat:7.5.111",
        candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.111.pdf",
        markerTerms: ["test", "verified"],
        searchTerms: ["test"]
      }),
      makeEntry({
        key: "rejected-entry",
        title: "Rejected Test",
        candidateLegacySourceId: "mevzuat:7.5.222",
        markerTerms: ["wrong"],
        searchTerms: ["wrong"]
      }),
      makeEntry({
        key: "no-lead-entry",
        title: "No Lead",
        searchTerms: ["unknown"]
      })
    ];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockImplementation((sourceId: string) => {
        if (sourceId === "mevzuat:7.5.111") {
          return Promise.resolve(makeDocResult({
            title: "Verified Test",
            text: "VERIFIED TEST YÖNETMELİĞİ\n\nMadde 1 – Bu test verified amaçlıdır.\nTest verified yönetmelik sağlık hizmetleri kapsamında değerlendirilir.\nMadde 2 – Verified test yönetmelik görev tanımlarını düzenler."
          }));
        }
        return Promise.resolve({
          status: "unavailable" as const,
          message: "Not found."
        });
      })
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsAttempted).toBe(2);
    expect(result.leadsVerified).toBe(1);
    expect(result.leadsRejected).toBe(1);
    expect(result.needsManualReviewCount).toBe(1);
    expect(result.promotedToActiveCoverageCount).toBe(1);
  });

  it("report JSON is parseable", async () => {
    const entry = makeEntry({
      key: "test-json",
      title: "JSON Check",
      candidateLegacySourceId: "mevzuat:7.5.333",
      candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.333.pdf",
      markerTerms: ["json"],
      searchTerms: ["json"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "JSON Check",
        text: "JSON CHECK YÖNETMELİĞİ\n\nMadde 1 – JSON test amaçlıdır.\nJSON test yönetmelik sağlık kurumlarında uygulanır.\nMadde 2 – Bu yönetmelik yürürlükten kaldırılmıştır."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as LeadVerificationReport;
    expect(parsed.leadsVerified).toBe(1);
    expect(parsed.generatedAt).toBeTruthy();
    expect(parsed.results.length).toBe(1);
  });

  it("has generatedAt ISO timestamp", async () => {
    const entry = makeEntry({ key: "test", searchTerms: ["test"] });
    const entries = [entry];
    const report = buildReportFromEntries(entries);
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };
    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ─── Ozal Hastaneler fixture ──────────────────────────────────────────────────

describe("Özel Hastaneler fixture (ozel-hastaneler-yonetmeligi)", () => {
  const ozelHastanelerEntry: HealthLegislationInventoryEntry = {
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
    candidateLegacySourceId: "mevzuat:7.5.29092",
    candidateOfficialUrlLead: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.29092.pdf",
    aliases: [
      "Özel Hastaneler Hakkında Yönetmelik",
      "Özel Hastane Yönetmeliği",
      "Özel Hastaneler Yönetmeliği Hakkında"
    ],
    markerTerms: [
      "özel hastane",
      "ruhsat",
      "mesul müdür",
      "sağlık kuruluşu",
      "özel hastaneler"
    ],
    knownWrongMatches: [
      "mevzuat:1.5.7191",
      "mevzuat:1.5.6001",
      "mevzuat:7.5.29134"
    ],
    notes: ["Fixture for ozel-hastaneler"]
  };

  it("correct PDF fixture verifies successfully", async () => {
    const entries = [ozelHastanelerEntry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Özel Hastaneler Yönetmeliği",
        text: "ÖZEL HASTANELER YÖNETMELİĞİ\n\nMadde 1 – Bu Yönetmeliğin amacı, özel hastanelerin ruhsatlandırılması, işletilmesi ve denetlenmesine ilişkin usul ve esasları düzenlemektir. Madde 2 – Bu Yönetmelik, özel hastaneler ile mesul müdürlerin görev, yetki ve sorumluluklarını kapsar. Madde 3 – Sağlık kuruluşu ruhsatı alınmadan faaliyet gösterilemez."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(1);
    expect(result.promotedToActiveCoverageCount).toBe(1);
    const verifiedResult = result.results[0];
    expect(verifiedResult.verificationStatus).toBe("verified");
    expect(verifiedResult.sourceId).toBe("mevzuat:7.5.29092");
    expect(verifiedResult.titleScore).toBeGreaterThanOrEqual(0.50);
    expect(verifiedResult.markerScore).toBeGreaterThanOrEqual(0.30);
  });

  it("kanun-type fixture (wrong document) is rejected", async () => {
    const entries = [ozelHastanelerEntry];
    const report = buildReportFromEntries(entries);

    // A kanun about kamu-özel iş birliği, not özel hastaneler yönetmelik
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "SAĞLIK BAKANLIĞINCA KAMU ÖZEL İŞ BİRLİĞİ MODELİ İLE TESİS YAPTIRILMASI HAKKINDA KANUN",
        text: "SAĞLIK BAKANLIĞINCA KAMU ÖZEL İŞ BİRLİĞİ MODELİ İLE TESİS YAPTIRILMASI HAKKINDA KANUN\n\nMadde 1 – Bu Kanunun amacı, Sağlık Bakanlığınca kamu özel iş birliği modeli ile tesis yaptırılmasına ilişkindir."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(0);
    expect(result.leadsRejected).toBe(1);
    expect(result.results[0].verificationStatus).toBe("not_verified");
  });
});

// ─── Safety invariants ────────────────────────────────────────────────────────

describe("safety invariants", () => {
  it("non-gov.tr lead produces needs_manual_review, never verified", async () => {
    // An entry where lead is from a non-gov domain (simulated via discovery)
    const entry = makeEntry({
      key: "non-gov-lead",
      title: "Non Gov Test",
      candidateLegacySourceId: "mevzuat:7.5.111",
      searchTerms: ["test"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue({
        status: "unavailable" as const,
        message: "Not available"
      })
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(0);
  });

  it("knownWrongMatch prevents verification even if title matches", async () => {
    // SourceId is KVKK which is a known wrong match
    const entry = makeEntry({
      key: "kvkk-lead",
      title: "Kişisel Verilerin Korunması Kanunu",
      candidateLegacySourceId: "mevzuat:1.5.6698",
      searchTerms: ["kişisel veri"]
    });
    const entries = [entry];
    const report = buildReportFromEntries(entries);

    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn()
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsRejected).toBe(1);
    expect(result.results[0].rejectReason).toContain("Known wrong match");
  });

  it("verification does not modify the original entry", async () => {
    const entry = makeEntry({
      key: "test-no-modify",
      title: "Test Yönetmeliği",
      candidateLegacySourceId: "mevzuat:7.5.12345",
      markerTerms: ["test"],
      searchTerms: ["test"]
    });
    const originalStatus = entry.officialSourceStatus;
    const entries = [entry];

    const report = buildReportFromEntries(entries);
    const adapter: LegislationSearchAdapter = {
      searchOfficialLegislation: vi.fn(),
      fetchOfficialDocument: vi.fn().mockResolvedValue(makeDocResult({
        title: "Test Yönetmeliği",
        text: "TEST YÖNETMELİĞİ\n\nMadde 1 – Test amaçlıdır.\nTest yönetmelik test test. Sağlık hizmetleri bu yönetmeliğe tabidir.\nMadde 2 – Yönetmelik kapsamındaki kurumlar test edilir."
      }))
    };

    const result = await verifyDiscoveredOfficialLeads(report, entries, adapter);
    expect(result.leadsVerified).toBe(1);
    expect(entry.officialSourceStatus).toBe(originalStatus);
  });
});
