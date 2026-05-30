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

export interface DoctorPackResponse {
  responseVersion: "doctor-pack-response/v1";
  ok: boolean;
  status: DoctorPackResponseStatus;
  pack?: DoctorLegalInformationPack;
  summary: DoctorPackSummary;
  diagnostics?: DoctorPackDiagnostics;
  _forbiddenPhraseWarning?: string[];
}

// ─── Safety language guards ────────────────────────────────────────────────

const FORBIDDEN_OUTPUT_PHRASES = [
  "kesin olarak sorumlusunuz",
  "kesin beraat eder",
  "derhal şunu yapın",
  "derhal sunu yapin",
  "risk seviyesi yüksek",
  "risk seviyesi dusuk",
  "risk seviyesi düşük",
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
 * Check if any forbidden output phrases appear in the pack.
 * Returns list of forbidden phrases found.
 */
export function detectForbiddenOutputPhrases(pack: unknown): string[] {
  if (typeof pack !== "object" || pack === null) return [];
  const allText = collectAllText(pack as Record<string, unknown>).toLowerCase();
  const found: string[] = [];
  for (const phrase of FORBIDDEN_OUTPUT_PHRASES) {
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
  } = {}
): DoctorPackResponse {
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
    status !== "full_pack" || (options.coverageGaps ?? []).length > 0 || (options.retrievalTimeouts ?? []).length > 0
      ? {
          missingAuthorityTypes: options.missingAuthorityTypes ?? [],
          coverageGaps: options.coverageGaps ?? [],
          retrievalTimeouts: options.retrievalTimeouts ?? [],
          noPackReason: options.noPackReason,
          gateObservations: options.gateObservations
        }
      : undefined;

  return {
    responseVersion: "doctor-pack-response/v1",
    ok: true,
    status,
    pack,
    summary,
    diagnostics
  };
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
}): DoctorPackResponse {
  return {
    responseVersion: "doctor-pack-response/v1",
    ok: false,
    status: "no_pack_diagnostic",
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
}
