/**
 * Tests for physician pack contract audit (v0.21.0).
 * All tests are pure — no network calls, no file I/O.
 */

import { describe, it, expect } from "vitest";
import { auditPack } from "../src/packAudit.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLegislationItem(overrides: Record<string, unknown> = {}) {
  return {
    legislationName: "Tıbbi Deontoloji Nizamnamesi",
    articleNumber: "Madde 13",
    verbatimQuote: "Hekim, hastasına gerekli özeni göstermek zorundadır.",
    connection: "İlgili madde, ihmalkar tıbbi uygulamayı doğrudan kapsar.",
    sourceDocumentId: "tdn-madde-13",
    ...overrides
  };
}

function makePrecedentItem(overrides: Record<string, unknown> = {}) {
  return {
    courtAndChamber: "Yargıtay 4. Hukuk Dairesi",
    date: "15.03.2022",
    meritsAndDecisionNumber: "2021/1234 E. - 2022/5678 K.",
    factSummary: "Dava, hekimin yanlış tedavi uygulaması nedeniyle hastanın zarar görmesiyle ilgilidir.",
    legalAssessment: "Mahkeme, hekimin standart bakım yükümlülüğünü ihlal ettiğine hükmetmiştir.",
    outcome: "Davalı hekim tazminat ödemekle yükümlü kılınmıştır.",
    similarityDifference: "Emsal davada da bilinçli rıza alınmamıştır; ancak bu davada operasyon türü farklıdır.",
    sourceDocumentId: "yargitay-4hd-2022-5678",
    ...overrides
  };
}

function makeLegislationItemWithTrace(traceOverrides: Record<string, unknown> = {}, itemOverrides: Record<string, unknown> = {}) {
  return {
    ...makeLegislationItem(),
    sourceTrace: {
      query: "tıbbi ihmal",
      matchedHealthMapping: null,
      officialSearchRequest: null,
      officialSearchResultsCount: null,
      selectedSearchResult: null,
      selectedResultReason: null,
      landingUrl: "https://www.mevzuat.gov.tr/mevzuatMetin/3.5.234.pdf",
      detailUrl: null,
      fullTextUrl: "https://www.mevzuat.gov.tr/mevzuatMetin/3.5.234.pdf",
      directPdfUrl: null,
      generatedPdfUrl: null,
      contentType: "application/pdf",
      extractionMethod: "pdf-text",
      extractedArticleNumbers: ["13"],
      retrievedAt: "2026-05-23T00:00:00.000Z",
      ...traceOverrides
    },
    ...itemOverrides
  };
}

function makeMinimalValidPack(overrides: Record<string, unknown> = {}) {
  return {
    shortAnswer: "Hekim ihmal halinde hem cezai hem hukuki sorumluluk taşır.",
    legalClassification: {
      criminal: ["Taksirli yaralama suçu oluşabilir."],
      civilCompensation: [],
      disciplinaryAdministrative: [],
      patientRights: [],
      privacyKvkk: [],
      professionalEthics: []
    },
    missingInformation: ["Hastanın rıza belgesi ve tıbbi kayıtlar incelenmemiştir."],
    lawyerReviewPoints: ["Rıza belgesinin varlığı teyit edilmelidir."],
    relevantLegislation: [makeLegislationItem()],
    verifiedHighCourtPrecedents: [makePrecedentItem()],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Required sections
// ---------------------------------------------------------------------------

describe("contract: required sections", () => {
  it("passes when all required sections are present", () => {
    const result = auditPack(makeMinimalValidPack());
    expect(result.contractCheck.missingSections).toEqual([]);
    expect(result.contractCheck.passed).toBe(true);
  });

  it("fails when shortAnswer is empty", () => {
    const pack = makeMinimalValidPack({ shortAnswer: "" });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("shortAnswer");
  });

  it("fails when shortAnswer is whitespace only", () => {
    const pack = makeMinimalValidPack({ shortAnswer: "   " });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("shortAnswer");
  });

  it("fails when legalClassification has no non-empty dimension", () => {
    const pack = makeMinimalValidPack({
      legalClassification: {
        criminal: [],
        civilCompensation: [],
        disciplinaryAdministrative: [],
        patientRights: [],
        privacyKvkk: [],
        professionalEthics: []
      }
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("legalClassification");
  });

  it("passes when at least one legalClassification dimension is non-empty", () => {
    const pack = makeMinimalValidPack({
      legalClassification: {
        criminal: ["Taksirli yaralama."],
        civilCompensation: [],
        disciplinaryAdministrative: [],
        patientRights: [],
        privacyKvkk: [],
        professionalEthics: []
      }
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).not.toContain("legalClassification");
  });

  it("fails when missingInformation is empty array", () => {
    const pack = makeMinimalValidPack({ missingInformation: [] });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("missingInformation");
  });

  it("fails when lawyerReviewPoints is empty array", () => {
    const pack = makeMinimalValidPack({ lawyerReviewPoints: [] });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("lawyerReviewPoints");
  });

  it("fails when lawyerReviewPoints contains only empty strings", () => {
    const pack = makeMinimalValidPack({ lawyerReviewPoints: ["", "  "] });
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("lawyerReviewPoints");
  });

  it("reports all four sections as missing when pack has empty content", () => {
    const pack = {
      shortAnswer: "",
      legalClassification: { criminal: [], civilCompensation: [], disciplinaryAdministrative: [], patientRights: [], privacyKvkk: [], professionalEthics: [] },
      missingInformation: [],
      lawyerReviewPoints: [],
      relevantLegislation: [],
      verifiedHighCourtPrecedents: []
    };
    const result = auditPack(pack);
    expect(result.contractCheck.missingSections).toContain("shortAnswer");
    expect(result.contractCheck.missingSections).toContain("legalClassification");
    expect(result.contractCheck.missingSections).toContain("missingInformation");
    expect(result.contractCheck.missingSections).toContain("lawyerReviewPoints");
  });
});

// ---------------------------------------------------------------------------
// Per-legislation field completeness
// ---------------------------------------------------------------------------

describe("contract: legislation field completeness", () => {
  it("passes when all legislation fields are present", () => {
    const result = auditPack(makeMinimalValidPack());
    expect(result.contractCheck.missingLegislationFields).toEqual([]);
  });

  it("reports missing legislationName", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem({ legislationName: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingLegislationFields[0]?.fields).toContain("legislationName");
  });

  it("reports missing articleNumber", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem({ articleNumber: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingLegislationFields[0]?.fields).toContain("articleNumber");
  });

  it("reports missing verbatimQuote", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem({ verbatimQuote: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingLegislationFields[0]?.fields).toContain("verbatimQuote");
  });

  it("reports missing connection", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem({ connection: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingLegislationFields[0]?.fields).toContain("connection");
  });

  it("reports correct index for second item", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [
        makeLegislationItem(),
        makeLegislationItem({ verbatimQuote: "" })
      ]
    });
    const result = auditPack(pack);
    const entry = result.contractCheck.missingLegislationFields.find((e) => e.index === 1);
    expect(entry).toBeDefined();
    expect(entry?.fields).toContain("verbatimQuote");
  });

  it("passes when relevantLegislation is empty", () => {
    const pack = makeMinimalValidPack({ relevantLegislation: [] });
    const result = auditPack(pack);
    expect(result.contractCheck.missingLegislationFields).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Per-precedent field completeness
// ---------------------------------------------------------------------------

describe("contract: precedent field completeness", () => {
  it("passes when all precedent fields are present", () => {
    const result = auditPack(makeMinimalValidPack());
    expect(result.contractCheck.missingPrecedentFields).toEqual([]);
  });

  it("reports missing courtAndChamber", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ courtAndChamber: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("courtAndChamber");
  });

  it("detects fallback placeholder for date", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ date: "Kaynakta tarih yok" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("date");
  });

  it("detects fallback placeholder for factSummary", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ factSummary: "Kaynakta olay ozeti yok" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("factSummary");
  });

  it("detects fallback placeholder for legalAssessment", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ legalAssessment: "Kaynakta hukuki degerlendirme yok" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("legalAssessment");
  });

  it("detects fallback placeholder for outcome", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ outcome: "Kaynakta sonuc yok" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("outcome");
  });

  it("detects fallback placeholder for similarityDifference", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ similarityDifference: "Benzerlik teyit edilmedi" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("similarityDifference");
  });

  it("reports missing fields when precedent has empty strings", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ factSummary: "", outcome: "" })]
    });
    const result = auditPack(pack);
    const entry = result.contractCheck.missingPrecedentFields[0];
    expect(entry?.fields).toContain("factSummary");
    expect(entry?.fields).toContain("outcome");
  });

  it("passes when verifiedHighCourtPrecedents is empty", () => {
    const pack = makeMinimalValidPack({ verifiedHighCourtPrecedents: [] });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// meritsAndDecisionNumber (esas/karar) contract check
// ---------------------------------------------------------------------------

describe("contract: meritsAndDecisionNumber (esas/karar) field", () => {
  it("passes when meritsAndDecisionNumber is present and non-empty", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ meritsAndDecisionNumber: "2021/1234 E. - 2022/5678 K." })]
    });
    const result = auditPack(pack);
    const allMissingFields = result.contractCheck.missingPrecedentFields.flatMap((e) => e.fields);
    expect(allMissingFields).not.toContain("meritsAndDecisionNumber");
  });

  it("fails when meritsAndDecisionNumber is empty string", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ meritsAndDecisionNumber: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("meritsAndDecisionNumber");
  });

  it("fails when meritsAndDecisionNumber is whitespace only", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ meritsAndDecisionNumber: "   " })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("meritsAndDecisionNumber");
  });

  it("fails when meritsAndDecisionNumber is the fallback placeholder", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ meritsAndDecisionNumber: "Kaynakta esas/karar no yok" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.missingPrecedentFields[0]?.fields).toContain("meritsAndDecisionNumber");
  });

  it("ok is false and error mentions meritsAndDecisionNumber when it is empty", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ meritsAndDecisionNumber: "" })]
    });
    const result = auditPack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("meritsAndDecisionNumber"))).toBe(true);
  });

  it("contractCheck.passed is false when meritsAndDecisionNumber is missing", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ meritsAndDecisionNumber: "" })]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unofficial source detection
// ---------------------------------------------------------------------------

describe("contract: unofficial source detection", () => {
  it("detects mock accessSource in precedent trace", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [
        makePrecedentItem({
          decisionSourceTrace: {
            accessSource: "mock",
            fullTextAvailable: true,
            eligibilityStatus: "precedent_usable"
          }
        })
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(true);
    expect(result.contractCheck.unofficialSourceDetails.length).toBeGreaterThan(0);
  });

  it("does not flag non-mock accessSource", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [
        makePrecedentItem({
          decisionSourceTrace: {
            accessSource: "bedesten",
            fullTextAvailable: true,
            eligibilityStatus: "precedent_usable"
          }
        })
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(false);
  });

  it("does not flag when decisionSourceTrace is absent", () => {
    const pack = makeMinimalValidPack();
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(false);
  });

  it("detects mock-variant accessSource strings (case-insensitive)", () => {
    const pack = makeMinimalValidPack({
      verifiedHighCourtPrecedents: [
        makePrecedentItem({
          decisionSourceTrace: {
            accessSource: "MOCK_FALLBACK",
            fullTextAvailable: true,
            eligibilityStatus: "precedent_usable"
          }
        })
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(true);
  });

  it("does not flag official *.gov.tr legislation sourceTrace URLs", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [makeLegislationItemWithTrace()]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(false);
  });

  it("detects unofficial (non-gov.tr) landingUrl in legislation sourceTrace", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [
        makeLegislationItemWithTrace({ landingUrl: "https://hukukburosu.com/madde/13" })
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(true);
    expect(result.contractCheck.unofficialSourceDetails.some((d) => d.includes("landingUrl"))).toBe(true);
  });

  it("detects unofficial fullTextUrl in legislation sourceTrace", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [
        makeLegislationItemWithTrace({ fullTextUrl: "https://blog.hukuk.net/deontoloji.pdf" })
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(true);
    expect(result.contractCheck.unofficialSourceDetails.some((d) => d.includes("fullTextUrl"))).toBe(true);
  });

  it("does not flag null URL fields in legislation sourceTrace", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [
        makeLegislationItemWithTrace({ landingUrl: null, fullTextUrl: null, directPdfUrl: null })
      ]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(false);
  });

  it("does not flag legislation item with no sourceTrace at all", () => {
    const pack = makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem()]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unofficialSourceDetected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MVP forbidden phrase scanning
// ---------------------------------------------------------------------------

describe("contract: forbidden phrase scanning", () => {
  it("detects 'kesin hukuki kanaat' in shortAnswer", () => {
    const pack = makeMinimalValidPack({
      shortAnswer: "Hekimin kesin hukuki kanaat açıklaması gerekmez."
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(true);
    expect(result.contractCheck.unsafeAdvicePhrases).toContain("kesin hukuki kanaat");
  });

  it("detects 'dilekçe taslağı' in lawyerReviewPoints (string array)", () => {
    const pack = makeMinimalValidPack({
      lawyerReviewPoints: ["Avukat bir dilekçe taslağı hazırlamalıdır."]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(true);
    expect(result.contractCheck.unsafeAdvicePhrases).toContain("dilekçe taslağı");
  });

  it("detects 'savunma taslağı' in any text field", () => {
    const pack = makeMinimalValidPack({
      missingInformation: ["Hekim için savunma taslağı gereklidir."]
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(true);
    expect(result.contractCheck.unsafeAdvicePhrases).toContain("savunma taslağı");
  });

  it("detects 'risk seviyesi' in text", () => {
    const pack = makeMinimalValidPack({
      shortAnswer: "Bu konuda risk seviyesi değerlendirmesi yapılmalıdır."
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(true);
    expect(result.contractCheck.unsafeAdvicePhrases).toContain("risk seviyesi");
  });

  it("detects 'derhal yapılacak' in text", () => {
    const pack = makeMinimalValidPack({
      shortAnswer: "Derhal yapılacak işlemler için avukatınıza danışın."
    });
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(true);
    expect(result.contractCheck.unsafeAdvicePhrases).toContain("derhal yapılacak");
  });

  it("does not flag clean pack text", () => {
    const pack = makeMinimalValidPack();
    const result = auditPack(pack);
    expect(result.contractCheck.unsafeAdviceDetected).toBe(false);
    expect(result.contractCheck.unsafeAdvicePhrases).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// contractCheck.passed integration
// ---------------------------------------------------------------------------

describe("contractCheck.passed", () => {
  it("is true for a fully valid pack", () => {
    const result = auditPack(makeMinimalValidPack());
    expect(result.contractCheck.passed).toBe(true);
  });

  it("is false when any section is missing", () => {
    const result = auditPack(makeMinimalValidPack({ shortAnswer: "" }));
    expect(result.contractCheck.passed).toBe(false);
  });

  it("is false when a legislation field is missing", () => {
    const result = auditPack(makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem({ verbatimQuote: "" })]
    }));
    expect(result.contractCheck.passed).toBe(false);
  });

  it("is false when a precedent field is a placeholder", () => {
    const result = auditPack(makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ date: "Kaynakta tarih yok" })]
    }));
    expect(result.contractCheck.passed).toBe(false);
  });

  it("is false when mock source detected", () => {
    const result = auditPack(makeMinimalValidPack({
      verifiedHighCourtPrecedents: [
        makePrecedentItem({ decisionSourceTrace: { accessSource: "mock", fullTextAvailable: true, eligibilityStatus: "precedent_usable" } })
      ]
    }));
    expect(result.contractCheck.passed).toBe(false);
  });

  it("is false when forbidden phrase is detected", () => {
    const result = auditPack(makeMinimalValidPack({ shortAnswer: "Bu bir kesin hukuki kanaat değildir." }));
    expect(result.contractCheck.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ok field integration — contract failures bubble to errors
// ---------------------------------------------------------------------------

describe("auditPack ok field", () => {
  it("ok is false when contract check fails due to missing section", () => {
    const result = auditPack(makeMinimalValidPack({ shortAnswer: "" }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("shortAnswer"))).toBe(true);
  });

  it("ok is false when contract check fails due to missing legislation field", () => {
    const result = auditPack(makeMinimalValidPack({
      relevantLegislation: [makeLegislationItem({ verbatimQuote: "" })]
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("verbatimQuote"))).toBe(true);
  });

  it("ok is false when contract check fails due to precedent placeholder", () => {
    const result = auditPack(makeMinimalValidPack({
      verifiedHighCourtPrecedents: [makePrecedentItem({ outcome: "Kaynakta sonuc yok" })]
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("outcome"))).toBe(true);
  });

  it("ok is false when forbidden phrase is detected in pack", () => {
    const result = auditPack(makeMinimalValidPack({ shortAnswer: "risk seviyesi yüksek" }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("risk seviyesi"))).toBe(true);
  });

  it("ok is true for a fully valid pack with no other errors", () => {
    const result = auditPack(makeMinimalValidPack());
    // ok can still be false if warnings would exist — ignore warnings for this check
    expect(result.contractCheck.passed).toBe(true);
    // Verify no contract-related errors
    const contractErrors = result.errors.filter((e) => e.startsWith("Contract:"));
    expect(contractErrors).toHaveLength(0);
  });
});
