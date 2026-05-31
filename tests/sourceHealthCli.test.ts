import { describe, it, expect } from "vitest";
describe("source health CLI", () => {
  it("should have health:sources script in package.json", () => {
    const pkg = require("../package.json");
    expect(pkg.scripts["health:sources"]).toBeDefined();
  });
});
