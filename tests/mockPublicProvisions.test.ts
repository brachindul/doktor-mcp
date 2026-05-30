import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

describe("mock public employment provisions", () => {
  it("should return Atama Yönetmeliği for public employment query in mock mode", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi ne yapmalıyım",
      sourceMode: "mock",
    });
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const hasAtama = pack.relevantLegislation.some((item: any) =>
      (item.legislationName ?? "").toLowerCase().includes("atama") &&
      (item.legislationName ?? "").toLowerCase().includes("yer değiştirme")
    );
    expect(hasAtama).toBe(true);
  });

  it("should return TUEY for uzmanlık query in mock mode", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tıpta uzmanlık eğitimi asistan hakları",
      sourceMode: "mock",
    });
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const hasTUEY = pack.relevantLegislation.some((item: any) =>
      (item.legislationName ?? "").toLowerCase().includes("uzmanlık eğitimi")
    );
    expect(hasTUEY).toBe(true);
  });
});
