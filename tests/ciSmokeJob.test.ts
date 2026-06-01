import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("T27.4 — CI'a canlı-opsiyonel eksen smoke job'u", () => {
  it("ci:axis-e2e script exists in package.json", async () => {
    const pkg = await import("../package.json", { with: { type: "json" } });
    const scripts = pkg.default?.scripts ?? pkg.scripts;
    expect(scripts["ci:axis-e2e"]).toBeDefined();
  });

  it("CI smoke CLI script file exists", () => {
    const path = join(process.cwd(), "src", "ciAxisSmokeCli.ts");
    expect(existsSync(path)).toBe(true);
  });

  it("recorded fixture test files exist for network-free CI", () => {
    expect(existsSync(join(process.cwd(), "tests", "recordedFixtureE2E.test.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "axisE2EPack.test.ts"))).toBe(true);
  });
});
