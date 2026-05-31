import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

describe("E2E: public physician information pack", () => {
  // ── Mock mode tests (deterministic) ──

  it("mock: 'tayin talebim reddedildi' → Atama Yönetmeliği birincil", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi ne yapmalıyım",
      sourceMode: "mock",
    });

    // Pack must have legislation
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    
    // First legislation item should be Atama Yönetmeliği
    const first = pack.relevantLegislation[0] as any;
    const firstName = (first.legislationName ?? "").toLowerCase();
    expect(firstName).toContain("atama");
    expect(firstName).toContain("yer değiştirme");
    
    // Hard fail: if first is wrong, something is broken
    expect(firstName).not.toContain("kvkk");
    expect(firstName).not.toContain("hasta hakları");
  });

  it("mock: 'hakkımda disiplin soruşturması açıldı' → discipline legislation present", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hakkımda disiplin soruşturması açıldı haklarım nelerdir",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    
    // Should include discipline-related legislation
    const names = pack.relevantLegislation.map((item: any) => 
      (item.legislationName ?? "").toLowerCase()
    );
    const hasDisciplineLegislation = names.some((n: string) =>
      n.includes("disiplin") || n.includes("657") || n.includes("memurlar")
    );
    expect(hasDisciplineLegislation).toBe(true);
  });

  it("mock: 'döner sermaye ek ödeme yapılmadı' → Ek Ödeme Yönetmeliği present", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "döner sermaye ek ödeme yapılmadı ne yapabilirim",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const names = pack.relevantLegislation.map((item: any) =>
      (item.legislationName ?? "").toLowerCase()
    );
    const hasEkOdeme = names.some((n: string) =>
      n.includes("ek ödeme") || n.includes("ek odeme")
    );
    expect(hasEkOdeme).toBe(true);
  });

  it("mock: 'mecburi hizmet süresi doldu' → relevant legislation present", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "mecburi hizmet süresi doldu tayin isteyebilir miyim",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
  });

  it("mock: 'tıpta uzmanlık eğitimi asistan hakları' → TUEY present", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tıpta uzmanlık eğitimi asistan hakları nelerdir",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    const names = pack.relevantLegislation.map((item: any) =>
      (item.legislationName ?? "").toLowerCase()
    );
    const hasTUEY = names.some((n: string) =>
      n.includes("uzmanlık eğitimi") || n.includes("uzmanlik egitimi")
    );
    expect(hasTUEY).toBe(true);
  });

  // ── Pack structure invariants ──
  
  it("every pack should have non-empty shortAnswer", async () => {
    const queries = [
      "tayin talebim reddedildi",
      "hakkımda disiplin soruşturması açıldı",
      "döner sermaye ek ödeme yapılmadı",
      "mecburi hizmet süresi doldu",
      "tıpta uzmanlık eğitimi asistan hakları"
    ];
    const service = new DoktorMcpInformationService();
    
    for (const q of queries) {
      const pack = await service.prepareInformationPack({
        question: q,
        sourceMode: "mock",
      });
      expect(pack.shortAnswer).toBeTruthy();
      expect(pack.shortAnswer.length).toBeGreaterThan(0);
    }
  });

  it("hard-blocked phrases must not appear in any pack", async () => {
    const queries = [
      "tayin talebim reddedildi",
      "hakkımda disiplin soruşturması açıldı"
    ];
    const service = new DoktorMcpInformationService();
    
    for (const q of queries) {
      const pack = await service.prepareInformationPack({
        question: q,
        sourceMode: "mock",
      });
      const text = JSON.stringify(pack).toLowerCase();
      expect(text).not.toContain("kesin olarak sorumlusunuz");
      expect(text).not.toContain("tazminat ödemek zorundadır");
      expect(text).not.toContain("kesin hukuki kanaat");
    }
  });

  // ── T14.4 E2E smoke gate ──

  it("smoke: clinical query should produce non-empty pack", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hastanın diyabet tanısı konuldu, SGK karşılaması gereken tedavi süreci nedir?",
      sourceMode: "mock",
    });

    expect(pack).toBeDefined();
    expect(pack.shortAnswer).toBeTruthy();
    expect(pack.shortAnswer.length).toBeGreaterThan(0);
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
  });

  it("smoke: privacy query should produce non-empty pack", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hastanın kişisel sağlık verileri KVKK kapsamında nasıl korunur?",
      sourceMode: "mock",
    });

    expect(pack).toBeDefined();
    expect(pack.shortAnswer).toBeTruthy();
    expect(pack.shortAnswer.length).toBeGreaterThan(0);
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
  });
});
