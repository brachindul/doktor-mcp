import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

describe("law + regulation combined ordering", () => {
  it("discipline query should return 657 DMK statute in mock mode", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hakkımda disiplin soruşturması açıldı 657 kapsamında savunma süresi nedir",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThanOrEqual(1);

    const names = pack.relevantLegislation.map((item: any) =>
      (item.legislationName ?? "").toLowerCase()
    );

    // 657 DMK should be present (has mock provision)
    const has657 = names.some((n: string) =>
      n.includes("657") || n.includes("memurlar")
    );
    expect(has657).toBe(true);
  });

  it("public employment query should prioritize regulation over statute", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi atama yönetmeliği kapsamında haklarım",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);

    const names = pack.relevantLegislation.map((item: any) =>
      (item.legislationName ?? "").toLowerCase()
    );

    // Atama Yönetmeliği (regulation) should be first
    expect(names[0]).toContain("atama");
    expect(names[0]).toContain("yer değiştirme");

    // If 657 DMK also appears, it must come after the regulation
    const regIdx = names.findIndex((n: string) =>
      n.includes("atama") && n.includes("yer")
    );
    const lawIdx = names.findIndex((n: string) =>
      n.includes("657")
    );
    if (regIdx !== -1 && lawIdx !== -1) {
      expect(regIdx).toBeLessThan(lawIdx);
    }
  });

  it("pack should always return non-empty legislation for valid queries", async () => {
    const queries = [
      "hakkımda disiplin soruşturması açıldı",
      "tayin talebim reddedildi",
      "mecburi hizmet süresi doldu",
    ];
    const service = new DoktorMcpInformationService();
    
    for (const q of queries) {
      const pack = await service.prepareInformationPack({
        question: q,
        sourceMode: "mock",
      });
      expect(pack.relevantLegislation.length).toBeGreaterThan(0);
      for (const item of pack.relevantLegislation as any[]) {
        expect(item.legislationName).toBeTruthy();
      }
    }
  });
});
