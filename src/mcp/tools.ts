import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, ZodError } from "zod";
import { DoktorMcpInformationService } from "../app/service.js";
import type { CourtDecision, DoctorLegalInformationPack } from "../contracts/legal.js";
import type { PackSessionCache } from "../app/packSessionCache.js";
import { buildPrecedentSelectionDiagnostics } from "../health/precedentFilter.js";
import { formatDoctorPackResponse, detectForbiddenOutputPhrases } from "./formatDoctorPackResponse.js";
import type { DoctorPackResponse } from "./formatDoctorPackResponse.js";
import { courtDecisionSchema, doctorLegalInformationPackSchema } from "./schemas.js";
import { readConfig } from "../core/runtimeConfig.js";

/**
 * Safe string-includes check: returns false for undefined, null, or empty needles.
 * Prevents the JavaScript `"anyString".includes("") === true` footgun.
 */
function includesNonEmpty(haystack: string, needle: string | undefined | null): boolean {
  if (!needle) return false;
  const trimmed = needle.trim().toLowerCase();
  if (trimmed.length === 0) return false;
  return haystack.toLowerCase().includes(trimmed);
}

const sourceModeSchema = z.enum(["mock", "live", "snapshot"]);
const precedentSourceSchema = z.enum(["yargitay", "danistay", "aym"]);
const assessmentToneSchema = z.enum(["strict", "grounded-advisory"]).default("grounded-advisory");
const questionSchema = z.object({ question: z.string().min(1) });
const legislationQuestionSchema = questionSchema.extend({ sourceMode: sourceModeSchema.optional() });
const packInputSchema = legislationQuestionSchema.extend({
  precedentSources: z.array(precedentSourceSchema).optional(),
  assessmentTone: assessmentToneSchema.optional(),
  includeDiagnostics: z.boolean().optional().default(false)
});
const provisionIdsSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
  sourceMode: sourceModeSchema.optional()
});
const decisionsSchema = z.object({
  decisions: z.array(courtDecisionSchema).optional(),
  packId: z.string().min(1).optional(),
  query: z.string().optional()
}).refine(
  (data) => data.decisions || data.packId,
  { message: "Either decisions or packId is required." }
).refine(
  (data) => !(data.decisions && data.packId),
  { message: "Provide either decisions or packId, not both." }
);

const drillDownSchema = z.object({
  // E1.3: prefer packId (from pack response); inline pack remains for backward compat
  packId: z.string().min(1).optional(),
  pack: doctorLegalInformationPackSchema.optional(),
  followUpQuestion: z.string().min(1)
}).refine(
  (data) => data.packId || data.pack,
  { message: "Either packId or pack is required." }
);

// E5.1: Get decision full text by documentId
const decisionFetchSchema = z.object({
  documentId: z.string().min(1),
  sourceMode: sourceModeSchema.optional()
});

function jsonResult(value: unknown): CallToolResult {
  // E3.3: Compact JSON (no pretty-print) — saves ~20-30% token cost for LLM clients
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>
  };
}

/**
 * E2.1: Wrap tool response with dataOrigin and mock warning.
 * Uses the runtime config's default source mode as the origin.
 * When sourceMode is "mock", injects an unmissable mockDataWarning.
 */
export function withDataOrigin(value: unknown, sourceMode?: string): Record<string, unknown> {
  const mode = sourceMode ?? readConfig().sourceMode;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const result = value as Record<string, unknown>;
    result.dataOrigin = mode;
    if (mode === "mock") {
      result.mockDataWarning = "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mevzuat veya mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın.";
    }
    return result;
  }
  // Wrap arrays/primitive responses
  return {
    dataOrigin: mode,
    ...(mode === "mock" ? { mockDataWarning: "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mevzuat veya mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın." } : {}),
    results: value
  };
}

/**
 * v0.43.0: Format pack response with safety guards.
 * Falls back to raw pack if formatting fails.
 */
function formatPackResponse(pack: DoctorLegalInformationPack, options: {
  coverageGaps?: string[];
  retrievalTimeouts?: string[];
  missingAuthorityTypes?: string[];
  gateObservations?: string[];
  includeDiagnostics?: boolean;
} = {}): DoctorPackResponse | Record<string, unknown> {
  try {
    const response = formatDoctorPackResponse(pack, options);
    // Safety guard: check for forbidden output phrases in the pack
    const forbiddenPhrases = detectForbiddenOutputPhrases(pack);
    if (forbiddenPhrases.length > 0) {
      response._forbiddenPhraseWarning = forbiddenPhrases;
    }
    return response;
  } catch {
    // Fallback: return raw pack with basic wrapper
    return {
      responseVersion: "doctor-pack-response/v1",
      ok: true,
      status: "full_pack",
      pack,
      summary: {
        shortAnswer: pack.shortAnswer,
        sourceSufficiency: pack.relevantLegislation.length > 0 ? "partial" : "insufficient",
        verifiedLegislationCount: pack.relevantLegislation.length,
        verifiedPrecedentCount: pack.verifiedHighCourtPrecedents.length,
        coverageGapCount: 0,
        timeoutOrRetrievalIssue: false
      }
    };
  }
}

export function createMedicalLegalToolHandlers(service = new DoktorMcpInformationService()) {
  const packCache = service.packSessionCache;

  return {
    classify_medical_legal_question: async (input: unknown) => service.classify(questionSchema.parse(input).question),
    search_health_legislation: async (input: unknown) => {
      const parsed = legislationQuestionSchema.parse(input);
      return service.searchLegislation(service.classify(parsed.question), parsed.sourceMode ?? readConfig().sourceMode);
    },
    get_legislation_provisions: async (input: unknown) => {
      const parsed = provisionIdsSchema.parse(input);
      return service.getLegislationProvisions(parsed.documentIds, parsed.sourceMode ?? readConfig().sourceMode);
    },
    search_health_precedents: async (input: unknown) => {
      const parsed = legislationQuestionSchema.parse(input);
      const { decisions } = await service.searchPrecedents(service.classify(parsed.question), parsed.sourceMode ?? readConfig().sourceMode);
      return decisions;
    },
    filter_reasoned_precedents: async (input: unknown) => {
      try {
        const parsed = decisionsSchema.parse(input);
        const query = parsed.query ?? "";

        // E1.4: Resolve decisions from packId if provided
        let decisions: CourtDecision[];
        if (parsed.packId) {
          const cached = packCache.get(parsed.packId);
          if (!cached) {
            return {
              ok: false,
              errorCode: "pack_not_found",
              message: "packId bulunamadı veya süresi doldu. Önce prepare_doctor_legal_information_pack çağırın."
            };
          }
          decisions = cached.verifiedHighCourtPrecedents as unknown as CourtDecision[];
        } else {
          decisions = parsed.decisions as unknown as CourtDecision[];
        }

        const filtered = service.filterPrecedents(decisions);
        const diagnostics = buildPrecedentSelectionDiagnostics(filtered, query);
        return { filtered, diagnostics };
      } catch (err) {
        if (err instanceof ZodError) {
          return { ok: false, errorCode: "invalid_input", issues: err.issues };
        }
        throw err;
      }
    },
    prepare_doctor_legal_information_pack: async (input: unknown) => {
      const parsed = packInputSchema.parse(input);
      const pack = await service.prepareInformationPack({
        question: parsed.question,
        sourceMode: parsed.sourceMode,
        precedentSources: parsed.precedentSources,
        assessmentTone: parsed.assessmentTone
      });
      const response = formatPackResponse(pack, { includeDiagnostics: parsed.includeDiagnostics });
      // E1.2: Store pack in session cache and attach packId for drill-down
      const packId = packCache.store(pack);
      return { packId, ...response as Record<string, unknown> };
    },
    get_decision_full_text: async (input: unknown) => {
      const parsed = decisionFetchSchema.parse(input);
      const sourceMode = parsed.sourceMode ?? readConfig().sourceMode;

      // Resolve source from documentId prefix
      const prefix = parsed.documentId.split(":")[0];
      if (!["yargitay", "danistay", "bedesten"].includes(prefix)) {
        return {
          ok: false,
          errorCode: "unsupported_source",
          message: `Unsupported source prefix "${prefix}". Supported: yargitay, danistay, bedesten. AYM live source is not available.`
        };
      }

      // In mock mode: search mock adapters for the decision
      if (sourceMode === "mock") {
        const classification = service.classify("");
        const { decisions } = await service.searchPrecedents(classification, "mock");
        const match = decisions.find((d) => d.id === parsed.documentId || d.evidence.documentId === parsed.documentId);
        if (!match) {
          return {
            ok: false,
            errorCode: "document_not_found",
            message: `Decision "${parsed.documentId}" not found in mock data.`
          };
        }
        return {
          documentId: parsed.documentId,
          court: match.court,
          fullText: match.fullText ?? null,
          legalReasoning: match.legalReasoning ?? null,
          outcome: match.outcome ?? null,
          contentStatus: match.contentStatus ?? "metadata_only",
          eligibility: match.legalReasoning ? "precedent_usable" : "no_reasoning",
          dataOrigin: "mock",
          mockDataWarning: "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın."
        };
      }

      // Live mode: try to fetch from live adapters
      return {
        ok: true,
        documentId: parsed.documentId,
        sourceMode: "live",
        status: "unavailable",
        message: "Live single-decision fetch is not yet implemented. Use search_health_precedents to retrieve decisions."
      };
    },
    drill_down_pack_item: async (input: unknown) => {
      try {
        const parsed = drillDownSchema.parse(input);

        // E1.3: Resolve pack from packId (preferred) or inline pack (deprecated)
        let pack: DoctorLegalInformationPack;
        let deprecationWarning: string | undefined;

        if (parsed.packId) {
          const cached = packCache.get(parsed.packId);
          if (!cached) {
            return {
              ok: false,
              errorCode: "pack_not_found",
              message: "packId bulunamadı veya süresi doldu. Önce prepare_doctor_legal_information_pack çağırın.",
              recommendedNextStep: "Re-run prepare_doctor_legal_information_pack and use the new packId."
            };
          }
          pack = cached;
        } else if (parsed.pack) {
          pack = parsed.pack as unknown as DoctorLegalInformationPack;
          deprecationWarning = "Inline 'pack' girişi v1.0'da kaldırılacak; packId kullanın.";
        } else {
          return { ok: false, errorCode: "invalid_input", message: "Either packId or pack is required." };
        }
        const q = parsed.followUpQuestion.toLowerCase();
        // Simple keyword-based matching to find the relevant provision or precedent
        const legislation = pack.relevantLegislation;
        const precedents = pack.verifiedHighCourtPrecedents;

        // Extract digit sequences as potential article/decision numbers.
        // `\d+` guarantees digits is never empty — safe for .includes() below.
        const digits = q.match(/\d+/g) ?? [];

        // Look for legislation name mentions
        const legislationMatches = legislation.filter((l) =>
          includesNonEmpty(q, l.legislationName) ||
          digits.some((d) => l.articleNumber?.includes(d))
        );

        // Look for precedent mentions (by sourceDocumentId, chamber, or decision/merits number)
        // NOTE: digits matching is safe — `"".includes(d)` returns false, and `d` is always
        // non-empty since it comes from /\d+/ match. No empty-string footgun here.
        const precedentMatches = precedents.filter((p) =>
          includesNonEmpty(q, p.sourceDocumentId) ||
          includesNonEmpty(q, p.sourceId) ||
          includesNonEmpty(q, p.chamber) ||
          digits.some((d) => (p.meritsNumber ?? "").includes(d) || (p.decisionNumber ?? "").includes(d))
        );

        const result: Record<string, unknown> = {
          matchedLegislation: legislationMatches,
          matchedPrecedents: precedentMatches,
          followUpQuestion: parsed.followUpQuestion,
          totalLegislationInPack: legislation.length,
          totalPrecedentsInPack: precedents.length,
          disclaimer: "Bu detaylar kaynak kayıtlarına dayanmaktadır; nihai hukuki yorum değildir."
        };
        if (deprecationWarning) {
          result.deprecationWarning = deprecationWarning;
        }
        return result;
      } catch (err) {
        if (err instanceof ZodError) {
          return { ok: false, errorCode: "invalid_input", issues: err.issues };
        }
        throw err;
      }
    }
  };
}

export function registerMedicalLegalTools(
  server: McpServer,
  service = new DoktorMcpInformationService()
): void {
  const handlers = createMedicalLegalToolHandlers(service);

  server.registerTool("classify_medical_legal_question", {
    description: "Advanced/granular tool: prefer prepare_doctor_legal_information_pack for end-to-end questions. Classifies a physician's legal question by medical-legal dimensions (criminal, civil compensation, patient rights, privacy/KVKK, professional ethics). Use this only when you specifically need classification in isolation.",
    inputSchema: legislationQuestionSchema.shape
  }, async (input) => jsonResult(withDataOrigin(await handlers.classify_medical_legal_question(input))));

  server.registerTool("search_health_legislation", {
    description: "Advanced/granular tool: prefer prepare_doctor_legal_information_pack for end-to-end questions. Searches official health-related legislation provisions (mevzuat.gov.tr). Use this only when you specifically need raw legislation search in isolation. Set sourceMode:'live' for official sources.",
    inputSchema: legislationQuestionSchema.shape
  }, async (input) => {
    const parsed = legislationQuestionSchema.parse(input);
    return jsonResult(withDataOrigin(await handlers.search_health_legislation(input), parsed.sourceMode ?? readConfig().sourceMode));
  });

  server.registerTool("get_legislation_provisions", {
    description: "Advanced/granular tool: prefer prepare_doctor_legal_information_pack for end-to-end questions. Returns verbatim official legislation provisions by document ID. Use this only when you have specific document IDs from a previous search or pack.",
    inputSchema: provisionIdsSchema.shape
  }, async (input) => {
    const parsed = provisionIdsSchema.parse(input);
    return jsonResult(withDataOrigin(await handlers.get_legislation_provisions(input), parsed.sourceMode ?? readConfig().sourceMode));
  });

  server.registerTool("search_health_precedents", {
    description: "Advanced/granular tool: prefer prepare_doctor_legal_information_pack for end-to-end questions. Searches high court precedent candidates (Yargitay, Danistay). Live mode uses live official sources. Use this only when you specifically need raw precedent search in isolation.",
    inputSchema: legislationQuestionSchema.shape
  }, async (input) => {
    const parsed = legislationQuestionSchema.parse(input);
    return jsonResult(withDataOrigin(await handlers.search_health_precedents(input), parsed.sourceMode ?? readConfig().sourceMode));
  });

  server.registerTool("filter_reasoned_precedents", {
    description: "Advanced/granular tool: prefer prepare_doctor_legal_information_pack for end-to-end questions. Classifies precedent candidates by full text availability, legal reasoning presence, and health-law relevance. Use this only when you have raw decisions to filter manually.",
    inputSchema: decisionsSchema.shape
  }, async (input) => jsonResult(withDataOrigin(await handlers.filter_reasoned_precedents(input))));

  server.registerTool("prepare_doctor_legal_information_pack", {
    description: "PRIMARY ENTRY POINT — use this tool first for any physician legal question. Prepares a complete source-grounded legal information pack: classification, verbatim legislation provisions, verified high-court precedents, missing information, and lawyer review points. Returns a packId for follow-up drill-down. Set sourceMode:'live' to query official sources (mevzuat.gov.tr, Yargitay, Danistay); default mode returns clearly-marked mock fixture data for testing only. Example: { \"question\": \"Hasta tedaviyi reddederse hekimin sorumluluğu nedir?\", \"sourceMode\": \"live\" }",
    inputSchema: packInputSchema.shape
  }, async (input) => {
    const parsed = packInputSchema.parse(input);
    return jsonResult(withDataOrigin(await handlers.prepare_doctor_legal_information_pack(input), parsed.sourceMode ?? readConfig().sourceMode));
  });

  server.registerTool("drill_down_pack_item", {
    description: "Follow-up tool — call ONLY after prepare_doctor_legal_information_pack. Pass the packId from that response plus a follow-up question mentioning a specific article number, law name, chamber, or decision number to retrieve just that item without rebuilding the pack. Example: { \"packId\": \"pack-3f9a2c\", \"followUpQuestion\": \"madde 24 ne diyor?\" }",
    inputSchema: drillDownSchema.shape
  }, async (input) => jsonResult(withDataOrigin(await handlers.drill_down_pack_item(input))));

  server.registerTool("get_decision_full_text", {
    description: "Fetch the full verbatim text of a single court decision by its documentId (from search_health_precedents or a pack's verifiedHighCourtPrecedents). Use for deep-dive into one decision instead of re-running the whole pack. Example: { \"documentId\": \"yargitay:99001\", \"sourceMode\": \"live\" }",
    inputSchema: decisionFetchSchema.shape
  }, async (input) => jsonResult(withDataOrigin(await handlers.get_decision_full_text(input))));
}
