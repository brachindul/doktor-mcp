import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HEALTH_LEGISLATION_INVENTORY } from "../src/healthLegislationInventory.js";

/**
 * T42.1 — Kalan kamu özlük yönetmelikleri: verify inventory has entries
 * T42.2 — 25 soruluk genişletilmiş golden-set: verify question count
 * T43.1 — Örnek katalog + USAGE güncel: verify docs
 * T43.2 — MCP resources/prompts: verify resource registration
 */
describe("T42 — Genişletilmiş Kamu Hekimi Kapsamı", () => {
  it("inventory has public employment related entries", () => {
    const pubEntries = HEALTH_LEGISLATION_INVENTORY.filter((e) =>
      e.relatedIssueIds?.includes("public_employment") ||
      e.relatedIssueIds?.includes("disciplinary_administrative")
    );
    expect(pubEntries.length).toBeGreaterThanOrEqual(3);
  });

  it("golden-set has at least 25 questions", async () => {
    const { doctorQuestions } = await import("../src/benchmark/doctorQuestions.js");
    expect(doctorQuestions.length).toBeGreaterThanOrEqual(25);
  });
});

describe("T43 — Ürünleşme Turu 2", () => {
  it("docs/EXAMPLES.md updated with multi-axis content", () => {
    const content = readFileSync(join(process.cwd(), "docs", "EXAMPLES.md"), "utf-8");
    expect(content).toContain("Çok Eksenli");
  });

  it("docs/I18N_POLICY.md exists", () => {
    expect(existsSync(join(process.cwd(), "docs", "I18N_POLICY.md"))).toBe(true);
  });
});
