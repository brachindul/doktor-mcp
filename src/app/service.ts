import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  LegislationSourceMode,
  LegislationProvision,
  PrepareInformationPackInput,
  PrecedentSource,
  PrecedentSourceResult
} from "../contracts/legal.js";
import type { QueryAttemptTelemetry } from "../contracts/queryTelemetry.js";

import { composeDoctorLegalInformationPack } from "../health/answerComposer.js";
import { LegislationMapper } from "../health/legislationMapper.js";
import {
  filterReasonedPrecedents,
  selectVerifiedPrecedents,
  buildPrecedentSelectionDiagnostics
} from "../health/precedentFilter.js";
import { classifyMedicalLegalQuestion } from "../health/questionClassifier.js";
import { inferIssueProfileFromQuestion } from "../health/precedentRelevance.js";
import { rankedQueriesForSource } from "../health/queryRanking.js";
import type { IssueProfile } from "../health/precedentRelevance.js";
import { rerankByIssueRelevance } from "../health/precedentRerank.js";
import type { RerankResult } from "../health/precedentRerank.js";
import { MockAymAdapter } from "../sources/aym/mockAymAdapter.js";
import { MockDanistayAdapter } from "../sources/danistay/mockDanistayAdapter.js";
import { MockLegislationAdapter } from "../sources/legislation/mockLegislationAdapter.js";
import { LiveOfficialLegislationAdapter } from "../sources/legislation/liveOfficialLegislationAdapter.js";
import type { LiveLegislationResult } from "../sources/legislation/liveTypes.js";
import { buildLegislationSelectionDiagnostics } from "../sources/legislation/selectionDiagnostics.js";
import type { PrecedentSourceAdapter } from "../sources/types.js";
import { MockYargitayAdapter } from "../sources/yargitay/mockYargitayAdapter.js";
import { LiveYargitayAdapter } from "../sources/yargitay/liveYargitayAdapter.js";
import { LiveDanistayAdapter } from "../sources/danistay/liveDanistayAdapter.js";
import { LiveBedestenAdapter } from "../sources/bedesten/liveBedestenAdapter.js";

/** Maximum number of query attempts per source in live mode. */
const MAX_QUERIES_PER_SOURCE = 2;

export interface PhysicianLegalInformationServiceOptions {
  mockLegislation?: MockLegislationAdapter;
  liveLegislation?: LiveOfficialLegislationAdapter;
  liveYargitay?: LiveYargitayAdapter;
  liveDanistay?: LiveDanistayAdapter;
  liveBedesten?: LiveBedestenAdapter;
}

export class PhysicianLegalInformationService {
  private readonly mockLegislation: MockLegislationAdapter;
  private readonly liveLegislation: LiveOfficialLegislationAdapter;
  private readonly liveYargitay: LiveYargitayAdapter;
  private readonly liveDanistay: LiveDanistayAdapter;
  private readonly liveBedesten: LiveBedestenAdapter;
  private readonly legislationMapper: LegislationMapper;
  private readonly mockPrecedentAdapters: PrecedentSourceAdapter[] = [
    new MockYargitayAdapter(),
    new MockDanistayAdapter(),
    new MockAymAdapter()
  ];

  constructor(options: PhysicianLegalInformationServiceOptions = {}) {
    this.mockLegislation = options.mockLegislation ?? new MockLegislationAdapter();
    this.liveLegislation = options.liveLegislation ?? new LiveOfficialLegislationAdapter();
    this.liveYargitay = options.liveYargitay ?? new LiveYargitayAdapter();
    this.liveDanistay = options.liveDanistay ?? new LiveDanistayAdapter();
    this.liveBedesten = options.liveBedesten ?? new LiveBedestenAdapter();
    this.legislationMapper = new LegislationMapper(this.mockLegislation);
  }

  classify(question: string) {
    return classifyMedicalLegalQuestion(question);
  }

  async searchLegislation(classification: ClassifiedMedicalLegalQuestion, sourceMode: LegislationSourceMode = "mock") {
    if (sourceMode === "live") {
      const result = await this.liveLegislation.getMappedHealthProvisions(classification.question);
      if (result.status === "ok") {
        return {
          ...result,
          selectionDiagnostics: result.selectionDiagnostics ?? buildLegislationSelectionDiagnostics({
            query: classification.question,
            sourceMode,
            provisions: result.provisions
          })
        };
      }

      return {
        ...result,
        selectionDiagnostics: result.selectionDiagnostics ?? buildLegislationSelectionDiagnostics({
          query: classification.question,
          sourceMode,
          provisions: [],
          sourceUnavailable: [result]
        })
      };
    }
    return this.legislationMapper.mapQuestion(classification);
  }

  async getLegislationProvisions(documentIds: string[], sourceMode: LegislationSourceMode = "mock") {
    if (sourceMode === "live") {
      const provisions = await this.liveLegislation.getLegislationProvisions(documentIds);
      return {
        sourceMode,
        provisions,
        selectionDiagnostics: buildLegislationSelectionDiagnostics({
          query: queryFromProvisions(provisions, documentIds),
          sourceMode,
          provisions
        })
      };
    }
    return this.mockLegislation.getLegislationProvisions(documentIds);
  }

  async searchPrecedents(
    classification: ClassifiedMedicalLegalQuestion,
    sourceMode: LegislationSourceMode = "mock",
    precedentSources?: PrecedentSource[]
  ): Promise<{ decisions: CourtDecision[]; sourceResults: PrecedentSourceResult[]; queryTelemetry: QueryAttemptTelemetry[] }> {
    if (sourceMode === "live") {
      const sources: PrecedentSource[] = precedentSources ?? ["yargitay", "danistay"];
      const sourceResults: PrecedentSourceResult[] = [];
      const allTelemetry: QueryAttemptTelemetry[] = [];
      const issueProfile = inferIssueProfileFromQuestion(classification.question);

      await Promise.all(sources.map(async (src) => {
        if (src === "aym") {
          sourceResults.push({
            source: "aym",
            mode: "disabled",
            decisions: [],
            searchResultsCount: null,
            unavailable: true,
            errorCodes: ["live_not_supported"]
          });
          return;
        }

        const rankedQueries = rankedQueriesForSource(
          issueProfile as IssueProfile,
          src,
          classification,
          MAX_QUERIES_PER_SOURCE
        );

        const seenIds = new Set<string>();
        const allDecisions: CourtDecision[] = [];
        let totalResultCount = 0;
        let sourceAvailable = true;
        const sourceErrorCodes: string[] = [];

        for (const rq of rankedQueries) {
          const startedAt = new Date().toISOString();
          const t0 = Date.now();
          let resultCount = 0;
          let candidateCount = 0;
          let usableCandidateCount = 0;
          let success = false;
          let isUnavailable = false;
          let errorCode: string | undefined;
          let decisions: CourtDecision[] = [];

          try {
            if (src === "yargitay") {
              const result = await this.liveYargitay.searchAndNormalize(rq.queryText);
              if (result.status === "ok") {
                decisions = result.decisions;
                resultCount = result.searchResultsCount;
                success = resultCount > 0;
              } else {
                isUnavailable = true;
                errorCode = result.errorCode;
                sourceAvailable = false;
                sourceErrorCodes.push(result.errorCode);
              }
            } else if (src === "danistay") {
              const result = await this.liveDanistay.searchAndNormalize(rq.queryText);
              if (result.status === "ok") {
                decisions = result.decisions;
                resultCount = result.searchResultsCount;
                success = resultCount > 0;
              } else {
                isUnavailable = true;
                errorCode = result.errorCode;
                sourceAvailable = false;
                sourceErrorCodes.push(result.errorCode);
              }
            } else if (src === "bedesten") {
              try {
                decisions = await this.liveBedesten.searchHealthPrecedents(classification);
                resultCount = decisions.length;
                success = resultCount > 0;
              } catch (err) {
                isUnavailable = true;
                errorCode = "source_error";
                sourceAvailable = false;
                sourceErrorCodes.push("source_error");
              }
            }
          } catch {
            isUnavailable = true;
            errorCode = "source_error";
            sourceAvailable = false;
            sourceErrorCodes.push("source_error");
          }

          const durationMs = Date.now() - t0;

          // Deduplicate and assess candidates
          const newDecisions = decisions.filter((d) => !seenIds.has(d.id));
          for (const d of newDecisions) seenIds.add(d.id);
          allDecisions.push(...newDecisions);

          const filtered = filterReasonedPrecedents(newDecisions);
          candidateCount = filtered.length;
          usableCandidateCount = filtered.filter((e) => e.status === "precedent_usable").length;
          totalResultCount += resultCount;

          allTelemetry.push({
            source: src,
            issueProfile,
            queryText: rq.queryText,
            queryType: rq.queryType,
            queryRank: rq.rank,
            startedAt,
            durationMs,
            success,
            resultCount,
            candidateCount,
            usableCandidateCount,
            sourceUnavailable: isUnavailable,
            ...(errorCode ? { errorCode } : {})
          });

          // Only try fallback query if first query returned 0 results (and source not unavailable)
          if (rq.rank === 1 && (resultCount > 0 || isUnavailable)) break;
        }

        sourceResults.push({
          source: src,
          mode: "live",
          decisions: allDecisions,
          searchResultsCount: totalResultCount,
          unavailable: !sourceAvailable,
          errorCodes: sourceErrorCodes
        });
      }));

      return {
        decisions: sourceResults.flatMap((sr) => sr.decisions),
        sourceResults,
        queryTelemetry: allTelemetry
      };
    }

    // Mock mode: no telemetry, standard behavior
    const results = await Promise.all(
      this.mockPrecedentAdapters.map((adapter) => adapter.searchHealthPrecedents(classification))
    );
    const decisions = results.flat();
    const sourceResults: PrecedentSourceResult[] = [
      { source: "yargitay", mode: "mock", decisions: results[0] ?? [], searchResultsCount: (results[0] ?? []).length, unavailable: false, errorCodes: [] },
      { source: "danistay", mode: "mock", decisions: results[1] ?? [], searchResultsCount: (results[1] ?? []).length, unavailable: false, errorCodes: [] },
      { source: "aym", mode: "mock", decisions: results[2] ?? [], searchResultsCount: (results[2] ?? []).length, unavailable: false, errorCodes: [] }
    ];
    return { decisions, sourceResults, queryTelemetry: [] };
  }

  filterPrecedents(decisions: CourtDecision[]) {
    return filterReasonedPrecedents(decisions);
  }

  async prepareInformationPack(input: PrepareInformationPackInput): Promise<
    ReturnType<typeof composeDoctorLegalInformationPack> &
    {
      selectionDiagnostics?: ReturnType<typeof buildLegislationSelectionDiagnostics>;
      precedentDiagnostics: ReturnType<typeof buildPrecedentSelectionDiagnostics>;
      queryTelemetry: QueryAttemptTelemetry[];
      rerankResult: RerankResult;
    }
  > {
    const classification = this.classify(input.question);
    const [legislation, precedentResult] = await Promise.all([
      this.searchLegislation(classification, input.sourceMode),
      this.searchPrecedents(classification, input.sourceMode, input.precedentSources)
    ]);
    const { decisions, sourceResults, queryTelemetry } = precedentResult;
    const liveUnavailable = isLiveUnavailable(legislation) ? [legislation] : [];
    const provisions = isLiveResult(legislation)
      ? legislation.status === "ok" ? legislation.provisions : []
      : legislation;

    // Filter then rerank usable candidates by issue relevance before selection
    const filtered = this.filterPrecedents(decisions);
    const { reranked, rerankResult } = rerankByIssueRelevance(filtered, input.question);

    const precedentDiagnostics = buildPrecedentSelectionDiagnostics(reranked, input.question, sourceResults);
    const pack = composeDoctorLegalInformationPack(
      classification,
      provisions,
      selectVerifiedPrecedents(reranked),
      liveUnavailable
    );
    const selectionDiagnostics = input.sourceMode === "live"
      ? buildLegislationSelectionDiagnostics({
        query: input.question,
        sourceMode: "live",
        provisions,
        sourceUnavailable: liveUnavailable,
        warningCount: pack.sourceWarnings.length
      })
      : undefined;

    return {
      ...pack,
      ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
      precedentDiagnostics,
      queryTelemetry,
      rerankResult
    };
  }
}

function isLiveResult(value: unknown): value is LiveLegislationResult {
  return !Array.isArray(value);
}

function isLiveUnavailable(value: Awaited<ReturnType<PhysicianLegalInformationService["searchLegislation"]>>) {
  return isLiveResult(value) && value.status === "unavailable";
}

function queryFromProvisions(provisions: LegislationProvision[], documentIds: string[]) {
  return provisions[0]?.sourceTrace?.query ?? documentIds.join(" ");
}
