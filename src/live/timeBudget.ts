import { readConfig } from "../core/runtimeConfig.js";

export type ResearchPhase = "legislation" | "precedent";

export interface ResearchBudgetSnapshot {
  elapsedMs: number;
  remainingMs: number;
  isExhausted: boolean;
  phaseElapsedMs: Record<ResearchPhase, number>;
  phaseStartedAt: Partial<Record<ResearchPhase, number>>;
  phaseCompletedAt: Partial<Record<ResearchPhase, number>>;
}

export interface SourceBudgetDecision {
  shouldRun: boolean;
  budgetMs: number;
  reason: string;
}

export type IssueProfileForBudget =
  | "public_employment"
  | "public_discipline"
  | "malpractice_complication"
  | "civil_compensation"
  | "violence_threat"
  | "informed_consent"
  | "emergency_care"
  | "treatment_refusal"
  | "privacy_records"
  | "psychiatric_privacy"
  | "referral_consultation"
  | "private_hospital_fee"
  | "intensive_care"
  | "pregnancy_emergency"
  | "unknown";

export class ResearchTimeBudget {
  public readonly deadlineMs: number;
  public readonly startedAt: number;
  public readonly reserveMs: number;
  public readonly sourceBudgets: Record<string, number>;
  private readonly nowProvider: () => number;
  private phaseStartTimes: Partial<Record<ResearchPhase, number>> = {};
  private phaseEndTimes: Partial<Record<ResearchPhase, number>> = {};

  constructor(options: {
    deadlineMs?: number;
    reserveMs?: number;
    sourceBudgets?: Record<string, number>;
    nowProvider?: () => number;
  } = {}) {
    const config = readConfig().timeBudget;
    this.deadlineMs = options.deadlineMs ?? config.deadlineMs;
    this.nowProvider = options.nowProvider ?? Date.now;
    this.startedAt = this.nowProvider();
    this.reserveMs = options.reserveMs ?? config.reserveMs;
    this.sourceBudgets = options.sourceBudgets ?? {
      legislation: config.legislationPhaseBudgetMs,
      precedent: config.precedentPhaseBudgetMs
    };
  }

  /**
   * T25.2 — Create a budget with dynamic allocation based on issue profile.
   * Public employment / discipline → legislation-heavy.
   * Malpractice / civil compensation → precedent-heavy.
   * Default → balanced (config defaults).
   */
  static createWithIssueProfile(
    profile: IssueProfileForBudget,
    options: {
      deadlineMs?: number;
      reserveMs?: number;
      nowProvider?: () => number;
    } = {}
  ): ResearchTimeBudget {
    const config = readConfig().timeBudget;
    const total = config.deadlineMs - (options.reserveMs ?? config.reserveMs);
    const legislationHeavy = { legislation: Math.round(total * 0.65), precedent: Math.round(total * 0.35) };
    const precedentHeavy = { legislation: Math.round(total * 0.35), precedent: Math.round(total * 0.65) };
    const balanced = { legislation: config.legislationPhaseBudgetMs, precedent: config.precedentPhaseBudgetMs };

    const budgets =
      profile === "public_employment" || profile === "public_discipline"
        ? legislationHeavy
        : profile === "malpractice_complication" || profile === "civil_compensation" || profile === "violence_threat"
          ? precedentHeavy
          : balanced;

    return new ResearchTimeBudget({
      ...options,
      sourceBudgets: budgets
    });
  }

  elapsedMs(): number {
    return this.nowProvider() - this.startedAt;
  }

  remainingMs(): number {
    const elapsed = this.elapsedMs();
    const remaining = this.deadlineMs - elapsed - this.reserveMs;
    return Math.max(0, remaining);
  }

  isExhausted(): boolean {
    return this.remainingMs() <= 0;
  }

  /** Returns the configured budget for the given phase, or 0 if not configured. */
  phaseBudget(phase: ResearchPhase): number {
    return this.sourceBudgets[phase] ?? 0;
  }

  /**
   * Returns effective budget for a phase: min(phaseBudget, remainingMs).
   * Used to cap a phase so it cannot consume more than available global budget.
   */
  effectivePhaseBudgetMs(phase: ResearchPhase): number {
    return Math.min(this.phaseBudget(phase), this.remainingMs());
  }

  /**
   * Returns whether a phase should start.
   * Returns false if budget is exhausted or effective phase budget is too small (<500ms).
   */
  shouldStartPhase(phase: ResearchPhase): boolean {
    if (this.isExhausted()) return false;
    return this.effectivePhaseBudgetMs(phase) >= 500;
  }

  /** Record the start time of a phase. */
  markPhaseStart(phase: ResearchPhase): void {
    this.phaseStartTimes[phase] = this.nowProvider();
  }

  /** Record the end time of a phase. */
  markPhaseEnd(phase: ResearchPhase): void {
    this.phaseEndTimes[phase] = this.nowProvider();
  }

  /** Returns a snapshot of budget state. */
  snapshot(): ResearchBudgetSnapshot {
    const now = this.nowProvider();
    const phaseElapsedMs: Record<ResearchPhase, number> = { legislation: 0, precedent: 0 };
    for (const phase of ["legislation", "precedent"] as ResearchPhase[]) {
      const start = this.phaseStartTimes[phase];
      if (start !== undefined) {
        const end = this.phaseEndTimes[phase] ?? now;
        phaseElapsedMs[phase] = end - start;
      }
    }
    return {
      elapsedMs: now - this.startedAt,
      remainingMs: this.remainingMs(),
      isExhausted: this.isExhausted(),
      phaseElapsedMs,
      phaseStartedAt: { ...this.phaseStartTimes },
      phaseCompletedAt: { ...this.phaseEndTimes }
    };
  }
}
