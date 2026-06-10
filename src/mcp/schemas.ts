import { z } from "zod";

// ─── CourtDecision schema ──────────────────────────────────────────────────
// Validates the fields that the pipeline actually consumes (see
// src/health/decisionEligibility.ts and src/health/precedentFilter.ts).
// Additional fields pass through via .passthrough().

const sourceEvidenceSchema = z.object({
  source: z.enum(["legislation", "yargitay", "danistay", "aym", "bedesten"]).optional().default("yargitay"),
  official: z.literal(true).optional().default(true),
  fullText: z.boolean().optional().default(false),
  documentId: z.string(),
  retrievedAt: z.string().optional().default(new Date().toISOString()),
  sourceId: z.string().optional()
}).passthrough();

export const courtDecisionSchema = z.object({
  id: z.string(),
  court: z.enum(["yargitay", "danistay", "aym", "bedesten"]),
  chamber: z.string().optional(),
  decisionDate: z.string().optional(),
  meritsNumber: z.string().optional(),
  decisionNumber: z.string().optional(),
  evidence: sourceEvidenceSchema,
  // Fields consumed by decisionEligibility.ts:
  fullText: z.string().optional(),
  legalReasoning: z.string().optional(),
  relevanceNote: z.string().optional(),
  outcome: z.string().optional(),
  factSummary: z.string().optional(),
  topicTags: z.array(z.string()).optional().default([])
}).passthrough();

// ─── Drill-down pack schema (minimal validation) ───────────────────────────
// Full DoctorLegalInformationPack schema is too large to validate exhaustively.
// We only validate that the required arrays exist to avoid runtime errors.

const relevantLegislationSchema = z.object({
  legislationName: z.string(),
  articleNumber: z.string().optional(),
  sourceDocumentId: z.string()
}).passthrough();

const verifiedPrecedentEntrySchema = z.object({
  sourceDocumentId: z.string().optional(),
  sourceId: z.string().optional(),
  chamber: z.string().optional(),
  meritsNumber: z.string().optional(),
  decisionNumber: z.string().optional()
}).passthrough();

/** @deprecated Alias kept for transitions. Use drillDownPackSchema. */
export const doctorLegalInformationPackSchema = z.object({
  relevantLegislation: z.array(relevantLegislationSchema),
  verifiedHighCourtPrecedents: z.array(verifiedPrecedentEntrySchema)
}).passthrough();

export { doctorLegalInformationPackSchema as drillDownPackSchema };

// ─── Structured error helper ───────────────────────────────────────────────

export interface InvalidInputError {
  ok: false;
  errorCode: "invalid_input";
  issues: Array<{ path: string; message: string }>;
}

export function formatInvalidInputError(error: z.ZodError): InvalidInputError {
  return {
    ok: false,
    errorCode: "invalid_input",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}
