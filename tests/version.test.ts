import { describe, it, expect } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { VERSION } from "../src/core/version.js";

describe("version", () => {
  it("should match package.json version", () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toBe("0.43.0");
  });

  it("should be a non-empty string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
