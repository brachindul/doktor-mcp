import { describe, it, expect } from "vitest";
import { renderDoctorPackMarkdown, renderNoPackDiagnosticMarkdown } from "../../src/formatters/doctorPackMarkdown.js";
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

describe("renderDoctorPackMarkdown", () => {
  it("renders deterministic Markdown with all sections", () => {
    const pack = makeFullPack();
    const md = renderDoctorPackMarkdown(pack);

    // Section order check
    const sections = [
      "# Hekim Hukuki Bilgilendirme Paketi",
      "## Kısa Cevap",
      "## Hukuki Sınıflandırma",
      "## İlgili Resmi Mevzuat",
      "## Doğrulanmış Yüksek Mahkeme Emsalleri",
      "## Kaynak Sınırlılığı ve Eksik Bilgiler",
      "## Avukat İncelemesi Gerektiren Noktalar",
      "## Teknik Doğrulama Özeti"
    ];
    for (const section of sections) {
      expect(md).toContain(section);
    }
  });

  it("includes legislation quote and source", () => {
    const pack = makeFullPack();
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toContain("Hasta Hakları Yönetmeliği");
    expect(md).toContain("Madde 24");
    expect(md).toContain("Tıbbi müdahalelerde hastanın rızası gerekir.");
  });

  it("includes precedent E/K, court, date", () => {
    const pack = makeFullPack();
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toContain("YARGİTAY / 13. Hukuk Dairesi");
    expect(md).toContain("2024-01-01");
    expect(md).toContain("2023/1 - 2024/2");
    expect(md).toContain("Sağlık hukuku olayı.");
  });

  it("includes safe opening statement", () => {
    const pack = makeFullPack();
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toContain("resmi kaynaklarla sınırlı hukuki bilgilendirme");
  });

  it("renders empty legislation gracefully", () => {
    const pack = makeFullPack({ relevantLegislation: [] });
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toContain("Doğrulanmış resmi mevzuat maddesi bulunamadı.");
  });

  it("renders empty precedents gracefully", () => {
    const pack = makeFullPack({ verifiedHighCourtPrecedents: [] });
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toContain("Doğrulanmış emsal karar bulunamadı.");
  });

  it("is deterministic across calls", () => {
    const pack = makeFullPack();
    const md1 = renderDoctorPackMarkdown(pack);
    const md2 = renderDoctorPackMarkdown(pack);
    expect(md1).toBe(md2);
  });

  it("includes relevanceExplanation when provided on a precedent", () => {
    const pack = makeFullPack({
      verifiedHighCourtPrecedents: [
        {
          courtAndChamber: "YARGİTAY / 13. Hukuk Dairesi",
          date: "2024-01-01",
          meritsAndDecisionNumber: "2023/1 - 2024/2",
          factSummary: "Sağlık hukuku olayı.",
          legalAssessment: "Gerekçeli karar.",
          outcome: "Sonuç.",
          similarityDifference: "Benzer olay.",
          sourceDocumentId: "yargitay:1",
          relevanceExplanation: 'Yüksek skor (3): "aydınlatılmış rıza", "onam" terimleri eşleşti. Bu karar informed_consent bağlamında ilgili.'
        }
      ]
    });
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toContain("**Neden Seçildi:**");
    expect(md).toContain("Yüksek skor (3)");
    expect(md).toContain("informed_consent bağlamında ilgili");
  });

  it("omits Neden Seçildi section when relevanceExplanation is absent", () => {
    const pack = makeFullPack({
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
      ]
    });
    const md = renderDoctorPackMarkdown(pack);
    expect(md).not.toContain("**Neden Seçildi:**");
  });
});

describe("renderNoPackDiagnosticMarkdown", () => {
  it("renders no-pack diagnostic with reason", () => {
    const md = renderNoPackDiagnosticMarkdown({
      noPackReason: "Question timed out after 30000ms"
    });
    expect(md).toContain("güvenli research pack üretilemedi");
    expect(md).toContain("timed out");
    expect(md).toContain("Kesin hukuki değerlendirme yapılmaz");
  });

  it("renders retrieval timeouts", () => {
    const md = renderNoPackDiagnosticMarkdown({
      noPackReason: "Source unavailable",
      retrievalTimeouts: ["mevzuat.gov.tr"]
    });
    expect(md).toContain("Ulaşılamayan Kaynaklar");
    expect(md).toContain("mevzuat.gov.tr");
  });

  it("renders coverage gaps", () => {
    const md = renderNoPackDiagnosticMarkdown({
      noPackReason: "No sources found",
      coverageGaps: ["gap1", "gap2"]
    });
    expect(md).toContain("Kaynak Boşlukları");
    expect(md).toContain("gap1");
    expect(md).toContain("gap2");
  });

  it("is deterministic across calls", () => {
    const options = { noPackReason: "test", coverageGaps: ["a"], retrievalTimeouts: ["b"] };
    const md1 = renderNoPackDiagnosticMarkdown(options);
    const md2 = renderNoPackDiagnosticMarkdown(options);
    expect(md1).toBe(md2);
  });
});
