import { describe, expect, it } from "vitest";
import { registerMedicalLegalTools } from "../src/mcp/tools.js";

/**
 * E3.1 — Tool descriptions must be LLM-guiding:
 *  - All descriptions non-empty
 *  - prepare_doctor_legal_information_pack mentions "PRIMARY"
 *  - Every granular tool includes "prefer prepare_doctor_legal_information_pack"
 */

interface CapturedTool {
  name: string;
  description: string;
}

function captureTools(): CapturedTool[] {
  const captured: CapturedTool[] = [];
  const fakeServer = {
    registerTool(
      name: string,
      config: { description?: string; inputSchema?: unknown },
      _handler?: unknown
    ) {
      captured.push({ name, description: config.description ?? "" });
    },
  } as any;
  registerMedicalLegalTools(fakeServer);
  return captured;
}

describe("E3.1 — Tool descriptions are LLM-guiding", () => {
  const tools = captureTools();

  it("registers all 8 tools", () => {
    expect(tools.length).toBe(8);
  });

  it("every tool has a non-empty description", () => {
    for (const t of tools) {
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(t.name).toBeTruthy();
    }
  });

  it("prepare_doctor_legal_information_pack description contains 'PRIMARY' (case-insensitive)", () => {
    const pack = tools.find((t) => t.name === "prepare_doctor_legal_information_pack")!;
    expect(pack).toBeDefined();
    expect(pack.description.toLowerCase()).toContain("primary");
  });

  it("drill_down_pack_item description mentions follow-up / ONLY after pack", () => {
    const drill = tools.find((t) => t.name === "drill_down_pack_item")!;
    expect(drill).toBeDefined();
    expect(drill.description.toLowerCase()).toMatch(/follow-up|only after prepare/);
  });

  it("every granular tool points to prepare_doctor_legal_information_pack as preferred", () => {
    const granular = [
      "classify_medical_legal_question",
      "search_health_legislation",
      "get_legislation_provisions",
      "search_health_precedents",
      "filter_reasoned_precedents",
    ];
    for (const name of granular) {
      const t = tools.find((x) => x.name === name)!;
      expect(t).toBeDefined();
      expect(t.description).toContain("prefer prepare_doctor_legal_information_pack");
    }
  });

  it("all descriptions include at least one example (curly-brace JSON snippet)", () => {
    for (const t of tools) {
      expect(t.description).toContain("{");
      expect(t.description).toContain("}");
    }
  });
});
