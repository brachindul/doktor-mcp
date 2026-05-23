/**
 * tests/officialLegislationCoverage.test.ts
 *
 * v0.22.0 — Official Health Legislation Coverage
 *
 * Verifies that:
 * 1. All registered legislation entries reference gov.tr source domains.
 * 2. Required health legislation is present in the registry.
 * 3. New topic clusters are registered.
 * 4. Mock provisions exist for each registered legislation title.
 * 5. Contract check still catches non-gov.tr legislation sourceTrace URLs.
 */

import { describe, it, expect } from "vitest";
import { healthLegislationHints } from "../src/sources/legislation/healthMappings.js";
import { mockLegislationProvisions } from "../src/sources/mockData.js";
import { auditPack } from "../src/packAudit.js";
import type { DoctorLegalInformationPack } from "../src/contracts/legal.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeMinimalPack(overrides: Partial<DoctorLegalInformationPack> = {}): DoctorLegalInformationPack {
  return {
    shortAnswer: "Hekim yükümlülüğü değerlendirmesi.",
    legalClassification: {
      criminal: [],
      civilCompensation: ["Tazminat sorumluluğu"],
      disciplinaryAdministrative: [],
      patientRights: [],
      privacyKvkk: [],
      professionalEthics: ["Mesleki etik"]
    },
    relevantLegislation: [],
    verifiedHighCourtPrecedents: [],
    missingInformation: ["Hastanın onam belgesi"],
    lawyerReviewPoints: ["Avukat incelemesi gereklidir."],
    sourceWarnings: [],
    ...overrides
  };
}

// ─── 1. sourceId format ────────────────────────────────────────────────────────

describe("healthLegislationHints — sourceId format", () => {
  it("every sourceId starts with 'mevzuat:'", () => {
    for (const hint of healthLegislationHints) {
      expect(hint.sourceId).toMatch(/^mevzuat:/);
    }
  });

  it("every sourceId follows mevzuat:{type}.{arrangement}.{number}", () => {
    const pattern = /^mevzuat:\d+\.\d+\.\d+$/;
    for (const hint of healthLegislationHints) {
      expect(hint.sourceId, `sourceId: ${hint.sourceId}`).toMatch(pattern);
    }
  });
});

// ─── 2. Required legislation present ─────────────────────────────────────────

const REQUIRED_LEGISLATION_TITLES = [
  "Hasta Haklari Yonetmeligi",
  "Tibbi Deontoloji Nizamnamesi",
  "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun",
  "Saglik Hizmetleri Temel Kanunu",
  "Kisisel Verilerin Korunmasi Kanunu"
];

describe("healthLegislationHints — required legislation", () => {
  const registeredTitles = new Set(healthLegislationHints.map((h) => h.title));

  for (const title of REQUIRED_LEGISLATION_TITLES) {
    it(`registry contains: ${title}`, () => {
      expect(registeredTitles.has(title)).toBe(true);
    });
  }
});

// ─── 3. New topic clusters registered ─────────────────────────────────────────

describe("healthLegislationHints — new topic clusters (v0.22.0)", () => {
  const registeredClusters = new Set(healthLegislationHints.map((h) => h.topicCluster));

  it("registers 'private_health_facility' cluster", () => {
    expect(registeredClusters.has("private_health_facility")).toBe(true);
  });

  it("registers 'professional_scope_of_practice' cluster", () => {
    expect(registeredClusters.has("professional_scope_of_practice")).toBe(true);
  });

  it("private_health_facility cluster uses gov.tr-sourced legislation only", () => {
    const facilityHints = healthLegislationHints.filter((h) => h.topicCluster === "private_health_facility");
    expect(facilityHints.length).toBeGreaterThan(0);
    for (const hint of facilityHints) {
      // Must be health_primary or supporting_general — never unofficial
      expect(["health_primary", "supporting_general"]).toContain(hint.legislationRole);
      // sourceId must be a gov.tr-backed mevzuat entry
      expect(hint.sourceId).toMatch(/^mevzuat:\d+\.\d+\.\d+$/);
    }
  });

  it("professional_scope_of_practice cluster uses gov.tr-sourced legislation only", () => {
    const scopeHints = healthLegislationHints.filter((h) => h.topicCluster === "professional_scope_of_practice");
    expect(scopeHints.length).toBeGreaterThan(0);
    for (const hint of scopeHints) {
      expect(hint.sourceId).toMatch(/^mevzuat:\d+\.\d+\.\d+$/);
    }
  });
});

// ─── 4. Mock provisions ────────────────────────────────────────────────────────

describe("mockLegislationProvisions — new article coverage (v0.22.0)", () => {
  const mockLegislationNames = new Set(mockLegislationProvisions.map((p) => p.legislationName));
  const mockByDoc = new Map(mockLegislationProvisions.map((p) => [p.documentId, p]));

  it("has a provision for Tababet Kanunu Art.25 (professional scope)", () => {
    const provision = mockByDoc.get("leg-tababet-25");
    expect(provision).toBeDefined();
    expect(provision?.articleNumber).toBe("25");
    expect(provision?.legislationName).toBe("Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun");
  });

  it("Tababet Art.25 dimensions include professional_ethics", () => {
    const provision = mockByDoc.get("leg-tababet-25");
    expect(provision?.dimensions).toContain("professional_ethics");
  });

  it("has a provision for Saglik Hizmetleri Art.9 (private facility oversight)", () => {
    const provision = mockByDoc.get("leg-healthservices-9");
    expect(provision).toBeDefined();
    expect(provision?.articleNumber).toBe("9");
    expect(provision?.legislationName).toBe("Saglik Hizmetleri Temel Kanunu");
  });

  it("Saglik Hizmetleri Art.9 dimensions include disciplinary_administrative", () => {
    const provision = mockByDoc.get("leg-healthservices-9");
    expect(provision?.dimensions).toContain("disciplinary_administrative");
  });

  it("every mock provision has non-empty verbatimText", () => {
    for (const provision of mockLegislationProvisions) {
      expect(provision.verbatimText.trim().length, `${provision.documentId} verbatimText empty`).toBeGreaterThan(0);
    }
  });

  it("every mock provision has non-empty connection", () => {
    for (const provision of mockLegislationProvisions) {
      expect(provision.connection.trim().length, `${provision.documentId} connection empty`).toBeGreaterThan(0);
    }
  });

  it("every required legislation title has at least one mock provision", () => {
    for (const title of REQUIRED_LEGISLATION_TITLES) {
      expect(mockLegislationNames.has(title), `missing mock provision for: ${title}`).toBe(true);
    }
  });
});

// ─── Helpers for LegislationSourceTrace construction ─────────────────────────

function makeSourceTrace(landingUrl: string | null, generatedPdfUrl: string | null = null) {
  return {
    query: "test query",
    matchedHealthMapping: null,
    officialSearchRequest: null,
    officialSearchResultsCount: null,
    selectedSearchResult: null,
    selectedResultReason: null,
    landingUrl,
    detailUrl: null,
    fullTextUrl: null,
    directPdfUrl: null,
    generatedPdfUrl,
    contentType: null,
    extractionMethod: null,
    extractedArticleNumbers: [],
    retrievedAt: "2026-05-23T00:00:00.000Z"
  };
}

// ─── 5. Contract check still catches unofficial legislation sourceTrace ────────

describe("contractCheck — unofficial source detection still enforced (v0.22.0)", () => {
  it("flags legislation sourceTrace with non-gov.tr landingUrl", () => {
    const pack = makeMinimalPack({
      relevantLegislation: [
        {
          legislationName: "Hasta Haklari Yonetmeligi",
          articleNumber: "24",
          verbatimQuote: "Tibbi mudahalelerde hastanin rizasi gerekir.",
          connection: "Aydinlatilmis onam.",
          sourceDocumentId: "leg-hasta-24",
          sourceTrace: makeSourceTrace("https://unofficial-health-law.net/hasta-haklari")
        }
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.passed).toBe(false);
    expect(result.contractCheck.unofficialSourceDetected).toBe(true);
  });

  it("accepts legislation sourceTrace with mevzuat.gov.tr landingUrl", () => {
    const pack = makeMinimalPack({
      relevantLegislation: [
        {
          legislationName: "Hasta Haklari Yonetmeligi",
          articleNumber: "24",
          verbatimQuote: "Tibbi mudahalelerde hastanin rizasi gerekir.",
          connection: "Aydinlatilmis onam.",
          sourceDocumentId: "leg-hasta-24",
          sourceTrace: makeSourceTrace(
            "https://www.mevzuat.gov.tr/MevzuatMetin/7.5.4847.pdf",
            "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=4847&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5"
          )
        }
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(false);
  });

  it("new professional_scope_of_practice terms do not trigger unsafe-advice detection", () => {
    // Ensure hint terms like 'uzmanlik siniri' are not in the forbidden phrase list
    const pack = makeMinimalPack({
      shortAnswer: "Hekimin uzmanlık sınırı dışında işlem yapması mesleki sorumluluk doğurur.",
      relevantLegislation: [
        {
          legislationName: "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun",
          articleNumber: "25",
          verbatimQuote: "Tabip ve dis tabibi uzmanliklari disinda kalan muameleleri yapamazlar.",
          connection: "Mesleki kapsam sınırı.",
          sourceDocumentId: "leg-tababet-25",
          sourceTrace: makeSourceTrace("https://www.mevzuat.gov.tr/MevzuatMetin/1.3.1219.pdf")
        }
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(false);
  });
});

// ─── 6. Total hint count sanity ────────────────────────────────────────────────

describe("healthLegislationHints — total count sanity", () => {
  it("has at least 24 hint entries after v0.22.0 expansion", () => {
    // Was 20 before; new clusters add 4 more entries
    expect(healthLegislationHints.length).toBeGreaterThanOrEqual(24);
  });

  it("has no duplicate sourceId+topicCluster combinations", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const hint of healthLegislationHints) {
      const key = `${hint.sourceId}::${hint.topicCluster}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("all hints have non-empty terms array", () => {
    for (const hint of healthLegislationHints) {
      expect(hint.terms.length, `hint for ${hint.topicCluster} has empty terms`).toBeGreaterThan(0);
    }
  });

  it("all hints have non-empty articleNumbers array", () => {
    for (const hint of healthLegislationHints) {
      expect(hint.articleNumbers.length, `hint for ${hint.topicCluster} has empty articleNumbers`).toBeGreaterThan(0);
    }
  });
});
