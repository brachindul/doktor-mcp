/**
 * Legislation phase executor (extracted from service.ts — T0.4)
 *
 * Executes the legislation search phase with a hard budget cap via Promise.race.
 * If the legislation search takes longer than the phase budget, the phase
 * is interrupted but precedent search still proceeds.
 */
import type {
  ClassifiedMedicalLegalQuestion,
  LegislationProvision,
  LegislationSelectionDiagnostics,
  LegislationSourceMode,
  SourceUnavailable
} from "../contracts/legal.js";
import type { LiveLegislationResult } from "../sources/legislation/liveTypes.js";
import { buildLegislationSelectionDiagnostics } from "../sources/legislation/selectionDiagnostics.js";
import { routeMedicalIssue } from "../medicalIssueRouter.js";
import type { MedicalIssueId } from "../medicalIssueRouter.js";
import { HEALTH_LEGISLATION_INVENTORY } from "../healthLegislationInventory.js";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Return type of searchLegislation when called in any mode. */
export type SearchLegislationResult =
  | (LiveLegislationResult & { selectionDiagnostics: LegislationSelectionDiagnostics })
  | LegislationProvision[];

export interface LegislationPhaseDiagnostics {
  phaseBudgetExhausted: boolean;
  timedOut: boolean;
  retrievalTimeout: boolean;
  failedBeforePrecedent: boolean;
  coverageGaps: string[];
  knownHintFastPathUsed: boolean;
}

export interface ExecuteLegislationPhaseParams {
  classification: ClassifiedMedicalLegalQuestion;
  searchLegislation: (
    classification: ClassifiedMedicalLegalQuestion,
    sourceMode: LegislationSourceMode
  ) => Promise<SearchLegislationResult>;
  phaseBudgetMs: number;
}

// ─── Helpers (moved from service.ts) ────────────────────────────────────────

/**
 * Check if a legislation search result is an unavailable result.
 */
export function isLegislationUnavailable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    (value as Record<string, unknown>).status === "unavailable"
  );
}

/**
 * v0.40.0: Detect legislation coverage gaps for routed issue IDs.
 * Returns the keys of inventory gap/candidate/deferred entries whose
 * relatedIssueIds intersect with the given issue IDs.
 * This is used to surface coverage gap reasons before slow live searches.
 */
export function detectLegislationCoverageGaps(issueIds: MedicalIssueId[]): string[] {
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

// ─── Phase executor ─────────────────────────────────────────────────────────

/**
 * Execute the legislation phase with a hard budget cap via Promise.race.
 * If the legislation search takes longer than the phase budget, the phase
 * is interrupted but precedent search still proceeds.
 */
export async function executeLegislationPhase(
  params: ExecuteLegislationPhaseParams
): Promise<{
  legislation: SearchLegislationResult;
  diagnostics: LegislationPhaseDiagnostics;
}> {
  const { classification, searchLegislation, phaseBudgetMs } = params;

  const diagnostics: LegislationPhaseDiagnostics = {
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
    diagnostics.coverageGaps = coverageGaps;
  }

  let legislation: SearchLegislationResult;

  try {
    legislation = await Promise.race([
      searchLegislation(classification, "live"),
      new Promise<SearchLegislationResult>((_, reject) =>
        setTimeout(() => reject(new Error(`LEGISLATION_PHASE_TIMEOUT:${phaseBudgetMs}`)), phaseBudgetMs)
      )
    ]);
  } catch {
    diagnostics.timedOut = true;
    diagnostics.phaseBudgetExhausted = true;
    diagnostics.retrievalTimeout = true;

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
      diagnostics: { ...diagnostics }
    };
  }

  // Check if legislation returned unavailable (but didn't timeout)
  if (isLegislationUnavailable(legislation)) {
    diagnostics.failedBeforePrecedent = true;
  }

  return {
    legislation,
    diagnostics: { ...diagnostics }
  };
}
