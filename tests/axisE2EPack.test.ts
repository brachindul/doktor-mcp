import { describe, expect, it } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { loadAllAxisFixtures, loadAxisFixture } from "../src/fixtureReplay.js";

/**
 * T27.2 — prepareInformationPack seviyesinde eksen e2e testleri
 *
 * Her eksen için tam pakette (mock mode, ağsız) doğrulama:
 * ilgili mevzuat geliyor mu, shortAnswer boş değil mi.
 */
const service = new DoktorMcpInformationService();
const AXIS_KEYWORDS: Record<string, RegExp> = {
  disiplin: /657|devlet memur|disiplin/,
  malpraktis: /deontoloji|tibbi hata|malpraktis/,
  tayin: /atama|tayin|nakil|gorev/,
  gizlilik: /hasta|mahremiyet|bilgi|kvkk/,
  riza_onam: /riza|onam|aydinlat/,
  acil_mudahale: /acil|mudahale|red/,
  ek_odeme: /odeme|ucret|mali/,
  mecburi_hizmet: /hizmet|yukumlu|mecbur/
};

describe("T27.2 — prepareInformationPack seviyesinde eksen e2e testleri", () => {
  const fixtures = loadAllAxisFixtures();

  for (const fixture of fixtures) {
    const axis = fixture.axis;
    it(`${axis}: pack has legislation for axis question`, async () => {
      const pack = await service.prepareInformationPack({
        question: fixture.question,
        sourceMode: "mock"
      });
      expect(pack).toBeDefined();
      expect(pack.shortAnswer).toBeDefined();
      expect(pack.shortAnswer.length).toBeGreaterThan(0);
      expect(pack.relevantLegislation.length).toBeGreaterThanOrEqual(1);
    });

    it(`${axis}: pack content matches axis keywords`, async () => {
      const pack = await service.prepareInformationPack({
        question: fixture.question,
        sourceMode: "mock"
      });
      const text = JSON.stringify(pack).toLowerCase();
      const regex = AXIS_KEYWORDS[axis] || /./;
      expect(text).toMatch(regex);
    });
  }

  it("disiplin axis: explicit 657 DMK reference", async () => {
    const f = loadAxisFixture("disiplin");
    const pack = await service.prepareInformationPack({ question: f.question, sourceMode: "mock" });
    expect(JSON.stringify(pack).toLowerCase()).toMatch(/657|devlet memur/);
  });

  it("malpraktis axis: explicit Deontology reference", async () => {
    const f = loadAxisFixture("malpraktis");
    const pack = await service.prepareInformationPack({ question: f.question, sourceMode: "mock" });
    expect(JSON.stringify(pack).toLowerCase()).toMatch(/deontoloji|tibbi hata/);
  });

  it("all axis packs have non-empty shortAnswer", async () => {
    for (const f of fixtures) {
      const pack = await service.prepareInformationPack({ question: f.question, sourceMode: "mock" });
      expect(pack.shortAnswer).toBeTruthy();
    }
  });
});
