/**
 * Minimal pack rescue module (extracted from service.ts — T0.4)
 *
 * Manages partial state for minimal pack rescue on timeout or budget exhaustion.
 * When a research phase fails or the time budget runs out, partial results
 * are retained so that a degraded information pack can still be generated.
 */
import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  LegislationProvision,
  PrecedentSourceResult
} from "../contracts/legal.js";
import type { QueryAttemptTelemetry } from "../contracts/queryTelemetry.js";
import type { RerankResult } from "../health/precedentRerank.js";
import type { ResearchBudgetSnapshot } from "../live/timeBudget.js";

// ─── Types ──────────────────────────────────────────────────────────────────

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
  timeBudgetTelemetry: import("./service.js").TimeBudgetTelemetry | null;
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

// ─── State manager ──────────────────────────────────────────────────────────

/**
 * v0.42.0: Manages partial state for minimal pack rescue on timeout.
 * Encapsulates the state tracking that was previously private fields
 * on DoktorMcpInformationService.
 */
export class MinimalPackRescueManager {
  private lastPartialState: MinimalPackRescueContext | null = null;
  private lastPartialStateCleared = false;

  /**
   * Retrieve partial state for minimal pack rescue.
   * Returns null if not available or already consumed.
   */
  getLastPartialState(): MinimalPackRescueContext | null {
    const state = this.lastPartialState;
    if (this.lastPartialStateCleared) return null;
    this.lastPartialStateCleared = true;
    return state;
  }

  updatePartialState(update: Partial<MinimalPackRescueContext>): void {
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

  clearPartialState(): void {
    this.lastPartialState = null;
    this.lastPartialStateCleared = false;
  }
}
