import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PhysicianLegalInformationService } from "../app/service.js";
import type { CourtDecision } from "../contracts/legal.js";

const questionSchema = z.object({ question: z.string().min(1) });
const provisionIdsSchema = z.object({ documentIds: z.array(z.string().min(1)).min(1) });
const decisionsSchema = z.object({ decisions: z.array(z.custom<CourtDecision>()) });

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>
  };
}

export function createMedicalLegalToolHandlers(service = new PhysicianLegalInformationService()) {
  return {
    classify_medical_legal_question: async (input: unknown) => service.classify(questionSchema.parse(input).question),
    search_health_legislation: async (input: unknown) =>
      service.searchLegislation(service.classify(questionSchema.parse(input).question)),
    get_legislation_provisions: async (input: unknown) =>
      service.getLegislationProvisions(provisionIdsSchema.parse(input).documentIds),
    search_health_precedents: async (input: unknown) =>
      service.searchPrecedents(service.classify(questionSchema.parse(input).question)),
    filter_reasoned_precedents: async (input: unknown) =>
      service.filterPrecedents(decisionsSchema.parse(input).decisions),
    prepare_doctor_legal_information_pack: async (input: unknown) =>
      service.prepareInformationPack(questionSchema.parse(input))
  };
}

export function registerMedicalLegalTools(
  server: McpServer,
  service = new PhysicianLegalInformationService()
): void {
  const handlers = createMedicalLegalToolHandlers(service);

  server.registerTool("classify_medical_legal_question", {
    description: "Classifies a physician legal information question for source mapping.",
    inputSchema: questionSchema.shape
  }, async (input) => jsonResult(await handlers.classify_medical_legal_question(input)));

  server.registerTool("search_health_legislation", {
    description: "Searches health-related official legislation provisions through the adapter layer.",
    inputSchema: questionSchema.shape
  }, async (input) => jsonResult(await handlers.search_health_legislation(input)));

  server.registerTool("get_legislation_provisions", {
    description: "Returns verbatim official legislation provisions by document id.",
    inputSchema: provisionIdsSchema.shape
  }, async (input) => jsonResult(await handlers.get_legislation_provisions(input)));

  server.registerTool("search_health_precedents", {
    description: "Searches high court precedent candidates through mock source adapters.",
    inputSchema: questionSchema.shape
  }, async (input) => jsonResult(await handlers.search_health_precedents(input)));

  server.registerTool("filter_reasoned_precedents", {
    description: "Classifies precedent candidates by full text, reasoning, and relevance.",
    inputSchema: decisionsSchema.shape
  }, async (input) => jsonResult(await handlers.filter_reasoned_precedents(input)));

  server.registerTool("prepare_doctor_legal_information_pack", {
    description: "Prepares a source-grounded physician legal information pack without a final legal opinion.",
    inputSchema: questionSchema.shape
  }, async (input) => jsonResult(await handlers.prepare_doctor_legal_information_pack(input)));
}
