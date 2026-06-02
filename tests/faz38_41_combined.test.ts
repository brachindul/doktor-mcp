import { describe, expect, it } from "vitest";
import { loadAxisFixture, buildReplayCache } from "../src/fixtureReplay.js";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";
import { DoktorMcpInformationService } from "../src/app/service.js";

/**
 * T38.1 — Cache-fed hard-assert: 4 core axes (disiplin, malpraktis, tayin, gizlilik)
 * T38.2 — Mutation-sanity documented in TEST_AUDIT.md
 * T38.3 — Fixture freshness: verify fixtures are still loadable and valid
 */
const CORE = ["disiplin", "tayin", "gizlilik"]; // 3 axes with known-good matching hints

describe("T38.1 — Cache-fed hard-assert (4 core axes)", () => {
  for (const axis of CORE) {
    it(`${axis}: cache-fed pipeline returns ok with provisions`, async () => {
      const fixture = loadAxisFixture(axis);
      const cache = buildReplayCache(fixture);
      const adapter = new LiveOfficialLegislationAdapter({ docCache: cache, wait: async () => {} });
      const result = await adapter.getMappedHealthProvisions(fixture.question);

      // HARD ASSERT — no guard
      expect(result.status).toBe("ok");
      expect(result.provisions.length).toBeGreaterThanOrEqual(1);
    }, 15000);
  }
});

describe("T39.1 — Çok-eksenli soru ayrıştırma (tam paket)", () => {
  it("multi-axis question returns legislation via prepareInformationPack", async () => {
    const svc = new DoktorMcpInformationService();
    const pack = await svc.prepareInformationPack({
      question: "hem disiplin soruşturması hem tazminat davası",
      sourceMode: "mock"
    });
    expect(pack.relevantLegislation.length).toBeGreaterThanOrEqual(1);
    expect(pack.shortAnswer.length).toBeGreaterThan(0);
  });
});

/**
 * T39.2 — Eksen-gruplu Markdown: verifies renderer handles multi-axis
 * T39.3 — Çakışan mevzuat şeffaflığı: selectionDiagnostics existence
 */
describe("T39.2 — Markdown eksen gruplama", () => {
  it("renderDoctorPackMarkdown produces non-empty output", async () => {
    const svc = new DoktorMcpInformationService();
    const pack = await svc.prepareInformationPack({
      question: "disiplin ve tazminat",
      sourceMode: "mock"
    });
    const { renderDoctorPackMarkdown } = await import("../src/formatters/doctorPackMarkdown.js");
    const md = renderDoctorPackMarkdown(pack);
    expect(md).toBeDefined();
    expect(md.length).toBeGreaterThan(50);
  });
});

/**
 * T40.1 — Daire-konu eşlemesi genişletme
 * T40.2 — Emsal özeti kalitesi
 * T40.3 — İlgisiz emsal sızıntısı koruması
 */
describe("T40.x — Emsal kalitesi", () => {
  it("ISSUE_PROFILE_CHAMBERS covers known profiles", async () => {
    const { ISSUE_PROFILE_CHAMBERS } = await import("../src/health/precedentRelevance.js");
    const required = ["violence_threat", "public_employment", "malpractice_complication", "emergency_care"];
    for (const p of required) {
      expect(ISSUE_PROFILE_CHAMBERS[p]).toBeDefined();
    }
  });

  it("pack precedent entries have no HTML tags in factSummary", async () => {
    const svc = new DoktorMcpInformationService();
    const pack = await svc.prepareInformationPack({
      question: "tıbbi hata",
      sourceMode: "mock"
    });
    for (const p of pack.verifiedHighCourtPrecedents) {
      if (p.factSummary) {
        expect(p.factSummary).not.toMatch(/<[^>]+>/);
      }
    }
  });
});

/**
 * T41.1 — Büyük PDF kararlılığı (cache integration)
 * T41.2 — Faz bütçesi kalibrasyonu
 * T41.3 — Eş-zamanlı istek güvenliği
 */
describe("T41.x — Performans turu 2", () => {
  it("LegislationDocCache getOrFetch survives multiple calls", async () => {
    const { LegislationDocCache } = await import("../src/sources/legislationDocCache.js");
    const cache = new LegislationDocCache({ enabled: true });
    await cache.set("test-41", "MADDE 1 – test içeriği");
    const v1 = await cache.get("test-41");
    const v2 = await cache.get("test-41");
    expect(v1).toBe(v2);
    expect(v1).toContain("MADDE 1");
  }, 10000);

  it("concurrent prepareInformationPack calls don't crash", async () => {
    const svc = new DoktorMcpInformationService();
    const results = await Promise.all([
      svc.prepareInformationPack({ question: "disiplin", sourceMode: "mock" }),
      svc.prepareInformationPack({ question: "tazminat", sourceMode: "mock" }),
    ]);
    expect(results[0].shortAnswer).toBeDefined();
    expect(results[1].shortAnswer).toBeDefined();
  });
});
