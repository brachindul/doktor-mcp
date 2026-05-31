import { describe, expect, it } from "vitest";
import { doctorQuestions } from "../src/benchmark/doctorQuestions.js";
import { scoreBenchmarkItem, includesLegislationName, isPriorityMatch } from "../src/benchmark/scoring.js";
import type { DoctorLegalInformationPack, LegislationProvision } from "../src/contracts/legal.js";

function makePackWithLegislation(legislationNames: string[]): DoctorLegalInformationPack {
  const provisions: LegislationProvision[] = legislationNames.map((name) => ({
    documentId: "doc",
    legislationName: name,
    articleNumber: "1",
    verbatimText: "Metin.",
    connection: "Bağlantı.",
    dimensions: [],
    evidence: {
      source: "legislation",
      documentId: "doc",
      retrievedAt: new Date().toISOString(),
      official: true,
      fullText: true
    }
  }));
  return {
    legalClassification: { criminal: [], civilCompensation: [], disciplinaryAdministrative: [], patientRights: [], privacyKvkk: [], professionalEthics: [] },
    relevantLegislation: provisions.map((p) => ({
      legislationName: p.legislationName,
      articleNumber: p.articleNumber,
      verbatimQuote: p.verbatimText,
      connection: p.connection,
      sourceDocumentId: p.documentId
    })),
    verifiedHighCourtPrecedents: [],
    verifiedPrecedentAudit: [],
    missingInformation: [],
    lawyerReviewPoints: [],
    sourceWarnings: [],
    coverageGaps: [],
    sourceUnavailable: [],
    legislationSelectionDiagnostics: null,
    precedentSelectionDiagnostics: null
  };
}

describe("T23.1 — kamu/özlük golden-set", () => {
  const publicQuestionIds = new Set([
    "public-appointment-transfer",
    "public-disciplinary-investigation",
    "contracted-staff-disciplinary",
    "promotion-exam",
    "extra-payment",
    "on-call-duty",
    "open-appointment-lottery",
    "specialty-training",
    "health-specialist",
    "work-safety",
    "patient-staff-safety",
    "quality-improvement",
    "family-medicine",
    "civil-servant-rights",
    "contracted-appointment"
  ]);
  const publicQuestions = doctorQuestions.filter((q) => publicQuestionIds.has(q.id));

  it("contains at least 15 public physician questions", () => {
    expect(publicQuestions.length).toBeGreaterThanOrEqual(15);
  });

  it("every golden-set question has expected primary legislation", () => {
    for (const q of publicQuestions) {
      expect(q.expectedPrimaryLegislationNames.length).toBeGreaterThan(0);
      expect(q.shouldIncludeLegislation.length).toBeGreaterThan(0);
    }
  });

  it("scoring marks pack as passing when expected legislation is present", () => {
    const q = publicQuestions[0];
    const pack = makePackWithLegislation(q.shouldIncludeLegislation);
    const score = scoreBenchmarkItem({
      question: q,
      pack,
      legislationOrder: q.shouldIncludeLegislation,
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(score.legislationMatchScore).toBeGreaterThan(0);
  });

  it("scoring marks pack as failing when expected legislation is missing", () => {
    const q = publicQuestions[0];
    const pack = makePackWithLegislation([]);
    const score = scoreBenchmarkItem({
      question: q,
      pack,
      legislationOrder: [],
      auditErrors: [],
      auditWarnings: [],
      sourceUnavailableCount: 0,
      safety: {
        forbiddenFieldsAbsent: true,
        noUrgentAction: true,
        noRiskLevel: true,
        noDefinitiveLegalOpinion: true,
        noPetitionDraft: true,
        noUnsafePrecedent: true,
        noMockFallbackInLive: true
      }
    });
    expect(score.legislationMatchScore).toBe(0);
  });

  it("includes Atama Yönetmeliği for appointment question", () => {
    const q = publicQuestions.find((q2) => q2.id === "public-appointment-transfer");
    expect(q).toBeDefined();
    expect(q!.shouldIncludeLegislation).toContain("Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği");
  });

  it("includes 657 DMK for civil servant rights question", () => {
    const q = publicQuestions.find((q2) => q2.id === "civil-servant-rights");
    expect(q).toBeDefined();
    expect(q!.shouldIncludeLegislation).toContain("657 Sayılı Devlet Memurları Kanunu");
  });

  it("includes Ek Ödeme Yönetmeliği for extra payment question", () => {
    const q = publicQuestions.find((q2) => q2.id === "extra-payment");
    expect(q).toBeDefined();
    expect(q!.shouldIncludeLegislation).toContain("Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği");
  });
});
