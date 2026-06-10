import { describe, expect, it } from "vitest";
import { createMedicalLegalToolHandlers } from "../src/mcp/tools.js";
import { courtDecisionSchema, doctorLegalInformationPackSchema } from "../src/mcp/schemas.js";
import type { CourtDecision, DoctorLegalInformationPack } from "../src/contracts/legal.js";

describe("E0.2 — Zod schema validation (no more z.custom without validator)", () => {
  const handlers = createMedicalLegalToolHandlers();

  // ── courtDecisionSchema unit tests ──────────────────────────────────

  describe("courtDecisionSchema", () => {
    it("rejects an object missing required fields (id, court, evidence)", () => {
      const result = courtDecisionSchema.safeParse({ foo: "bar" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join("."));
        expect(paths).toContain("id");
        expect(paths).toContain("court");
        expect(paths).toContain("evidence");
      }
    });

    it("accepts a minimal valid decision with required fields only", () => {
      const result = courtDecisionSchema.safeParse({
        id: "1",
        court: "yargitay",
        evidence: { source: "yargitay", documentId: "doc-1" }
      });
      expect(result.success).toBe(true);
    });

    it("accepts a full decision with optional pipeline fields", () => {
      const result = courtDecisionSchema.safeParse({
        id: "2",
        court: "danistay",
        chamber: "10. Daire",
        decisionDate: "2023-06-15",
        meritsNumber: "2022/1234",
        decisionNumber: "2023/567",
        legalReasoning: "Mahkemece ...",
        outcome: "Kabul",
        relevanceNote: "Sağlık hukuku ile ilgili",
        topicTags: ["malpraktis", "tazminat"],
        fullText: "Tam karar metni burada...",
        evidence: { source: "danistay", documentId: "doc-2", retrievedAt: "2023-07-01", official: true, fullText: true }
      });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid court value", () => {
      const result = courtDecisionSchema.safeParse({
        id: "3",
        court: "supreme_court",
        evidence: { source: "yargitay", documentId: "doc-3" }
      });
      expect(result.success).toBe(false);
    });

    it("allows extra (passthrough) fields without rejection", () => {
      const result = courtDecisionSchema.safeParse({
        id: "4",
        court: "yargitay",
        evidence: { source: "yargitay", documentId: "doc-4" },
        extraField: "should pass through",
        nested: { a: 1 }
      });
      expect(result.success).toBe(true);
    });

    it("allows extra fields on evidence (passthrough)", () => {
      const result = courtDecisionSchema.safeParse({
        id: "5",
        court: "yargitay",
        evidence: { source: "yargitay", documentId: "doc-5", accessTimestamp: "2023-01-01", retrievalMethod: "api" }
      });
      expect(result.success).toBe(true);
    });
  });

  // ── doctorLegalInformationPackSchema unit tests ─────────────────────

  describe("doctorLegalInformationPackSchema", () => {
    it("rejects an object missing required top-level fields", () => {
      const result = doctorLegalInformationPackSchema.safeParse({ shortAnswer: "hi" });
      expect(result.success).toBe(false);
    });

    it("accepts a valid pack with minimal legislation and precedents", () => {
      const pack: DoctorLegalInformationPack = {
        shortAnswer: "Test",
        legalClassification: {
          criminal: "", civilCompensation: "", disciplinaryAdministrative: "",
          patientRights: "", privacyKvkk: "", professionalEthics: ""
        },
        relevantLegislation: [
          { legislationName: "TKK", articleNumber: "86", verbatimQuote: "...", connection: "c", sourceDocumentId: "1" }
        ],
        verifiedHighCourtPrecedents: [
          { id: "p1", court: "yargitay", evidence: { source: "yargitay", documentId: "d1" }, topicTags: [] }
        ],
        missingInformation: [],
        lawyerReviewPoints: [],
        sourceWarnings: []
      };
      const result = doctorLegalInformationPackSchema.safeParse(pack);
      expect(result.success).toBe(true);
    });

    it("rejects pack with empty relevantLegislation (must be array)", () => {
      const result = doctorLegalInformationPackSchema.safeParse({
        shortAnswer: "Test",
        legalClassification: { criminal: "", civilCompensation: "", disciplinaryAdministrative: "", patientRights: "", privacyKvkk: "", professionalEthics: "" },
        relevantLegislation: "not_an_array",
        verifiedHighCourtPrecedents: [],
        missingInformation: [],
        lawyerReviewPoints: [],
        sourceWarnings: []
      });
      expect(result.success).toBe(false);
    });
  });

  // ── filter_reasoned_precedents handler integration ──────────────────

  describe("filter_reasoned_precedents handler", () => {
    it("returns structured invalid_input error for broken decisions", async () => {
      const result = await handlers.filter_reasoned_precedents({
        decisions: [{ foo: "bar" }]
      });
      expect(result).toHaveProperty("ok", false);
      expect(result).toHaveProperty("errorCode", "invalid_input");
      expect(result).toHaveProperty("issues");
      expect(Array.isArray((result as any).issues)).toBe(true);
      expect((result as any).issues.length).toBeGreaterThan(0);
    });

    it("returns structured invalid_input error for missing decisions array", async () => {
      const result = await handlers.filter_reasoned_precedents({
        query: "test"
      });
      expect(result).toHaveProperty("ok", false);
      expect(result).toHaveProperty("errorCode", "invalid_input");
    });

    it("processes valid decisions as before (no exception thrown)", async () => {
      const result = await handlers.filter_reasoned_precedents({
        decisions: [
          {
            id: "d1",
            court: "yargitay",
            topicTags: ["test"],
            evidence: { source: "yargitay", documentId: "doc-1", retrievedAt: "2023-01-01", official: true, fullText: true },
            fullText: "Bu bir test karardır.",
            legalReasoning: "Hukuki gerekçe mevcut.",
            outcome: "Kabul",
            relevanceNote: "Sağlık hukuku ile bağlantılı."
          }
        ],
        query: "test query"
      });
      // Should have filtered and diagnostics, not an error
      expect(result).toHaveProperty("filtered");
      expect(result).toHaveProperty("diagnostics");
      expect((result as any).ok).toBeUndefined();
    });
  });

  // ── drill_down_pack_item handler integration ────────────────────────

  describe("drill_down_pack_item handler", () => {
    it("returns structured invalid_input error for broken pack", async () => {
      const result = await handlers.drill_down_pack_item({
        pack: { not: "a valid pack" },
        followUpQuestion: "test?"
      });
      expect(result).toHaveProperty("ok", false);
      expect(result).toHaveProperty("errorCode", "invalid_input");
      expect(result).toHaveProperty("issues");
    });

    it("processes valid pack as before (no exception thrown)", async () => {
      const result = await handlers.drill_down_pack_item({
        pack: {
          shortAnswer: "Test",
          legalClassification: { criminal: "", civilCompensation: "", disciplinaryAdministrative: "", patientRights: "", privacyKvkk: "", professionalEthics: "" },
          relevantLegislation: [
            { legislationName: "TKK", articleNumber: "86", verbatimQuote: "...", connection: "c", sourceDocumentId: "1" }
          ],
          verifiedHighCourtPrecedents: [],
          missingInformation: [],
          lawyerReviewPoints: [],
          sourceWarnings: []
        },
        followUpQuestion: "86. madde ne diyor?"
      });
      expect(result).toHaveProperty("matchedLegislation");
      expect(result).toHaveProperty("matchedPrecedents");
      expect((result as any).ok).toBeUndefined();
    });
  });
});
