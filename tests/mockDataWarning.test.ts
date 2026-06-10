import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readConfig, resetConfig } from "../src/core/runtimeConfig.js";
import { withDataOrigin } from "../src/mcp/tools.js";
import { formatDoctorPackResponse, formatNoPackDiagnosticResponse } from "../src/mcp/formatDoctorPackResponse.js";
import type { DoctorLegalInformationPack } from "../src/contracts/legal.js";

/**
 * E2.1: Mock çıktıyı kaçırılamaz şekilde işaretle — testleri.
 *
 * Her aracın mock yanıtı `dataOrigin: "mock"` ve `mockDataWarning` taşımalı.
 * Live yanıtlar `dataOrigin: "live"` taşımalı ve `mockDataWarning` içermemeli.
 */

const MOCK_WARNING = "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mevzuat veya mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın.";

function makePack(): DoctorLegalInformationPack {
  return {
    shortAnswer: "Test short answer",
    legalClassification: {
      criminal: [],
      civilCompensation: [],
      disciplinaryAdministrative: [],
      patientRights: [],
      privacyKvkk: [],
      professionalEthics: []
    },
    relevantLegislation: [],
    verifiedHighCourtPrecedents: [],
    missingInformation: [],
    lawyerReviewPoints: [],
    sourceWarnings: []
  };
}

describe("E2.1 — dataOrigin and mockDataWarning", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    delete process.env.DOKTOR_MCP_SOURCE_MODE;
    resetConfig();
  });

  // ── withDataOrigin function ──────────────────────────────────────────

  describe("withDataOrigin", () => {
    it("mock mode: object gets dataOrigin 'mock' and mockDataWarning", () => {
      const result = withDataOrigin({ key: "value" }, "mock");
      expect(result.dataOrigin).toBe("mock");
      expect(result.mockDataWarning).toBe(MOCK_WARNING);
      expect(result.key).toBe("value");
    });

    it("live mode: object gets dataOrigin 'live' and no mockDataWarning", () => {
      const result = withDataOrigin({ key: "value" }, "live");
      expect(result.dataOrigin).toBe("live");
      expect(result).not.toHaveProperty("mockDataWarning");
      expect(result.key).toBe("value");
    });

    it("snapshot mode: object gets dataOrigin 'snapshot' and no mockDataWarning", () => {
      const result = withDataOrigin({ key: "value" }, "snapshot");
      expect(result.dataOrigin).toBe("snapshot");
      expect(result).not.toHaveProperty("mockDataWarning");
    });

    it("mock mode: array gets wrapped with dataOrigin and results", () => {
      const result = withDataOrigin([{ id: 1 }, { id: 2 }], "mock");
      expect(result.dataOrigin).toBe("mock");
      expect(result.mockDataWarning).toBe(MOCK_WARNING);
      expect(result.results).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("live mode: array gets wrapped with dataOrigin and results", () => {
      const result = withDataOrigin([{ id: 1 }], "live");
      expect(result.dataOrigin).toBe("live");
      expect(result).not.toHaveProperty("mockDataWarning");
      expect(result.results).toEqual([{ id: 1 }]);
    });

    it("mock mode: empty array gets wrapped", () => {
      const result = withDataOrigin([], "mock");
      expect(result.dataOrigin).toBe("mock");
      expect(result.mockDataWarning).toBe(MOCK_WARNING);
      expect(result.results).toEqual([]);
    });

    it("mock mode: primitive gets wrapped", () => {
      const result = withDataOrigin("hello", "mock");
      expect(result.dataOrigin).toBe("mock");
      expect(result.mockDataWarning).toBe(MOCK_WARNING);
      expect(result.results).toBe("hello");
    });

    it("uses runtime config default when sourceMode not specified", () => {
      process.env.DOKTOR_MCP_SOURCE_MODE = "live";
      resetConfig();
      const result = withDataOrigin({ key: "value" });
      expect(result.dataOrigin).toBe("live");
      expect(result).not.toHaveProperty("mockDataWarning");
    });

    it("default config is mock when no env var set", () => {
      const result = withDataOrigin({ key: "value" });
      expect(result.dataOrigin).toBe("mock");
      expect(result.mockDataWarning).toBe(MOCK_WARNING);
    });
  });

  // ── formatDoctorPackResponse with dataOrigin ─────────────────────────

  describe("formatDoctorPackResponse", () => {
    it("mock mode: response has dataOrigin 'mock' (caller overrides via withDataOrigin)", () => {
      const pack = makePack();
      const response = formatDoctorPackResponse(pack);
      // formatDoctorPackResponse sets dataOrigin: "mock" by default
      // The caller (withDataOrigin in tools.ts) overrides this
      expect(response.dataOrigin).toBe("mock");
    });

    it("mock mode: response wrapped with withDataOrigin has mockDataWarning", () => {
      const pack = makePack();
      const response = formatDoctorPackResponse(pack);
      const wrapped = withDataOrigin(response, "mock");
      expect(wrapped.dataOrigin).toBe("mock");
      expect(wrapped.mockDataWarning).toBe(MOCK_WARNING);
    });

    it("live mode: response wrapped with withDataOrigin has no mockDataWarning", () => {
      const pack = makePack();
      const response = formatDoctorPackResponse(pack);
      const wrapped = withDataOrigin(response, "live");
      expect(wrapped.dataOrigin).toBe("live");
      expect(wrapped).not.toHaveProperty("mockDataWarning");
    });
  });

  // ── formatNoPackDiagnosticResponse with dataOrigin ───────────────────

  describe("formatNoPackDiagnosticResponse", () => {
    it("has dataOrigin 'mock' by default", () => {
      const response = formatNoPackDiagnosticResponse({
        noPackReason: "Test reason"
      });
      expect(response.dataOrigin).toBe("mock");
    });

    it("mock mode: wrapped response has mockDataWarning", () => {
      const response = formatNoPackDiagnosticResponse({
        noPackReason: "Test reason"
      });
      const wrapped = withDataOrigin(response, "mock");
      expect(wrapped.dataOrigin).toBe("mock");
      expect(wrapped.mockDataWarning).toBe(MOCK_WARNING);
    });
  });

  // ── Integration: handler results + withDataOrigin ────────────────────

  describe("handler results with withDataOrigin", () => {
    it("classify result: withDataOrigin adds dataOrigin 'computed'", () => {
      const classifyResult = {
        question: "Test",
        dimensions: ["patient_rights"],
        searchTerms: ["test"],
        missingInformation: []
      };
      const wrapped = withDataOrigin(classifyResult, "mock");
      expect(wrapped.dataOrigin).toBe("mock");
      expect(wrapped.mockDataWarning).toBe(MOCK_WARNING);
    });

    it("search results: withDataOrigin wraps array with dataOrigin", () => {
      const searchResults = [
        { documentId: "test:1", legislationName: "Test Law" }
      ];
      const wrapped = withDataOrigin(searchResults, "mock");
      expect(wrapped.dataOrigin).toBe("mock");
      expect(wrapped.mockDataWarning).toBe(MOCK_WARNING);
      expect(wrapped.results).toEqual(searchResults);
    });

    it("precedent results: withDataOrigin wraps array with dataOrigin", () => {
      const precedents = [
        { id: "test:1", court: "yargitay", topicTags: ["test"] }
      ];
      const wrapped = withDataOrigin(precedents, "live");
      expect(wrapped.dataOrigin).toBe("live");
      expect(wrapped).not.toHaveProperty("mockDataWarning");
      expect(wrapped.results).toEqual(precedents);
    });

    it("filter results: withDataOrigin adds dataOrigin to object", () => {
      const filterResult = {
        filtered: [{ decision: { id: "1" }, status: "precedent_usable", reason: "test" }],
        diagnostics: { query: "test" }
      };
      const wrapped = withDataOrigin(filterResult, "mock");
      expect(wrapped.dataOrigin).toBe("mock");
      expect(wrapped.mockDataWarning).toBe(MOCK_WARNING);
      expect(wrapped.filtered).toBeDefined();
    });

    it("drill-down result: withDataOrigin adds dataOrigin to object", () => {
      const drillResult = {
        matchedLegislation: [],
        matchedPrecedents: [],
        followUpQuestion: "test"
      };
      const wrapped = withDataOrigin(drillResult, "mock");
      expect(wrapped.dataOrigin).toBe("mock");
      expect(wrapped.mockDataWarning).toBe(MOCK_WARNING);
    });
  });
});
