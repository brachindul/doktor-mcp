import { describe, expect, it } from "vitest";
import { doctorQuestions, FORBIDDEN_FIELDS_LIST } from "../src/benchmark/doctorQuestions.js";
import { evaluateBenchmarkItem, runBenchmark, scoreBenchmarkItem } from "../src/benchmark/benchmarkRunner.js";
import { PhysicianLegalInformationService } from "../src/app/service.js";
import type { DoctorLegalInformationPack } from "../src/contracts/legal.js";
import * as fs from "fs";
import * as path from "path";

describe("Benchmark Dataset & Runner Tests", () => {
  it("should validate that all benchmark questions have the correct schema and unique IDs", () => {
    expect(doctorQuestions).toBeInstanceOf(Array);
    expect(doctorQuestions.length).toBeGreaterThanOrEqual(15);
    expect(doctorQuestions.length).toBeLessThanOrEqual(20);

    const ids = new Set<string>();

    for (const q of doctorQuestions) {
      expect(q.id).toBeDefined();
      expect(typeof q.id).toBe("string");
      expect(ids.has(q.id)).toBe(false); // check uniqueness
      ids.add(q.id);

      expect(q.category).toBeDefined();
      expect(typeof q.category).toBe("string");

      expect(q.question).toBeDefined();
      expect(typeof q.question).toBe("string");
      expect(q.question.length).toBeGreaterThan(10);

      expect(q.expectedTopicClusters).toBeInstanceOf(Array);
      expect(q.expectedPrimaryLegislationRoles).toBeDefined();
      expect(typeof q.expectedPrimaryLegislationRoles).toBe("object");

      expect(q.expectedPrimaryLegislationNames).toBeInstanceOf(Array);
      expect(q.shouldIncludeLegislation).toBeInstanceOf(Array);
      expect(q.shouldNotIncludeLegislation).toBeInstanceOf(Array);
      expect(q.expectedPrecedentSources).toBeInstanceOf(Array);
      expect(q.forbiddenFields).toBeInstanceOf(Array);
      
      expect(q.notes).toBeDefined();
      expect(typeof q.notes).toBe("string");
    }
  });

  it("should run the benchmark in mock mode for a single question and produce pure JSON and Markdown reports", async () => {
    const tempOutDir = path.join(process.cwd(), "temp-test-benchmark-output");
    
    try {
      const report = await runBenchmark({
        sourceMode: "mock",
        limit: 1,
        outDir: tempOutDir
      });

      expect(report.sourceMode).toBe("mock");
      expect(report.totalQuestions).toBe(1);
      expect(report.results).toBeInstanceOf(Array);
      expect(report.results.length).toBe(1);

      const item = report.results[0];
      expect(item.id).toBe(doctorQuestions[0].id);
      expect(item.passed).toBe(true);

      const jsonFile = path.join(tempOutDir, "doctor-benchmark-report.json");
      const mdFile = path.join(tempOutDir, "doctor-benchmark-report.md");

      expect(fs.existsSync(jsonFile)).toBe(true);
      expect(fs.existsSync(mdFile)).toBe(true);

      // Verify JSON purity
      const parsed = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
      expect(parsed.totalQuestions).toBe(1);
      expect(parsed.startedAt).toBeDefined();
      expect(parsed.completedAt).toBeDefined();
      expect(parsed.passedRegressionCount).toBe(1);
      expect(parsed.results[0].id).toBe(doctorQuestions[0].id);
      expect(parsed.results[0].scores.totalScore).toBeGreaterThanOrEqual(0);
    } finally {
      // Clean up
      if (fs.existsSync(tempOutDir)) {
        fs.rmSync(tempOutDir, { recursive: true, force: true });
      }
    }
  });

  describe("Live Benchmark Evaluation Metrics", () => {
    const question = doctorQuestions[0];

    function makePack(overrides: Partial<DoctorLegalInformationPack> & Record<string, unknown> = {}): DoctorLegalInformationPack & Record<string, unknown> {
      return {
        shortAnswer: "Kaynak metrik paketi.",
        legalClassification: {
          criminal: [],
          civilCompensation: [],
          disciplinaryAdministrative: [],
          patientRights: [],
          privacyKvkk: [],
          professionalEthics: ["Meslek etigi boyutu soru ile eslestirildi."]
        },
        relevantLegislation: [
          {
            legislationName: "Tibbi Deontoloji Nizamnamesi",
            articleNumber: "19",
            verbatimQuote: "MADDE 19- Hekim kaynak metni.",
            connection: "Mocked official trace for benchmark evaluation.",
            sourceDocumentId: "mevzuat:2.3.412578",
            sourceTrace: {
              query: question.question,
              matchedHealthMapping: {
                sourceId: "mevzuat:2.3.412578",
                query: "deontoloji nizamnamesi",
                title: "Tibbi Deontoloji Nizamnamesi",
                articleNumbers: ["19"],
                topicCluster: "physician_refusal_or_withdrawal",
                legislationRole: "health_primary",
                healthLawPriority: 10
              },
              officialSearchRequest: null,
              officialSearchResultsCount: null,
              selectedSearchResult: null,
              selectedResultReason: null,
              landingUrl: null,
              detailUrl: null,
              fullTextUrl: null,
              directPdfUrl: null,
              generatedPdfUrl: null,
              contentType: "application/pdf",
              extractionMethod: "pdf-text > article-marker",
              extractedArticleNumbers: ["19"],
              retrievedAt: "2026-05-23T00:00:00.000Z"
            }
          }
        ],
        verifiedHighCourtPrecedents: [],
        missingInformation: [],
        lawyerReviewPoints: [],
        sourceWarnings: [],
        precedentDiagnostics: {
          query: question.question,
          selectedPrecedentCount: 0,
          excludedDecisionCount: 0,
          sourceSummaries: [
            { source: "yargitay", mode: "live", searched: false, searchResultsCount: null, candidateCount: 0, selectedCount: 0, excludedCount: 0, unavailableCount: 1, errorCodes: ["source_error"] }
          ],
          selectedPrecedents: [],
          excludedDecisions: []
        },
        ...overrides
      };
    }

    it("treats sourceUnavailable as a live metric instead of a hard regression failure", () => {
      const pack = makePack({
        sourceUnavailable: [{
          status: "unavailable",
          source: "mevzuat.gov.tr",
          errorCode: "source_error",
          message: "Temporary upstream problem.",
          retryable: true,
          recommendedNextStep: "Retry later."
        }]
      });

      const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 12 });

      expect(result.regressionStatus).toBe("passed");
      expect(result.legislation.sourceUnavailable).toHaveLength(1);
      expect(result.precedents.sourceUnavailableBreakdown).toHaveLength(1);
      expect(result.scores.qualityBand).not.toBe("unsafe");
    });

    it("marks unsafe precedent usage as unsafe and a regression failure", () => {
      const pack = makePack({
        precedentDiagnostics: {
          query: question.question,
          selectedPrecedentCount: 1,
          excludedDecisionCount: 0,
          sourceSummaries: [],
          selectedPrecedents: [{
            source: "yargitay",
            court: "yargitay",
            status: "metadata_only",
            matchedHealthTopics: [],
            eligibilityReasons: []
          }],
          excludedDecisions: []
        }
      });

      const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 5 });

      expect(result.regressionStatus).toBe("failed");
      expect(result.safety.noUnsafePrecedent).toBe(false);
      expect(result.scores.qualityBand).toBe("unsafe");
    });

    it("marks forbidden MVP fields as unsafe", () => {
      const pack = makePack({ riskLevel: "high" });
      const result = evaluateBenchmarkItem({ question, pack, sourceMode: "live", durationMs: 5 });

      expect(result.regressionStatus).toBe("failed");
      expect(result.safety.forbiddenFieldsAbsent).toBe(false);
      expect(result.scores.forbiddenFieldsScore).toBe(0);
      expect(result.scores.qualityBand).toBe("unsafe");
    });

    it("scores a safe pack with verified precedent in the expected range", () => {
      const pack = makePack({
        verifiedHighCourtPrecedents: [{
          courtAndChamber: "YARGITAY / 13. Hukuk Dairesi",
          date: "2024-01-01",
          meritsAndDecisionNumber: "2023/1 - 2024/2",
          factSummary: "Saglik hukuku olayi.",
          legalAssessment: "Gerekceli karar.",
          outcome: "Sonuc.",
          similarityDifference: "Benzer olay.",
          sourceDocumentId: "yargitay:1"
        }],
        precedentDiagnostics: {
          query: question.question,
          selectedPrecedentCount: 1,
          excludedDecisionCount: 0,
          sourceSummaries: [{ source: "yargitay", mode: "live", searched: true, searchResultsCount: 1, candidateCount: 1, selectedCount: 1, excludedCount: 0, unavailableCount: 0, errorCodes: [] }],
          selectedPrecedents: [{ source: "yargitay", court: "yargitay", status: "precedent_usable", matchedHealthTopics: [], eligibilityReasons: ["Emsal olarak kullanilabilir."] }],
          excludedDecisions: []
        }
      });
      const result = scoreBenchmarkItem({
        question,
        pack,
        legislationOrder: pack.relevantLegislation.map((item) => item.legislationName),
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

      expect(result.totalScore).toBeGreaterThanOrEqual(10);
      expect(result.qualityBand).toBe("good");
    });
  });

  describe("Specific Regression Guards", () => {
    const service = new PhysicianLegalInformationService();

    it("should never start with Hasta Hakları Yönetmeliği for patient refusal / noncompliance question", async () => {
      const refusalQuestion = doctorQuestions.find(q => q.id === "refusal-noncompliance");
      expect(refusalQuestion).toBeDefined();

      const pack = await service.prepareInformationPack({
        question: refusalQuestion!.question,
        sourceMode: "mock"
      });

      expect(pack.relevantLegislation.length).toBeGreaterThan(0);
      const firstLeg = pack.relevantLegislation[0].legislationName;
      // Should be Tıbbi Deontoloji Nizamnamesi or Tababet Kanunu, not HHY
      expect(firstLeg).not.toContain("Hasta Hakları");
      expect(firstLeg).not.toContain("Hasta Haklari");
    });

    it("should not contain KVKK for a non-privacy question", async () => {
      // informed-consent-lack has nothing to do with privacy/KVKK
      const consentQuestion = doctorQuestions.find(q => q.id === "informed-consent-lack");
      expect(consentQuestion).toBeDefined();

      const pack = await service.prepareInformationPack({
        question: consentQuestion!.question,
        sourceMode: "mock"
      });

      const hasKvkk = pack.relevantLegislation.some(l => 
        /Kisisel Verilerin Korunmasi/i.test(l.legislationName) || /KVKK/i.test(l.legislationName)
      );

      expect(hasKvkk).toBe(false);
    });

    it("should never contain forbidden fields in any generated pack", async () => {
      // Test across first few mock packs to ensure perfect protection
      for (const q of doctorQuestions.slice(0, 5)) {
        const pack = await service.prepareInformationPack({
          question: q.question,
          sourceMode: "mock"
        });

        const rootKeys = Object.keys(pack);
        for (const forbidden of FORBIDDEN_FIELDS_LIST) {
          const lowerForbidden = forbidden.toLowerCase();
          const found = rootKeys.some(k => k.toLowerCase() === lowerForbidden);
          expect(found).toBe(false);
        }
      }
    });

    it("should not yield mock fallback for AYM in live mode (disabled source remains mock-less)", async () => {
      const mockLiveLegislation = {
        getMappedHealthProvisions: async () => ({ status: "ok", provisions: [] }),
        getLegislationProvisions: async () => []
      } as any;
      const mockLiveYargitay = { searchHealthPrecedents: async () => [] } as any;
      const mockLiveDanistay = { searchHealthPrecedents: async () => [] } as any;
      const mockLiveBedesten = { searchHealthPrecedents: async () => [] } as any;

      const liveService = new PhysicianLegalInformationService({
        liveLegislation: mockLiveLegislation,
        liveYargitay: mockLiveYargitay,
        liveDanistay: mockLiveDanistay,
        liveBedesten: mockLiveBedesten
      });

      // In live mode, AYM is disabled and must not produce mock fallback precedents
      const pack = await liveService.prepareInformationPack({
        question: "kisisel saglik verisi mahremiyet",
        sourceMode: "live"
      });

      // No AYM verified high court precedent should exist
      const hasAym = pack.verifiedHighCourtPrecedents.some(p => 
        /^AYM/i.test(p.courtAndChamber)
      );
      expect(hasAym).toBe(false);
    });
  });
});
