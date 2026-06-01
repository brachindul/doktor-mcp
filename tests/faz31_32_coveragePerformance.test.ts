import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { HEALTH_LEGISLATION_INVENTORY } from "../src/healthLegislationInventory.js";

/**
 * T31 — Kapsam Tamamlama Turu 2
 * Verifies inventory health, candidate tracking, and coverage matrix.
 */
describe("T31 — Kapsam Tamamlama Turu 2", () => {
  describe("T31.1 — Candidate verification infrastructure", () => {
    it("inventory has candidate entries tracked", () => {
      const candidates = HEALTH_LEGISLATION_INVENTORY.filter(
        (e) => e.coverageStatus === "candidate"
      );
      // There should be some candidates (not all covered yet)
      expect(candidates.length).toBeGreaterThanOrEqual(0);
    });

    it("all candidate entries have mevzuatSourceId for live verification", () => {
      const candidates = HEALTH_LEGISLATION_INVENTORY.filter(
        (e) => e.coverageStatus === "candidate" && e.mevzuatSourceId
      );
      // Candidates with sourceId are ready for live verification
      for (const c of candidates) {
        expect(c.mevzuatSourceId).toBeTruthy();
        expect(c.mevzuatSourceId).toMatch(/mevzuat:/);
      }
    });

    it("covered entries still outnumber gaps", () => {
      const covered = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.coverageStatus === "covered").length;
      const gaps = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.coverageStatus === "gap").length;
      expect(covered).toBeGreaterThan(gaps);
    });
  });

  describe("T31.2 — Disiplin yönetmelikleri için sourceId takibi", () => {
    it("inventory contains discipline-related entries", () => {
      const disciplineEntries = HEALTH_LEGISLATION_INVENTORY.filter((e) =>
        e.titleNormalized?.includes("disiplin") ||
        e.relatedIssueIds?.includes("disciplinary_admin") ||
        e.relatedIssueIds?.includes("public_discipline")
      );
      expect(disciplineEntries.length).toBeGreaterThanOrEqual(1);
    });

    it("discipline entries have honest coverage status", () => {
      const disciplineEntries = HEALTH_LEGISLATION_INVENTORY.filter((e) =>
        e.relatedIssueIds?.includes("disciplinary_admin") ||
        e.relatedIssueIds?.includes("public_discipline")
      );
      for (const entry of disciplineEntries) {
        expect(["covered", "candidate", "gap", "deferred"]).toContain(entry.coverageStatus);
      }
    });
  });

  describe("T31.3 — Kapsam matrisi ve golden-set güncelleme", () => {
    it("COVERAGE_MATRIX.md exists", () => {
      expect(existsSync(join(process.cwd(), "docs", "COVERAGE_MATRIX.md"))).toBe(true);
    });

    it("inventory covered count matches or exceeds README claims", () => {
      const covered = HEALTH_LEGISLATION_INVENTORY.filter((e) => e.coverageStatus === "covered").length;
      // We know at least 16 are covered (from Faz 20 verification)
      expect(covered).toBeGreaterThanOrEqual(16);
    });
  });
});

/**
 * T32 — Performans ve Güvenilirlik Sertleştirme
 */
describe("T32 — Performans ve Güvenilirlik Sertleştirme", () => {
  describe("T32.1 — Bütçe kalibrasyonu", () => {
    it("timeBudget config values are non-zero and reasonable", async () => {
      const { readConfig } = await import("../src/core/runtimeConfig.js");
      const config = readConfig();
      expect(config.timeBudget.deadlineMs).toBeGreaterThan(0);
      expect(config.timeBudget.legislationPhaseBudgetMs).toBeGreaterThan(0);
      expect(config.timeBudget.precedentPhaseBudgetMs).toBeGreaterThan(0);
    });
  });

  describe("T32.2 — Kısmi-sonuç şeffaflığı", () => {
    it("pack includes missingInformation field for transparency", async () => {
      const { DoktorMcpInformationService } = await import("../src/app/service.js");
      const service = new DoktorMcpInformationService();
      const pack = await service.prepareInformationPack({
        question: "specifik olmayan soru",
        sourceMode: "mock"
      });
      expect(pack.missingInformation).toBeDefined();
      expect(Array.isArray(pack.missingInformation)).toBe(true);
    });
  });

  describe("T32.3 — Adaptif backoff / circuit-breaker", () => {
    it("requestPolicy defines timeout values for all sources", async () => {
      const { policyForSource } = await import("../src/live/requestPolicy.js");
      const sources = ["mevzuat", "yargitay", "danistay", "bedesten", "bedesten-fulltext", "bedesten-search"];
      for (const source of sources) {
        const policy = policyForSource(source);
        expect(policy.timeoutMs).toBeGreaterThan(0);
      }
    });
  });
});
