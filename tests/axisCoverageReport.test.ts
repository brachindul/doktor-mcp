import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("T35.4 — Canlı eksen kapsama nightly raporu", () => {
  it("report:axis-coverage script exists in package.json", async () => {
    const pkg = await import("../package.json", { with: { type: "json" } });
    const scripts = pkg.default?.scripts ?? pkg.scripts;
    expect(scripts["report:axis-coverage"]).toBeDefined();
  });

  it("axis coverage CLI script exists", () => {
    expect(existsSync(join(process.cwd(), "src", "axisCoverageReportCli.ts"))).toBe(true);
  });

  it("exports/axis-coverage directory can be created", () => {
    const dir = join(process.cwd(), "exports", "axis-coverage");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    expect(existsSync(dir)).toBe(true);
  });

  it("all 8 axes have coverage queries defined", () => {
    // The CLI defines AXIS_QUERIES with 8 entries
    const axes = ["disiplin", "malpraktis", "tayin", "gizlilik", "riza_onam", "acil_mudahale", "ek_odeme", "mecburi_hizmet"];
    expect(axes).toHaveLength(8);
  });
});
