/**
 * tests/publicPhysicianRouting.test.ts
 *
 * v0.23.1 — Public-physician query routing regression tests
 *
 * Verifies that common public-physician query patterns correctly route
 * to their primary regulation categories. No network, no file I/O.
 */

import { describe, it, expect } from "vitest";
import { routeMedicalIssue } from "../src/medicalIssueRouter.js";
import { DoktorMcpInformationService } from "../src/app/service.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function routeIds(question: string): string[] {
  return routeMedicalIssue(question).routes.map((r) => r.issueId);
}

function primaryId(question: string): string | null {
  return routeMedicalIssue(question).primaryIssueId;
}

// ─── 1. Pure router tests (no network) ────────────────────────────────────────

describe("public physician query routing", () => {
  it("should route 'tayin talebim reddedildi' to public_employment", () => {
    const result = routeMedicalIssue("tayin talebim reddedildi ne yapmalıyım");
    expect(routeIds("tayin talebim reddedildi ne yapmalıyım")).toContain("public_employment");
    expect(primaryId("tayin talebim reddedildi ne yapmalıyım")).toBe("public_employment");
  });

  it("should route 'hakkımda disiplin soruşturması açıldı' to disciplinary_admin", () => {
    const result = routeMedicalIssue("hakkımda disiplin soruşturması açıldı");
    expect(routeIds("hakkımda disiplin soruşturması açıldı")).toContain("disciplinary_admin");
    expect(primaryId("hakkımda disiplin soruşturması açıldı")).toBe("disciplinary_admin");
  });

  it("should route 'ek ödeme yapılmadı' to public_employment", () => {
    const result = routeMedicalIssue("döner sermaye ek ödeme yapılmadı ne yapabilirim");
    expect(routeIds("döner sermaye ek ödeme yapılmadı ne yapabilirim")).toContain("public_employment");
  });

  it("should route 'mecburi hizmet' to public_employment", () => {
    const result = routeMedicalIssue("mecburi hizmet süresi doldu tayin isteyebilir miyim");
    expect(routeIds("mecburi hizmet süresi doldu tayin isteyebilir miyim")).toContain("public_employment");
  });
});

// ─── 2. Router score confidence checks ────────────────────────────────────────

describe("public physician routing — confidence levels", () => {
  it("tayin phrase match should be medium or high confidence", () => {
    const result = routeMedicalIssue("tayin talebim reddedildi ne yapmalıyım");
    const route = result.routes.find((r) => r.issueId === "public_employment");
    expect(route).toBeDefined();
    // Phrase "tayin talebim reddedildi" (+3) + term "tayin" is already covered
    // → score 3 = medium confidence
    expect(route!.score).toBeGreaterThanOrEqual(3);
    expect(["medium", "high"]).toContain(route!.confidence);
  });

  it("tayin + nakil combined query should be high confidence", () => {
    const result = routeMedicalIssue("tayin nakil talebi reddedildi yer değiştirme");
    const route = result.routes.find((r) => r.issueId === "public_employment");
    expect(route).toBeDefined();
    expect(route!.confidence).toBe("high");
  });

  it("disiplin phrase match should be high confidence", () => {
    const result = routeMedicalIssue("disiplin soruşturması açıldı");
    const route = result.routes.find((r) => r.issueId === "disciplinary_admin");
    expect(route).toBeDefined();
    expect(route!.confidence).toBe("high");
  });

  it("ek ödeme phrase match should score high", () => {
    const result = routeMedicalIssue("ek ödeme yapılmadı ne yapmalıyım");
    const route = result.routes.find((r) => r.issueId === "public_employment");
    expect(route).toBeDefined();
    expect(route!.score).toBeGreaterThanOrEqual(3);
  });

  it("mecburi hizmet phrase match should score high", () => {
    const result = routeMedicalIssue("mecburi hizmet süresi doldu");
    const route = result.routes.find((r) => r.issueId === "public_employment");
    expect(route).toBeDefined();
    expect(route!.score).toBeGreaterThanOrEqual(3);
  });
});

// ─── 3. Live pack regression (mock mode) ─────────────────────────────────────

describe("public physician query routing — mock pack regression", () => {
  it("tayin query should return legislation in mock pack and route to public_employment", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi ne yapmalıyım",
      sourceMode: "mock",
    });
    // Legislation should be returned (mock always returns at least some provisions)
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    // The router should identify public_employment as the primary issue
    const routerResult = routeMedicalIssue("tayin talebim reddedildi ne yapmalıyım");
    expect(routerResult.primaryIssueId).toBe("public_employment");
    // Router's suggested topic clusters should include public_employment
    expect(routerResult.routes[0].suggestedTopicClusters).toContain("public_employment");
  });

  it("discipline query should route to disciplinary issue type", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hakkımda disiplin soruşturması açıldı haklarım nelerdir",
      sourceMode: "mock",
    });
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const classifications = pack.legalClassification?.disciplinaryAdministrative ?? [];
    expect(classifications.length).toBeGreaterThan(0);
  });

  it("ek ödeme query should route to public_employment and return legislation", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "döner sermaye ek ödeme yapılmadı ne yapabilirim",
      sourceMode: "mock",
    });
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const routerResult = routeMedicalIssue("döner sermaye ek ödeme yapılmadı ne yapabilirim");
    expect(routerResult.primaryIssueId).toBe("public_employment");
  });

  it("mecburi hizmet query should route to public_employment and return legislation", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "mecburi hizmet süresi doldu tayin isteyebilir miyim",
      sourceMode: "mock",
    });
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const routerResult = routeMedicalIssue("mecburi hizmet süresi doldu tayin isteyebilir miyim");
    expect(routerResult.primaryIssueId).toBe("public_employment");
  });
});
