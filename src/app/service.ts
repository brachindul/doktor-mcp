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
import { PrecedentCache } from "../sources/precedentCache.js";
import { ResearchTimeBudget } from "../live/timeBudget.js";
import type { ResearchBudgetSnapshot } from "../live/timeBudget.js";

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
import { routeMedicalIssue } from "../medicalIssueRouter.js";
import type { MedicalIssueId } from "../medicalIssueRouter.js";
import {
  HEALTH_LEGISLATION_INVENTORY
} from "../healthLegislationInventory.js";
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

/**
 * Telemetry about the time budget consumption for a single prepareInformationPack call.
 * Available only in live mode.
 */
export interface TimeBudgetTelemetry {
  deadlineMs: number;
  reserveMs: number;
  totalElapsedMs: number;
  remainingMsAtEnd: number;
  budgetExhausted: boolean;
  legislationPhaseMs: number;
  precedentPhaseMs: number;
  sourcePriorityOrder: string[];
  snapshot: ResearchBudgetSnapshot;
  // v0.40.0 legislation phase diagnostics
  legislationPhaseBudgetExhausted?: boolean;
  legislationPhaseTimedOut?: boolean;
  legislationPhaseFailedBeforePrecedent?: boolean;
  legislationCoverageGaps?: string[];
  legislationKnownHintFastPathUsed?: boolean;
  legislationPhaseBudgetMs?: number;
  legislationRetrievalTimeout?: boolean;
}

export type MinimalPackRescueReason =
  | "timeout_with_legislation"
  | "timeout_with_precedent"
  | "timeout_with_both"
  | "timeout_no_partial_state"
  | "budget_exhausted_with_legislation"
  | "budget_exhausted_with_precedent";

export interface MinimalPackRescueContext {
  rescueReason: MinimalPackRescueReason;
  failedPhase: "legislation" | "precedent" | "pack_generation" | "unknown";
  lastCompletedPhase: "legislation" | "precedent" | "none";
  provisionsAvailable: number;
  precedentsAvailable: number;
  classification: ClassifiedMedicalLegalQuestion;
  provisions: LegislationProvision[];
  decisions: CourtDecision[];
  reranked: Array<{ decision: CourtDecision; status: string }>;
  sourceResults: PrecedentSourceResult[];
  legislationPhaseDiagnostics: {
    phaseBudgetExhausted: boolean;
    timedOut: boolean;
    retrievalTimeout: boolean;
    failedBeforePrecedent: boolean;
    coverageGaps: string[];
    knownHintFastPathUsed: boolean;
  } | null;
  timeBudgetTelemetry: TimeBudgetTelemetry | null;
  queryTelemetry: QueryAttemptTelemetry[];
  rerankResult: RerankResult;
}

export interface PartialDiagnosticPack {
  packGenerated: boolean;
  partialPackGenerated: boolean;
  noPackDiagnostic: {
    canComposeResearchPack: boolean;
    packGenerationFailureReason: string;
    failedPhase: "legislation" | "precedent" | "pack_generation" | "unknown";
    elapsedMs: number;
    sourceSufficiencyLevel: string;
    missingAuthorityTypes: string[];
    coverageGaps: string[];
    recommendedNextDiagnostic: string;
    partialLegislationCount: number;
    partialVerifiedPrecedentCount: number;
    lastCompletedPhase: string;
    retrievalTimeoutSources: string[];
    canRetryWithLongerBudget: boolean;
    canRetryWithNarrowerIssue: boolean;
    partialStateAvailable: boolean;
  } | null;
  minimalPackRescueReason: MinimalPackRescueReason | null;
}

export interface DoktorMcpInformationServiceOptions {
  mockLegislation?: MockLegislationAdapter;
  liveLegislation?: LiveOfficialLegislationAdapter;
  liveYargitay?: LiveYargitayAdapter;
  liveDanistay?: LiveDanistayAdapter;
  liveBedesten?: LiveBedestenAdapter;
  /** Optional shared cache for live precedent adapters. Defaults to disabled. */
  precedentCache?: PrecedentCache;
}

export class DoktorMcpInformationService {
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

  constructor(options: DoktorMcpInformationServiceOptions = {}) {
    this.mockLegislation = options.mockLegislation ?? new MockLegislationAdapter();
    this.liveLegislation = options.liveLegislation ?? new LiveOfficialLegislationAdapter();
    const cache = options.precedentCache; // undefined = adapters use their own default (disabled)
    this.liveYargitay = options.liveYargitay ?? new LiveYargitayAdapter({ cache });
    this.liveDanistay = options.liveDanistay ?? new LiveDanistayAdapter({ cache });
    this.liveBedesten = options.liveBedesten ?? new LiveBedestenAdapter();
    this.legislationMapper = new LegislationMapper(this.mockLegislation);
  }

  /** v0.42.0: Partial state for minimal pack rescue on timeout */
  private lastPartialState: MinimalPackRescueContext | null = null;
  private lastPartialStateCleared = false;

  /** v0.42.0: Retrieve partial state for minimal pack rescue. Returns null if not available or already consumed. */
  getLastPartialState(): MinimalPackRescueContext | null {
    const state = this.lastPartialState;
    if (this.lastPartialStateCleared) return null;
    this.lastPartialStateCleared = true;
    return state;
  }

  private updatePartialState(update: Partial<MinimalPackRescueContext>) {
    this.lastPartialState = {
      rescueReason: update.rescueReason ?? this.lastPartialState?.rescueReason ?? "timeout_no_partial_state",
      failedPhase: update.failedPhase ?? this.lastPartialState?.failedPhase ?? "unknown",
      lastCompletedPhase: update.lastCompletedPhase ?? this.lastPartialState?.lastCompletedPhase ?? "none",
      provisionsAvailable: update.provisionsAvailable ?? this.lastPartialState?.provisionsAvailable ?? 0,
      precedentsAvailable: update.precedentsAvailable ?? this.lastPartialState?.precedentsAvailable ?? 0,
      classification: update.classification ?? this.lastPartialState?.classification!,
      provisions: update.provisions ?? this.lastPartialState?.provisions ?? [],
      decisions: update.decisions ?? this.lastPartialState?.decisions ?? [],
      reranked: update.reranked ?? this.lastPartialState?.reranked ?? [],
      sourceResults: update.sourceResults ?? this.lastPartialState?.sourceResults ?? [],
      legislationPhaseDiagnostics: update.legislationPhaseDiagnostics ?? this.lastPartialState?.legislationPhaseDiagnostics ?? null,
      timeBudgetTelemetry: update.timeBudgetTelemetry ?? this.lastPartialState?.timeBudgetTelemetry ?? null,
      queryTelemetry: update.queryTelemetry ?? this.lastPartialState?.queryTelemetry ?? [],
      rerankResult: update.rerankResult ?? this.lastPartialState?.rerankResult ?? { preRerankTopId: null, postRerankTopId: null, rerankChangedSelection: false, usableCount: 0 }
    };
    this.lastPartialStateCleared = false;
  }

  private clearPartialState() {
    this.lastPartialState = null;
    this.lastPartialStateCleared = false;
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
              } catch (_err) {
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

          // Read adapter-level request telemetry (cache hit/miss, retry counts)
          const adapterT = src === "yargitay"
            ? this.liveYargitay.lastRequestTelemetry
            : src === "danistay"
              ? this.liveDanistay.lastRequestTelemetry
              : null;

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
            ...(errorCode ? { errorCode } : {}),
            // Cache & HTTP retry telemetry
            cacheHit: adapterT?.cacheHit ?? false,
            cacheMiss: adapterT?.cacheMiss ?? false,
            servedFromCache: adapterT?.servedFromCache ?? false,
            networkRequestMade: adapterT?.networkRequestMade ?? true,
            cacheAgeMs: adapterT?.cacheAgeMs ?? null,
            retryCount: adapterT?.retryCount ?? 0,
            backoffMs: adapterT?.backoffMs ?? 0,
            retryAfterMs: adapterT?.retryAfterMs ?? null,
            timedOut: adapterT?.timedOut ?? false
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

  /**
   * v0.40.0: Legislation phase diagnostics for a single legislation search attempt.
   */
  private legislationPhaseDiagnostics = {
    phaseBudgetExhausted: false,
    timedOut: false,
    retrievalTimeout: false,
    failedBeforePrecedent: false,
    coverageGaps: [] as string[],
    knownHintFastPathUsed: false
  };

  /**
   * Execute the legislation phase with a hard budget cap via Promise.race.
   * If the legislation search takes longer than the phase budget, the phase
   * is interrupted but precedent search still proceeds.
   */
  private async executeLegislationPhase(
    classification: Awaited<ReturnType<DoktorMcpInformationService["classify"]>>,
    _budget: ResearchTimeBudget,
    phaseBudgetMs: number
  ): Promise<{
    legislation: Awaited<ReturnType<DoktorMcpInformationService["searchLegislation"]>>;
    diagnostics: {
      phaseBudgetExhausted: boolean;
      timedOut: boolean;
      retrievalTimeout: boolean;
      failedBeforePrecedent: boolean;
      coverageGaps: string[];
      knownHintFastPathUsed: boolean;
    };
  }> {
    this.legislationPhaseDiagnostics = {
      phaseBudgetExhausted: false,
      timedOut: false,
      retrievalTimeout: false,
      failedBeforePrecedent: false,
      coverageGaps: [],
      knownHintFastPathUsed: true // legislation adapter uses known hints by default
    };

    // Detect coverage gaps before search
    const routed = routeMedicalIssue(classification.question);
    const issueIds = routed.routes.map((r) => r.issueId);
    const coverageGaps = detectLegislationCoverageGaps(issueIds);
    if (coverageGaps.length > 0) {
      this.legislationPhaseDiagnostics.coverageGaps = coverageGaps;
    }

    let legislation: Awaited<ReturnType<DoktorMcpInformationService["searchLegislation"]>>;

    try {
      legislation = await Promise.race([
        this.searchLegislation(classification, "live"),
        new Promise<Awaited<ReturnType<DoktorMcpInformationService["searchLegislation"]>>>((_, reject) =>
          setTimeout(() => reject(new Error(`LEGISLATION_PHASE_TIMEOUT:${phaseBudgetMs}`)), phaseBudgetMs)
        )
      ]);
    } catch (error) {
      this.legislationPhaseDiagnostics.timedOut = true;
      this.legislationPhaseDiagnostics.phaseBudgetExhausted = true;
      this.legislationPhaseDiagnostics.retrievalTimeout = true;

      // Legislation phase failed, but precedent phase can still proceed
      // Return empty legislation result with selectionDiagnostics for type compatibility
      return {
        legislation: {
          status: "unavailable" as const,
          source: "mevzuat.gov.tr" as const,
          errorCode: "source_error" as const,
          message: `Legislation phase timed out after ${phaseBudgetMs}ms (legislationPhaseBudgetExhausted).`,
          retryable: true,
          recommendedNextStep: "Proceeding to precedent phase with available sources.",
          selectionDiagnostics: buildLegislationSelectionDiagnostics({
            query: classification.question,
            sourceMode: "live",
            provisions: [],
            sourceUnavailable: [{
              status: "unavailable" as const,
              source: "mevzuat.gov.tr",
              errorCode: "source_error",
              message: `Legislation phase timed out after ${phaseBudgetMs}ms.`,
              retryable: true,
              recommendedNextStep: "Proceeding to precedent phase with available sources."
            }]
          })
        },
        diagnostics: { ...this.legislationPhaseDiagnostics }
      };
    }

    // Check if legislation returned unavailable (but didn't timeout)
    if (isLegislationUnavailable(legislation)) {
      this.legislationPhaseDiagnostics.failedBeforePrecedent = true;
    }

    return {
      legislation,
      diagnostics: { ...this.legislationPhaseDiagnostics }
    };
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
      timeBudgetTelemetry?: TimeBudgetTelemetry;
    }
  > {
    const classification = this.classify(input.question);
    this.clearPartialState();

    // Live mode: sequential research with time budget
    if (input.sourceMode === "live") {
      const budget = input.timeBudget instanceof ResearchTimeBudget
        ? input.timeBudget
        : new ResearchTimeBudget();

      // Infer issue profile for source prioritization
      const issueProfile = inferIssueProfileFromQuestion(input.question);
      const prioritizedSources = prioritizeSourcesByIssue(issueProfile, input.precedentSources ?? ["yargitay", "danistay"]);

      // Phase 1: Legislation (time-bounded with hard cap)
      budget.markPhaseStart("legislation");
      const legislationPhaseBudgetMs = budget.effectivePhaseBudgetMs("legislation");
      const legislationResult = await this.executeLegislationPhase(classification, budget, legislationPhaseBudgetMs);
      budget.markPhaseEnd("legislation");
      const legislation = legislationResult.legislation;
      const legislationPhaseDiags = legislationResult.diagnostics;

      // v0.42.0: Update partial state after legislation phase
      const legislationProvisions = isLiveResult(legislation)
        ? legislation.status === "ok" ? legislation.provisions : []
        : [];
      this.updatePartialState({
        classification,
        provisions: legislationProvisions,
        provisionsAvailable: legislationProvisions.length,
        lastCompletedPhase: legislationPhaseDiags.timedOut ? "none" : "legislation",
        legislationPhaseDiagnostics: legislationPhaseDiags,
        failedPhase: legislationPhaseDiags.timedOut ? "legislation" : "unknown"
      });

      // Phase 2: Precedents with remaining budget
      budget.markPhaseStart("precedent");
      const precedentResult = await this.searchPrecedents(classification, "live", prioritizedSources);
      budget.markPhaseEnd("precedent");

      const snap = budget.snapshot();
      const timeBudgetTelemetry: TimeBudgetTelemetry = {
        deadlineMs: budget.deadlineMs,
        reserveMs: budget.reserveMs,
        totalElapsedMs: snap.elapsedMs,
        remainingMsAtEnd: snap.remainingMs,
        budgetExhausted: snap.isExhausted,
        legislationPhaseMs: snap.phaseElapsedMs.legislation,
        precedentPhaseMs: snap.phaseElapsedMs.precedent,
        sourcePriorityOrder: prioritizedSources,
        snapshot: snap,
        legislationPhaseBudgetExhausted: legislationPhaseDiags.phaseBudgetExhausted,
        legislationPhaseTimedOut: legislationPhaseDiags.timedOut,
        legislationPhaseFailedBeforePrecedent: legislationPhaseDiags.failedBeforePrecedent,
        legislationCoverageGaps: legislationPhaseDiags.coverageGaps,
        legislationKnownHintFastPathUsed: legislationPhaseDiags.knownHintFastPathUsed,
        legislationPhaseBudgetMs: legislationPhaseBudgetMs,
        legislationRetrievalTimeout: legislationPhaseDiags.retrievalTimeout
      };

      const { decisions, sourceResults, queryTelemetry } = precedentResult;
      const liveUnavailable = isLiveUnavailable(legislation) ? [legislation] : [];
      const provisions = isLiveResult(legislation)
        ? legislation.status === "ok" ? legislation.provisions : []
        : legislation;

      const filtered = this.filterPrecedents(decisions);
      const { reranked, rerankResult } = rerankByIssueRelevance(filtered, input.question);

      // v0.42.0: Update partial state after precedent phase
      const verifiedPrecedents = selectVerifiedPrecedents(reranked);
      this.updatePartialState({
        classification,
        provisions,
        provisionsAvailable: provisions.length,
        decisions,
        reranked,
        sourceResults,
        queryTelemetry,
        rerankResult,
        timeBudgetTelemetry: {
          deadlineMs: budget.deadlineMs,
          reserveMs: budget.reserveMs,
          totalElapsedMs: snap.elapsedMs,
          remainingMsAtEnd: snap.remainingMs,
          budgetExhausted: snap.isExhausted,
          legislationPhaseMs: snap.phaseElapsedMs.legislation,
          precedentPhaseMs: snap.phaseElapsedMs.precedent,
          sourcePriorityOrder: prioritizedSources,
          snapshot: snap,
          legislationPhaseBudgetExhausted: legislationPhaseDiags.phaseBudgetExhausted,
          legislationPhaseTimedOut: legislationPhaseDiags.timedOut,
          legislationPhaseFailedBeforePrecedent: legislationPhaseDiags.failedBeforePrecedent,
          legislationCoverageGaps: legislationPhaseDiags.coverageGaps,
          legislationKnownHintFastPathUsed: legislationPhaseDiags.knownHintFastPathUsed,
          legislationPhaseBudgetMs: legislationPhaseBudgetMs,
          legislationRetrievalTimeout: legislationPhaseDiags.retrievalTimeout
        },
        precedentsAvailable: verifiedPrecedents.length,
        lastCompletedPhase: "precedent",
        failedPhase: null as unknown as "unknown"
      });

      const precedentDiagnostics = buildPrecedentSelectionDiagnostics(reranked, input.question, sourceResults);
      const pack = composeDoctorLegalInformationPack(
        classification,
        provisions,
        selectVerifiedPrecedents(reranked),
        liveUnavailable
      );
      const selectionDiagnostics = buildLegislationSelectionDiagnostics({
        query: input.question,
        sourceMode: "live",
        provisions,
        sourceUnavailable: liveUnavailable,
        warningCount: pack.sourceWarnings.length
      });

      // v0.42.0: Successful completion — clear partial state
      this.clearPartialState();

      return {
        ...pack,
        selectionDiagnostics,
        precedentDiagnostics,
        queryTelemetry,
        rerankResult,
        timeBudgetTelemetry
      };
    }

    // Mock mode: parallel, no budget
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
    const selectionDiagnostics = undefined;

    return {
      ...pack,
      ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
      precedentDiagnostics,
      queryTelemetry,
      rerankResult
    };
  }
}

/**
 * Prioritize sources based on issue profile.
 * - disciplinary/administrative issues: danistay-first
 * - privacy/kvkk issues: yargitay-first (civil/criminal emphasis)
 * - default: yargitay-first
 */
function prioritizeSourcesByIssue(issueProfile: string, sources: PrecedentSource[]): PrecedentSource[] {
  const danistayFirst = ["disciplinary_administrative", "administrative_liability"];
  if (danistayFirst.some((issue) => issueProfile.includes(issue))) {
    return [...sources].sort((a, b) => {
      if (a === "danistay") return -1;
      if (b === "danistay") return 1;
      return 0;
    });
  }
  // Default: yargitay-first
  return [...sources].sort((a, b) => {
    if (a === "yargitay") return -1;
    if (b === "yargitay") return 1;
    return 0;
  });
}

function isLiveResult(value: unknown): value is LiveLegislationResult {
  return !Array.isArray(value);
}

function isLiveUnavailable(value: Awaited<ReturnType<DoktorMcpInformationService["searchLegislation"]>>) {
  return isLiveResult(value) && value.status === "unavailable";
}

/**
 * Check if a legislation search result is an unavailable result.
 */
function isLegislationUnavailable(value: unknown): boolean {
  return typeof value === "object" && value !== null && "status" in value && (value as Record<string, unknown>).status === "unavailable";
}

/**
 * v0.40.0: Detect legislation coverage gaps for routed issue IDs.
 * Returns the keys of inventory gap/candidate/deferred entries whose
 * relatedIssueIds intersect with the given issue IDs.
 * This is used to surface coverage gap reasons before slow live searches.
 */
function detectLegislationCoverageGaps(issueIds: MedicalIssueId[]): string[] {
  if (issueIds.length === 0) return [];
  const gaps: string[] = [];
  for (const entry of HEALTH_LEGISLATION_INVENTORY) {
    if (entry.coverageStatus === "covered") continue;
    const entryIssues = entry.relatedIssueIds ?? [];
    if (entryIssues.some((id) => issueIds.includes(id as MedicalIssueId))) {
      gaps.push(`${entry.titleNormalized} (${entry.coverageStatus}: ${entry.officialSourceStatus})`);
    }
  }
  return gaps;
}

function queryFromProvisions(provisions: LegislationProvision[], documentIds: string[]) {
  return provisions[0]?.sourceTrace?.query ?? documentIds.join(" ");
}
