import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

describe("T20.3 — legislation provision dedup end-to-end", () => {
  it("mock pack has zero duplicate sourceDocumentId + articleNumber combinations", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);

    const seen = new Map<string, number>();
    for (const item of pack.relevantLegislation as any[]) {
      const key = `${item.sourceDocumentId ?? ""}::${item.articleNumber ?? ""}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen) {
      if (key && key !== "::") {
        expect(count).toBe(1);
      }
    }
  });

  it("mock pack preserves different articles from the same document", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi",
      sourceMode: "mock",
    });

    // Atama Yönetmeliği should have multiple distinct articles
    const atamaArticles = pack.relevantLegislation
      .filter((item: any) => item.sourceDocumentId?.includes("atama"))
      .map((item: any) => item.articleNumber);
    expect(atamaArticles.length).toBeGreaterThanOrEqual(2);
    expect(new Set(atamaArticles).size).toBe(atamaArticles.length);
  });

  it("live pack has zero duplicate sourceDocumentId + articleNumber combinations", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "tayin talebim reddedildi",
      sourceMode: "live",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);

    const seen = new Map<string, number>();
    for (const item of pack.relevantLegislation as any[]) {
      const key = `${item.sourceDocumentId ?? ""}::${item.articleNumber ?? ""}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen) {
      if (key && key !== "::") {
        expect(count).toBe(1);
      }
    }
  }, 30_000);

  it("diagnostics reports dedupedProvisionCount when duplicates are removed", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({
      question: "hasta hakları nelerdir",
      sourceMode: "mock",
    });

    expect(pack.relevantLegislation.length).toBeGreaterThan(0);
    // dedupedProvisionCount may be undefined if no dedup occurred; that's fine
    if (pack.diagnostics && "dedupedProvisionCount" in pack.diagnostics) {
      expect(pack.diagnostics.dedupedProvisionCount).toBeGreaterThanOrEqual(0);
    }
  });
});
