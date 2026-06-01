import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("T26.1 — Tam güvenlik denetim turu", () => {
  const reviewPath = join(process.cwd(), "docs", "SECURITY_REVIEW.md");

  it("SECURITY_REVIEW.md exists", () => {
    expect(existsSync(reviewPath)).toBe(true);
  });

  it("SECURITY_REVIEW.md covers SSRF section", () => {
    const content = readFileSync(reviewPath, "utf-8");
    expect(content).toContain("SSRF");
    expect(content).toContain("mevzuat.gov.tr");
  });

  it("SECURITY_REVIEW.md covers PII section", () => {
    const content = readFileSync(reviewPath, "utf-8");
    expect(content).toContain("PII");
    expect(content).toContain("no PII");
  });

  it("SECURITY_REVIEW.md covers output safety section", () => {
    const content = readFileSync(reviewPath, "utf-8");
    expect(content).toContain("Output Safety");
    expect(content).toContain("Hard-Blocked");
  });

  it("SECURITY_REVIEW.md covers dependency audit section", () => {
    const content = readFileSync(reviewPath, "utf-8");
    expect(content).toContain("Dependency");
    expect(content).toContain("MIT license");
  });

  it("SECURITY_REVIEW.md has overall low-risk status", () => {
    const content = readFileSync(reviewPath, "utf-8");
    expect(content).toContain("No critical findings");
    expect(content).toMatch(/Overall.*Low/);
  });
});
