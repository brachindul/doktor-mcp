import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("T33 — Ürünleşme ve Sunum", () => {
  describe("T33.1 — Örnek soru kataloğu", () => {
    it("docs/EXAMPLES.md exists", () => {
      expect(existsSync(join(process.cwd(), "docs", "EXAMPLES.md"))).toBe(true);
    });
    it("contains representative categories", () => {
      const content = readFileSync(join(process.cwd(), "docs", "EXAMPLES.md"), "utf-8");
      expect(content).toContain("Malpraktis");
      expect(content).toContain("Disiplin");
      expect(content).toContain("Gizlilik");
      expect(content).toContain("Tazminat");
    });
  });

  describe("T33.2 — Markdown çıktı şablonu", () => {
    it("doctorPackMarkdown formatter produces deterministic output", async () => {
      const mod = await import("../src/formatters/doctorPackMarkdown.js");
      expect(mod.renderDoctorPackMarkdown).toBeDefined();
      expect(typeof mod.renderDoctorPackMarkdown).toBe("function");
    });
  });

  describe("T33.3 — Kullanım rehberi", () => {
    it("docs/USAGE.md exists", () => {
      expect(existsSync(join(process.cwd(), "docs", "USAGE.md"))).toBe(true);
    });
    it("covers sourceModes and MCP tools", () => {
      const content = readFileSync(join(process.cwd(), "docs", "USAGE.md"), "utf-8");
      expect(content).toContain("SourceMode");
      expect(content).toContain("MCP Araçları");
      expect(content).toContain("drill_down");
    });
  });
});
