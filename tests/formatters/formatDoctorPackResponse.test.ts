import { describe, it, expect } from "vitest";
import { formatDoctorPackResponse, formatNoPackDiagnosticResponse, detectForbiddenOutputPhrases } from "../../src/mcp/formatDoctorPackResponse.js";
import type { DoctorLegalInformationPack } from "../../src/contracts/legal.js";

function makeFullPack(overrides: Partial<DoctorLegalInformationPack> = {}): DoctorLegalInformationPack {
  return {
    shortAnswer: "Bu soru resmi kaynak kayıtlarıyla eşleştirildi.",
    legalClassification: {
      criminal: [],
      civilCompensation: ["Tazminat boyutu incelenebilir."],
      disciplinaryAdministrative: [],
      patientRights: ["Hasta hakları boyutu eşleşti."],
      privacyKvkk: [],
      professionalEthics: []
    },
    relevantLegislation: [
      {
        legislationName: "Hasta Hakları Yönetmeliği",
        articleNumber: "24",
        verbatimQuote: "Tıbbi müdahalelerde hastanın rızası gerekir.",
        connection: "Aydınlatma ve rıza sorularında resmi madde metni.",
        sourceDocumentId: "mevzuat:7.5.4847"
      }
    ],
    verifiedHighCourtPrecedents: [
      {
        courtAndChamber: "YARGİTAY / 13. Hukuk Dairesi",
        date: "2024-01-01",
        meritsAndDecisionNumber: "2023/1 - 2024/2",
        factSummary: "Sağlık hukuku olayı.",
        legalAssessment: "Gerekçeli karar.",
        outcome: "Sonuç.",
        similarityDifference: "Benzer olay.",
        sourceDocumentId: "yargitay:1"
      }
    ],
    missingInformation: ["Müdahale tarihi"],
    lawyerReviewPoints: ["Avukatın kontrolü gerekir."],
    sourceWarnings: ["Canlı kaynaktan doğrulandı."],
    ...overrides
  };
}

describe("formatDoctorPackResponse", () => {
  it("formats full pack with responseVersion", () => {
    const pack = makeFullPack();
    const response = formatDoctorPackResponse(pack);
    expect(response.responseVersion).toBe("doctor-pack-response/v1");
    expect(response.ok).toBe(true);
    expect(response.status).toBe("full_pack");
    expect(response.pack).toBe(pack);
  });

  it("derives sufficient when both legislation and precedents present", () => {
    const pack = makeFullPack();
    const response = formatDoctorPackResponse(pack);
    expect(response.summary.sourceSufficiency).toBe("sufficient");
    expect(response.summary.verifiedLegislationCount).toBe(1);
    expect(response.summary.verifiedPrecedentCount).toBe(1);
  });

  it("derives partial_pack status when sourceWarnings indicate partial pack", () => {
    const pack = makeFullPack({ sourceWarnings: ["Partial pack generated from intermediate state after timeout."] });
    const response = formatDoctorPackResponse(pack);
    expect(response.status).toBe("partial_pack");
    // sourceSufficiency is still derived from content (legislation + precedents)
    expect(response.summary.sourceSufficiency).toBe("sufficient");
  });

  it("derives insufficient when no legislation and no precedents", () => {
    const pack = makeFullPack({ relevantLegislation: [], verifiedHighCourtPrecedents: [] });
    const response = formatDoctorPackResponse(pack);
    expect(response.summary.sourceSufficiency).toBe("insufficient");
    expect(response.status).toBe("no_pack_diagnostic");
  });

  it("includes diagnostics when coverage gaps present", () => {
    const pack = makeFullPack();
    const response = formatDoctorPackResponse(pack, {
      coverageGaps: ["Özel hastaneler yönetmeliği gap"],
      retrievalTimeouts: []
    });
    expect(response.diagnostics).toBeDefined();
    expect(response.diagnostics!.coverageGaps).toHaveLength(1);
    expect(response.summary.coverageGapCount).toBe(1);
  });

  it("omits diagnostics for full_pack with no gaps", () => {
    const pack = makeFullPack();
    const response = formatDoctorPackResponse(pack);
    expect(response.diagnostics).toBeUndefined();
  });
});

describe("formatNoPackDiagnosticResponse", () => {
  it("formats no-pack with ok: false", () => {
    const response = formatNoPackDiagnosticResponse({
      noPackReason: "Question timed out after 30000ms"
    });
    expect(response.responseVersion).toBe("doctor-pack-response/v1");
    expect(response.ok).toBe(false);
    expect(response.status).toBe("no_pack_diagnostic");
    expect(response.pack).toBeUndefined();
    expect(response.summary.sourceSufficiency).toBe("insufficient");
    expect(response.diagnostics!.noPackReason).toContain("timed out");
  });

  it("includes coverage gaps in diagnostics", () => {
    const response = formatNoPackDiagnosticResponse({
      noPackReason: "Source unavailable",
      coverageGaps: ["gap1", "gap2"],
      retrievalTimeouts: ["mevzuat.gov.tr"]
    });
    expect(response.diagnostics!.coverageGaps).toHaveLength(2);
    expect(response.diagnostics!.retrievalTimeouts).toHaveLength(1);
    expect(response.summary.coverageGapCount).toBe(2);
    expect(response.summary.timeoutOrRetrievalIssue).toBe(true);
  });
});

describe("detectForbiddenOutputPhrases", () => {
  it("returns empty for clean pack", () => {
    const pack = makeFullPack();
    const found = detectForbiddenOutputPhrases(pack as unknown as Record<string, unknown>);
    expect(found).toHaveLength(0);
  });

  it("detects forbidden phrases in pack", () => {
    const pack = makeFullPack({
      shortAnswer: "Kesin olarak sorumlusunuz."
    });
    const found = detectForbiddenOutputPhrases(pack as unknown as Record<string, unknown>);
    expect(found).toContain("kesin olarak sorumlusunuz");
  });

  it("detects multiple forbidden phrases", () => {
    const pack = makeFullPack({
      shortAnswer: "Kesin hukuki kanaat. Derhal şunu yapın."
    });
    const found = detectForbiddenOutputPhrases(pack as unknown as Record<string, unknown>);
    expect(found.length).toBeGreaterThanOrEqual(2);
  });
});
