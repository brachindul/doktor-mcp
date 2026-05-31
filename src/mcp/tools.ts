import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DoktorMcpInformationService } from "../app/service.js";
import type { CourtDecision, DoctorLegalInformationPack } from "../contracts/legal.js";
import { buildPrecedentSelectionDiagnostics } from "../health/precedentFilter.js";
import { formatDoctorPackResponse, detectForbiddenOutputPhrases } from "./formatDoctorPackResponse.js";
import type { DoctorPackResponse } from "./formatDoctorPackResponse.js";

const sourceModeSchema = z.enum(["mock", "live", "snapshot"]).default("mock");
const precedentSourceSchema = z.enum(["yargitay", "danistay", "aym"]);
const assessmentToneSchema = z.enum(["strict", "grounded-advisory"]).default("grounded-advisory");
const questionSchema = z.object({ question: z.string().min(1) });
const legislationQuestionSchema = questionSchema.extend({ sourceMode: sourceModeSchema.optional() });
const packInputSchema = legislationQuestionSchema.extend({
  precedentSources: z.array(precedentSourceSchema).optional(),
  assessmentTone: assessmentToneSchema.optional()
});
const provisionIdsSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
  sourceMode: sourceModeSchema.optional()
});
const decisionsSchema = z.object({
  decisions: z.array(z.custom<CourtDecision>()),
  query: z.string().optional()
});

const drillDownSchema = z.object({
  pack: z.custom<DoctorLegalInformationPack>(),
  followUpQuestion: z.string().min(1)
});

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>
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
  return {
    classify_medical_legal_question: async (input: unknown) => service.classify(questionSchema.parse(input).question),
    search_health_legislation: async (input: unknown) => {
      const parsed = legislationQuestionSchema.parse(input);
      return service.searchLegislation(service.classify(parsed.question), parsed.sourceMode);
    },
    get_legislation_provisions: async (input: unknown) => {
      const parsed = provisionIdsSchema.parse(input);
      return service.getLegislationProvisions(parsed.documentIds, parsed.sourceMode);
    },
    search_health_precedents: async (input: unknown) => {
      const parsed = legislationQuestionSchema.parse(input);
      const { decisions } = await service.searchPrecedents(service.classify(parsed.question), parsed.sourceMode);
      return decisions;
    },
    filter_reasoned_precedents: async (input: unknown) => {
      const parsed = decisionsSchema.parse(input);
      const filtered = service.filterPrecedents(parsed.decisions);
      const diagnostics = buildPrecedentSelectionDiagnostics(filtered, parsed.query ?? "");
      return { filtered, diagnostics };
    },
    prepare_doctor_legal_information_pack: async (input: unknown) => {
      const pack = await service.prepareInformationPack(packInputSchema.parse(input));
      return formatPackResponse(pack);
    },
    drill_down_pack_item: async (input: unknown) => {
      const parsed = drillDownSchema.parse(input);
      const q = parsed.followUpQuestion.toLowerCase();
      // Simple keyword-based matching to find the relevant provision or precedent
      const legislation = parsed.pack.relevantLegislation;
      const precedents = parsed.pack.verifiedHighCourtPrecedents;

      // Extract digit sequences as potential article/decision numbers
      const digits = q.match(/\d+/g) ?? [];

      // Look for legislation name mentions
      const legislationMatches = legislation.filter((l) =>
        q.includes(l.legislationName.toLowerCase()) ||
        digits.some((d) => l.articleNumber?.includes(d))
      );

      // Look for precedent mentions (by sourceDocumentId, chamber, or decision/merits number)
      const precedentMatches = precedents.filter((p) =>
        q.includes(p.sourceDocumentId?.toLowerCase() ?? "") ||
        q.includes(p.sourceId?.toLowerCase() ?? "") ||
        q.includes(p.chamber?.toLowerCase() ?? "") ||
        digits.some((d) => (p.meritsNumber ?? "").includes(d) || (p.decisionNumber ?? "").includes(d))
      );

      return {
        matchedLegislation: legislationMatches,
        matchedPrecedents: precedentMatches,
        followUpQuestion: parsed.followUpQuestion,
        totalLegislationInPack: legislation.length,
        totalPrecedentsInPack: precedents.length,
        disclaimer: "Bu detaylar kaynak kayıtlarına dayanmaktadır; nihai hukuki yorum değildir."
      };
    }
  };
}

export function registerMedicalLegalTools(
  server: McpServer,
  service = new DoktorMcpInformationService()
): void {
  const handlers = createMedicalLegalToolHandlers(service);

  server.registerTool("classify_medical_legal_question", {
    description: "Classifies a doktor legal information question for source mapping.",
    inputSchema: legislationQuestionSchema.shape
  }, async (input) => jsonResult(await handlers.classify_medical_legal_question(input)));

  server.registerTool("search_health_legislation", {
    description: "Searches health-related official legislation provisions through the adapter layer.",
    inputSchema: legislationQuestionSchema.shape
  }, async (input) => jsonResult(await handlers.search_health_legislation(input)));

  server.registerTool("get_legislation_provisions", {
    description: "Returns verbatim official legislation provisions by document id.",
    inputSchema: provisionIdsSchema.shape
  }, async (input) => jsonResult(await handlers.get_legislation_provisions(input)));

  server.registerTool("search_health_precedents", {
    description: "Searches high court precedent candidates. Live mode uses live Yargitay and Danistay sources; AYM stays disabled outside mock mode.",
    inputSchema: legislationQuestionSchema.shape
  }, async (input) => jsonResult(await handlers.search_health_precedents(input)));

  server.registerTool("filter_reasoned_precedents", {
    description: "Classifies precedent candidates by full text, reasoning, and relevance.",
    inputSchema: decisionsSchema.shape
  }, async (input) => jsonResult(await handlers.filter_reasoned_precedents(input)));

  server.registerTool("prepare_doctor_legal_information_pack", {
    description: "Prepares a source-grounded doktor legal information pack without a final legal opinion.",
    inputSchema: packInputSchema.shape
  }, async (input) => jsonResult(await handlers.prepare_doctor_legal_information_pack(input)));

  server.registerTool("drill_down_pack_item", {
    description: "Drill-down into a specific provision or precedent from a previously prepared doctor legal information pack. Matches the follow-up question against pack items.",
    inputSchema: drillDownSchema.shape
  }, async (input) => jsonResult(await handlers.drill_down_pack_item(input)));
}
