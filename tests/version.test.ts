import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import pkg from "../package.json" with { type: "json" };
import { VERSION } from "../src/core/version.js";

describe("version", () => {
  it("should match package.json version", () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toBe("0.47.0");
  });

  it("should be a non-empty string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it("should match the top changelog entry", () => {
    const changelogPath = join(process.cwd(), "CHANGELOG.md");
    const changelog = readFileSync(changelogPath, "utf-8");
    // Extract the first version header: ## [X.Y.Z]
    const match = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m);
    expect(match).not.toBeNull();
    const changelogVersion = match![1];
    expect(pkg.version).toBe(changelogVersion);
    expect(VERSION).toBe(changelogVersion);
  });
});
