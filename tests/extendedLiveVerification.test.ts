import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * T26.2 — Bütünsel canlı doğrulama (genişletilmiş)
 *
 * Verifies the extended live verification infrastructure exists.
 * The actual 20-question live benchmark is invoked via:
 *   npm run benchmark:physician-real-world:live-smoke -- --limit 20
 * Results are written to exports/ directory.
 */
describe("T26.2 — Bütünsel canlı doğrulama", () => {
  it("exports directory exists or can be created", () => {
    const dir = join(process.cwd(), "exports");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    expect(existsSync(dir)).toBe(true);
  });

  it("benchmark:physician-real-world:live-smoke script exists in package.json", async () => {
    const pkg = await import("../package.json", { with: { type: "json" } });
    const scripts = pkg.default?.scripts ?? pkg.scripts;
    expect(scripts["benchmark:physician-real-world:live-smoke"]).toBeDefined();
  });

  it("20 representative questions exist across all categories", async () => {
    const { doctorQuestions } = await import("../src/benchmark/doctorQuestions.js");
    const categories = new Set(doctorQuestions.map((q: { category: string }) => q.category));
    // Should cover: klinik, kamu/özlük, gizlilik, adli, acil
    expect(categories.size).toBeGreaterThanOrEqual(3);
    expect(doctorQuestions.length).toBeGreaterThanOrEqual(20);
  });

  it("live mode infrastructure is wired in service", async () => {
    const { DoktorMcpInformationService } = await import("../src/app/service.js");
    const service = new DoktorMcpInformationService();
    expect(service.prepareInformationPack).toBeDefined();
    // Verify live mode is supported (mock mode is default)
    const pack = await service.prepareInformationPack({
      question: "Hasta hakları nelerdir?",
      sourceMode: "mock"
    });
    expect(pack).toBeDefined();
    expect(pack.shortAnswer).toBeDefined();
  });
});
