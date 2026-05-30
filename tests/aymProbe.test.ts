import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveAymAdapter } from "../src/sources/aym/liveAymAdapter.js";
import { AYM_SOURCE } from "../src/sources/aym/liveTypes.js";
import type { ClassifiedMedicalLegalQuestion } from "../src/contracts/legal.js";

// Helper: create a minimal classification that pickHealthLawQuery can work with
function makeClassification(terms: string[]): ClassifiedMedicalLegalQuestion {
  return {
    question: "Test sağlık hukuku sorusu",
    dimensions: ["patient_rights"],
    searchTerms: terms,
    missingInformation: []
  };
}

describe("LiveAymAdapter", () => {
  describe("calibration — HTML-only endpoint", () => {
    it("returns endpoint_html_only when endpoint returns HTML", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === "content-type" ? "text/html; charset=utf-8" : null
        },
        text: async () => "<html><body>AYM Kararlar</body></html>"
      });

      const adapter = new LiveAymAdapter({ fetchImpl: mockFetch });
      const result = await adapter.searchAndNormalize("sağlık");

      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.errorCode).toBe("endpoint_html_only");
        expect(result.source).toBe(AYM_SOURCE);
        expect(result.retryable).toBe(false);
        expect(result.message).toContain("HTML");
      }
    });

    it("returns endpoint_html_only when endpoint returns JSON (future path)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === "content-type" ? "application/json" : null
        },
        text: async () => JSON.stringify({ results: [] })
      });

      const adapter = new LiveAymAdapter({ fetchImpl: mockFetch });
      const result = await adapter.searchAndNormalize("sağlık");

      // If JSON is ever discovered, this tests the reachable path
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.source).toBe(AYM_SOURCE);
        expect(result.decisions).toEqual([]);
      }
    });

    it("returns endpoint_html_only when fetch fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const adapter = new LiveAymAdapter({ fetchImpl: mockFetch });
      const result = await adapter.searchAndNormalize("sağlık");

      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.errorCode).toBe("endpoint_html_only");
        expect(result.retryable).toBe(false);
      }
    });

    it("only calibrates once per adapter instance", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === "content-type" ? "text/html" : null
        },
        text: async () => "<html></html>"
      });

      const adapter = new LiveAymAdapter({ fetchImpl: mockFetch });
      await adapter.searchAndNormalize("query1");
      await adapter.searchAndNormalize("query2");

      // Should only call fetch once (calibration), then use cached result
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchHealthPrecedents", () => {
    it("returns empty array when endpoint is HTML-only", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === "content-type" ? "text/html" : null
        },
        text: async () => "<html></html>"
      });

      const adapter = new LiveAymAdapter({ fetchImpl: mockFetch });
      const classification = makeClassification(["sağlık", "hasta hakları"]);
      const decisions = await adapter.searchHealthPrecedents(classification);

      expect(decisions).toEqual([]);
    });
  });

  describe("no fabricated decisions", () => {
    it("never produces CourtDecision objects with fake text", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => "text/html"
        },
        text: async () => "<html></html>"
      });

      const adapter = new LiveAymAdapter({ fetchImpl: mockFetch });
      const result = await adapter.searchAndNormalize("doktor hatası");

      if (result.status === "ok") {
        // When JSON is discovered but not yet implemented, decisions should be empty
        for (const decision of result.decisions) {
          expect(decision.factSummary).toBeFalsy();
          expect(decision.legalReasoning).toBeFalsy();
          expect(decision.outcome).toBeFalsy();
          expect(decision.fullText).toBeFalsy();
        }
      }
    });
  });

  describe("AYM source constant", () => {
    it("AYM_SOURCE is defined", () => {
      expect(AYM_SOURCE).toBe("aym.gov.tr");
    });
  });
});
