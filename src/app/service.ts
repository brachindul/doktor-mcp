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

import { composeDoctorLegalInformationPack, type AssessmentTone } from "../health/answerComposer.js";
import { LegislationMapper } from "../health/legislationMapper.js";
import {
  filterReasonedPrecedents,
  selectVerifiedPrecedents,
  buildPrecedentSelectionDiagnostics
} from "../health/precedentFilter.js";
import { classifyMedicalLegalQuestion } from "../health/questionClassifier.js";
import { inferIssueProfileFromQuestion } from "../health/precedentRelevance.js";
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

// ─── Extracted modules ──────────────────────────────────────────────────────
import {
  executeLegislationPhase,
  type SearchLegislationResult,
  type LegislationPhaseDiagnostics
} from "./legislationPhase.js";
import {
  searchPrecedents,
  prioritizeSourcesByIssue,
  type PrecedentAdapters,
  type SearchPrecedentsResult
} from "./precedentPhase.js";
import {
  MinimalPackRescueManager,
  type MinimalPackRescueReason,
  type MinimalPackRescueContext,
  type PartialDiagnosticPack
} from "./minimalPackRescue.js";

// Re-export types that were previously defined here for backward compatibility
export type { MinimalPackRescueReason, MinimalPackRescueContext, PartialDiagnosticPack } from "./minimalPackRescue.js";

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

  /** v0.42.0: Partial state for minimal pack rescue on timeout — delegated to MinimalPackRescueManager */
  private readonly rescueManager = new MinimalPackRescueManager();

  constructor(options: DoktorMcpInformationServiceOptions = {}) {
    this.mockLegislation = options.mockLegislation ?? new MockLegislationAdapter();
    this.liveLegislation = options.liveLegislation ?? new LiveOfficialLegislationAdapter();
    const cache = options.precedentCache; // undefined = adapters use their own default (disabled)
    this.liveYargitay = options.liveYargitay ?? new LiveYargitayAdapter({ cache });
    this.liveDanistay = options.liveDanistay ?? new LiveDanistayAdapter({ cache });
    this.liveBedesten = options.liveBedesten ?? new LiveBedestenAdapter();
    this.legislationMapper = new LegislationMapper(this.mockLegislation);
  }

  /** v0.42.0: Retrieve partial state for minimal pack rescue. Returns null if not available or already consumed. */
  getLastPartialState(): MinimalPackRescueContext | null {
    return this.rescueManager.getLastPartialState();
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
    return searchPrecedents({
      classification,
      sourceMode,
      precedentSources,
      adapters: this.precedentAdapters
    });
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
    this.rescueManager.clearPartialState();

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
      const legislationResult = await executeLegislationPhase({
        classification,
        searchLegislation: (c, m) => this.searchLegislation(c, m) as Promise<SearchLegislationResult>,
        phaseBudgetMs: legislationPhaseBudgetMs
      });
      budget.markPhaseEnd("legislation");
      const legislation = legislationResult.legislation;
      const legislationPhaseDiags = legislationResult.diagnostics;

      // v0.42.0: Update partial state after legislation phase
      const legislationProvisions = isLiveResult(legislation)
        ? legislation.status === "ok" ? legislation.provisions : []
        : [];
      this.rescueManager.updatePartialState({
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
      this.rescueManager.updatePartialState({
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
        liveUnavailable,
        undefined,
        undefined,
        input.assessmentTone
      );
      const selectionDiagnostics = buildLegislationSelectionDiagnostics({
        query: input.question,
        sourceMode: "live",
        provisions,
        sourceUnavailable: liveUnavailable,
        warningCount: pack.sourceWarnings.length
      });

      // v0.42.0: Successful completion — clear partial state
      this.rescueManager.clearPartialState();

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
      liveUnavailable,
      undefined,
      undefined,
      input.assessmentTone
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

  /** Provide adapters bundle for precedent search delegation */
  private get precedentAdapters(): PrecedentAdapters {
    return {
      liveYargitay: this.liveYargitay,
      liveDanistay: this.liveDanistay,
      liveBedesten: this.liveBedesten,
      mockAdapters: this.mockPrecedentAdapters
    };
  }
}

// ─── Module-level helpers (kept in service.ts) ──────────────────────────────

function isLiveResult(value: unknown): value is LiveLegislationResult {
  return !Array.isArray(value);
}

function isLiveUnavailable(value: Awaited<ReturnType<DoktorMcpInformationService["searchLegislation"]>>) {
  return isLiveResult(value) && value.status === "unavailable";
}

function queryFromProvisions(provisions: LegislationProvision[], documentIds: string[]) {
  return provisions[0]?.sourceTrace?.query ?? documentIds.join(" ");
}
