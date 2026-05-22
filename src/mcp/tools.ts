import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PhysicianLegalInformationService } from "../app/service.js";
import type { CourtDecision } from "../contracts/legal.js";
import { buildPrecedentSelectionDiagnostics } from "../health/precedentFilter.js";

const sourceModeSchema = z.enum(["mock", "live"]).default("mock");
const precedentSourceSchema = z.enum(["yargitay", "danistay", "aym"]);
const questionSchema = z.object({ question: z.string().min(1) });
const legislationQuestionSchema = questionSchema.extend({ sourceMode: sourceModeSchema.optional() });
const packInputSchema = legislationQuestionSchema.extend({
  precedentSources: z.array(precedentSourceSchema).optional()
});
const provisionIdsSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
  sourceMode: sourceModeSchema.optional()
});
const decisionsSchema = z.object({
  decisions: z.array(z.custom<CourtDecision>()),
  query: z.string().optional()
});

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>
  };
}

export function createMedicalLegalToolHandlers(service = new PhysicianLegalInformationService()) {
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
    prepare_doctor_legal_information_pack: async (input: unknown) =>
      service.prepareInformationPack(packInputSchema.parse(input))
  };
}

export function registerMedicalLegalTools(
  server: McpServer,
  service = new PhysicianLegalInformationService()
): void {
  const handlers = createMedicalLegalToolHandlers(service);

  server.registerTool("classify_medical_legal_question", {
    description: "Classifies a physician legal information question for source mapping.",
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
    description: "Prepares a source-grounded physician legal information pack without a final legal opinion.",
    inputSchema: packInputSchema.shape
  }, async (input) => jsonResult(await handlers.prepare_doctor_legal_information_pack(input)));
}
