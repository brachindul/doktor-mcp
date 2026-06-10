/**
 * MCP Doctor Pack Response Formatter (v0.43.0)
 *
 * Wraps DoctorLegalInformationPack into a structured MCP response
 * with clear separation between public physician-facing content
 * and diagnostic/internal details.
 *
 * Backward compatibility: the raw pack is still available in the `pack` field.
 */

import type { DoctorLegalInformationPack } from "../contracts/legal.js";

export type DoctorPackResponseStatus = "full_pack" | "partial_pack" | "no_pack_diagnostic";

export interface DoctorPackSummary {
  shortAnswer: string;
  sourceSufficiency: "sufficient" | "partial" | "insufficient";
  verifiedLegislationCount: number;
  verifiedPrecedentCount: number;
  coverageGapCount: number;
  timeoutOrRetrievalIssue: boolean;
}

export interface DoctorPackDiagnostics {
  missingAuthorityTypes: string[];
  coverageGaps: string[];
  retrievalTimeouts: string[];
  noPackReason?: string;
  gateObservations?: string[];
}

export type DataOrigin = "mock" | "live" | "snapshot" | "computed" | "client-provided";

export interface DoctorPackResponse {
  responseVersion: "doctor-pack-response/v1";
  ok: boolean;
  status: DoctorPackResponseStatus;
  /** E2.1: Origin of the data in this response. */
  dataOrigin: DataOrigin;
  /** E2.1: Present only when dataOrigin is "mock". Unmissable warning that response is fixture data. */
  mockDataWarning?: string;
  /** E1.2: Pack session cache ID for drill-down follow-up. Present when pack is cached. */
  packId?: string;
  pack?: DoctorLegalInformationPack;
  summary: DoctorPackSummary;
  /** E3.2: Whether full diagnostics are included in this response. */
  diagnosticsIncluded?: boolean;
  /** E3.2: Hint when diagnostics are stripped; tells the client how to get them. */
  diagnosticsHint?: string;
  diagnostics?: DoctorPackDiagnostics;
  _forbiddenPhraseWarning?: string[];
}

// ─── Safety language guards ────────────────────────────────────────────────

/**
 * Hard-blocked phrases: categorical final judgments that MUST NOT appear in output.
 * These are absolute, guaranteed statements that cross into legal advice territory.
 */
const HARD_BLOCKED_PHRASES = [
  "kesin olarak sorumlusunuz",
  "kesin beraat eder",
  "derhal şunu yapın",
  "derhal sunu yapin",
  "savunma dilekçesi şöyle olmalı",
  "savunma dilekcesi soyle olmali",
  "şu cezayı alırsınız",
  "su cezayi alirsiniz",
  "şunu yapmanız gerekir",
  "sunu yapmaniz gerekir",
  "kesin hukuki kanaat",
  "dilekçe taslağı",
  "savunma taslağı",
  "derhal yapılacak"
];

/**
 * Allowed assessment phrases (no longer blocked since v0.44.0).
 * These express conditional, source-grounded evaluation — not categorical judgment.
 * Examples: risk assessment with source reference, tendency indication.
 */
export const ALLOWED_ASSESSMENT_PHRASES = [
  "risk seviyesi yüksek",
  "risk seviyesi dusuk",
  "risk seviyesi düşük"
];

/**
 * Check if any hard-blocked output phrases appear in the pack.
 * Returns list of hard-blocked phrases found.
 *
 * Since v0.44.0: risk-level phrases moved to ALLOWED_ASSESSMENT_PHRASES
 * and are no longer blocked. Only categorical final judgments remain blocked.
 */
export function detectForbiddenOutputPhrases(pack: unknown): string[] {
  const allText = collectAllText(pack as Record<string, unknown>).toLowerCase();
  const found: string[] = [];
  for (const phrase of HARD_BLOCKED_PHRASES) {
    if (allText.includes(phrase)) {
      found.push(phrase);
    }
  }
  return found;
}

function collectAllText(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [, val] of Object.entries(obj)) {
    if (typeof val === "string") parts.push(val);
    else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") parts.push(item);
        else if (item && typeof item === "object") parts.push(collectAllText(item as Record<string, unknown>));
      }
    } else if (val && typeof val === "object") parts.push(collectAllText(val as Record<string, unknown>));
  }
  return parts.join(" ");
}

// ─── Response builder ─────────────────────────────────────────────────────

/**
 * E3.2: Strip diagnostic-heavy fields from the pack for token savings.
 * Keeps verifiedHighCourtPrecedents entries (the core content) but removes
 * per-entry sourceTrace fields, selectionDiagnostics, and precedentDiagnostics
 * excludedDecisions detail.
 */
function stripDiagnosticFields(pack: DoctorLegalInformationPack): DoctorLegalInformationPack {
  return {
    ...pack,
    // Strip per-legislation provision sourceTrace (audit-only)
    relevantLegislation: pack.relevantLegislation.map((l) => {
      const { sourceTrace, ...rest } = l;
      return rest;
    }),
    // Strip per-precedent decisionSourceTrace (audit-only)
    verifiedHighCourtPrecedents: pack.verifiedHighCourtPrecedents.map((p) => {
      const { decisionSourceTrace, ...rest } = p;
      return rest;
    }),
    // Keep summary-level diagnostics counts but drop detail
    selectionDiagnostics: pack.selectionDiagnostics ? {
      query: pack.selectionDiagnostics.query,
      sourceMode: pack.selectionDiagnostics.sourceMode,
      selectedLegislationCount: pack.selectionDiagnostics.selectedLegislationCount,
      selectedProvisionCount: pack.selectionDiagnostics.selectedProvisionCount,
      selectedLegislations: [],
      selectedProvisions: [],
      unavailableCount: pack.selectionDiagnostics.unavailableCount,
      warningCount: pack.selectionDiagnostics.warningCount
    } : undefined,
    precedentDiagnostics: pack.precedentDiagnostics ? {
      query: pack.precedentDiagnostics.query,
      selectedPrecedentCount: pack.precedentDiagnostics.selectedPrecedentCount,
      excludedDecisionCount: pack.precedentDiagnostics.excludedDecisionCount,
      dedupedCount: pack.precedentDiagnostics.dedupedCount,
      sourceSummaries: pack.precedentDiagnostics.sourceSummaries,
      selectedPrecedents: [],
      excludedDecisions: []
    } : undefined,
    sourceTrace: [],
    sourceUnavailable: pack.sourceUnavailable?.map((su) => {
      const { sourceTrace, ...rest } = su;
      return rest;
    })
  };
}

function deriveStatus(pack: DoctorLegalInformationPack): DoctorPackResponseStatus {
  if (pack.relevantLegislation.length === 0 && pack.verifiedHighCourtPrecedents.length === 0) {
    return "no_pack_diagnostic";
  }
  const hasSourceWarnings = pack.sourceWarnings.some((w) =>
    w.includes("Partial pack") || w.includes("kismi veri seti") || w.includes("Zaman bütçesi")
  );
  if (hasSourceWarnings) return "partial_pack";
  return "full_pack";
}

function deriveSourceSufficiency(pack: DoctorLegalInformationPack): DoctorPackSummary["sourceSufficiency"] {
  const hasLegislation = pack.relevantLegislation.length > 0;
  const hasPrecedents = pack.verifiedHighCourtPrecedents.length > 0;
  if (hasLegislation && hasPrecedents) return "sufficient";
  if (hasLegislation || hasPrecedents) return "partial";
  return "insufficient";
}

/**
 * Format a DoctorLegalInformationPack into a structured MCP response.
 */
export function formatDoctorPackResponse(
  pack: DoctorLegalInformationPack,
  options: {
    coverageGaps?: string[];
    retrievalTimeouts?: string[];
    missingAuthorityTypes?: string[];
    gateObservations?: string[];
    noPackReason?: string;
    /** E3.2: Include full diagnostics in response. Default false for token savings. */
    includeDiagnostics?: boolean;
    /** E1.2: Pack session cache ID for drill-down follow-up. */
    packId?: string;
  } = {}
): DoctorPackResponse {
  const includeDiag = options.includeDiagnostics ?? false;
  const status = deriveStatus(pack);
  const sourceSufficiency = deriveSourceSufficiency(pack);

  const summary: DoctorPackSummary = {
    shortAnswer: pack.shortAnswer,
    sourceSufficiency,
    verifiedLegislationCount: pack.relevantLegislation.length,
    verifiedPrecedentCount: pack.verifiedHighCourtPrecedents.length,
    coverageGapCount: (options.coverageGaps ?? []).length,
    timeoutOrRetrievalIssue: (options.retrievalTimeouts ?? []).length > 0
  };

  const diagnostics: DoctorPackDiagnostics | undefined =
    includeDiag && (status !== "full_pack" || (options.coverageGaps ?? []).length > 0 || (options.retrievalTimeouts ?? []).length > 0)
      ? {
          missingAuthorityTypes: options.missingAuthorityTypes ?? [],
          coverageGaps: options.coverageGaps ?? [],
          retrievalTimeouts: options.retrievalTimeouts ?? [],
          noPackReason: options.noPackReason,
          gateObservations: options.gateObservations
        }
      : undefined;

  const result: DoctorPackResponse = {
    responseVersion: "doctor-pack-response/v1",
    ok: true,
    status,
    dataOrigin: "mock", // E3.2: caller overrides in tools.ts via withDataOrigin
    pack: includeDiag ? pack : stripDiagnosticFields(pack),
    summary,
    diagnosticsIncluded: includeDiag,
    diagnostics
  };
  if (options.packId) {
    result.packId = options.packId;
  }
  if (!includeDiag) {
    result.diagnosticsHint = "Tam denetim izi için includeDiagnostics: true ile yeniden çağırın.";
  }
  return result;
}

/**
 * Format a no-pack diagnostic response (no pack available).
 */
export function formatNoPackDiagnosticResponse(options: {
  noPackReason: string;
  coverageGaps?: string[];
  retrievalTimeouts?: string[];
  missingAuthorityTypes?: string[];
  gateObservations?: string[];
  /** E1.2: Pack session cache ID — typically absent for no-pack responses. */
  packId?: string;
}): DoctorPackResponse {
  const result: DoctorPackResponse = {
    responseVersion: "doctor-pack-response/v1",
    ok: false,
    status: "no_pack_diagnostic",
    dataOrigin: "mock",
    summary: {
      shortAnswer: "Bu soru için güvenli research pack üretilemedi. Aşağıdaki resmi kaynaklar sınırlı bilgi sağlamaktadır.",
      sourceSufficiency: "insufficient",
      verifiedLegislationCount: 0,
      verifiedPrecedentCount: 0,
      coverageGapCount: (options.coverageGaps ?? []).length,
      timeoutOrRetrievalIssue: (options.retrievalTimeouts ?? []).length > 0
    },
    diagnostics: {
      missingAuthorityTypes: options.missingAuthorityTypes ?? [],
      coverageGaps: options.coverageGaps ?? [],
      retrievalTimeouts: options.retrievalTimeouts ?? [],
      noPackReason: options.noPackReason,
      gateObservations: options.gateObservations
    }
  };
  if (options.packId) {
    result.packId = options.packId;
  }
  return result;
}
