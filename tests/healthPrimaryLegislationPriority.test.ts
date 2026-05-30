import { describe, it, expect } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";

/**
 * Regression test: health-primary legislation (Hasta Hakları Yönetmeliği)
 * MUST come BEFORE KVKK (Kişisel Verilerin Korunması Kanunu) for
 * health-data-privacy questions.
 *
 * Rationale: When a question involves patient health data privacy, the
 * health-specific legislation (Hasta Hakları) is the primary legal framework.
 * KVKK (data protection law) is secondary. The legislation ordering must
 * reflect this hierarchy — if KVKK appears before Hasta Hakları, the
 * framework incorrectly prioritises generic data-protection over
 * health-specific patient-rights legislation.
 *
 * Hard-fail invariant: The test FAILS (not soft-fails) if either legislation
 * is missing from results or if KVKK appears before Hasta Hakları.
 */

const service = new DoktorMcpInformationService();

/**
 * Helper: find the index of a legislation by name fragment.
 * Handles both ASCII mock data names (e.g. "Hasta Haklari Yonetmeligi")
 * and Turkish-Unicode live data names (e.g. "Hasta Hakları Yönetmeliği").
 */
function findLegislationIndex(
  legislationOrder: Array<{ legislationName: string }>,
  patterns: string[]
): number {
  return legislationOrder.findIndex((item) => {
    const name = item.legislationName.toLowerCase();
    return patterns.some((p) => name.includes(p));
  });
}

/** Patterns that match Hasta Hakları in both ASCII and Turkish forms */
const HHY_PATTERNS = ["hasta hakla", "hasta hakl"];
/** Patterns that match KVKK in both ASCII and Turkish forms */
const KVKK_PATTERNS = [
  "kisisel verilerin korunmasi",
  "kişisel verilerin korunması",
  "6698",
];

describe("health-primary legislation priority (Hasta Hakları before KVKK)", () => {
  it("Hasta Hakları MUST appear before KVKK for health-data-privacy question (izinsiz paylaşma)", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekim kişisel sağlık verisini izinsiz paylaştı",
      sourceMode: "mock",
    });

    const legislationOrder = pack.relevantLegislation;

    const hhyIndex = findLegislationIndex(legislationOrder, HHY_PATTERNS);
    const kvkkIndex = findLegislationIndex(legislationOrder, KVKK_PATTERNS);

    // Both MUST be found — HARD FAIL if missing
    expect(hhyIndex).not.toBe(-1);
    expect(kvkkIndex).not.toBe(-1);

    // Hasta Hakları MUST come before KVKK — HARD FAIL if violated
    expect(hhyIndex).toBeLessThan(kvkkIndex);
  });

  it("Hasta Hakları MUST appear before KVKK for health-data-privacy question (sosyal medya paylaşımı)", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hasta sağlık verileri sosyal medyada paylaşılabilir mi?",
      sourceMode: "mock",
    });

    const legislationOrder = pack.relevantLegislation;

    const hhyIndex = findLegislationIndex(legislationOrder, HHY_PATTERNS);
    const kvkkIndex = findLegislationIndex(legislationOrder, KVKK_PATTERNS);

    // Both MUST be found
    expect(hhyIndex).not.toBe(-1);
    expect(kvkkIndex).not.toBe(-1);

    // Hasta Hakları MUST come before KVKK
    expect(hhyIndex).toBeLessThan(kvkkIndex);
  });

  it("Hasta Hakları MUST appear before KVKK for health-data-privacy question (veri paylaşımı)", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekim hasta sağlık verisini üçüncü kişilerle paylaşabilir mi?",
      sourceMode: "mock",
    });

    const legislationOrder = pack.relevantLegislation;

    const hhyIndex = findLegislationIndex(legislationOrder, HHY_PATTERNS);
    const kvkkIndex = findLegislationIndex(legislationOrder, KVKK_PATTERNS);

    // Both MUST be found
    expect(hhyIndex).not.toBe(-1);
    expect(kvkkIndex).not.toBe(-1);

    // Hasta Hakları MUST come before KVKK
    expect(hhyIndex).toBeLessThan(kvkkIndex);
  });

  it("health-data-privacy pack should contain legislation and shortAnswer", async () => {
    const pack = await service.prepareInformationPack({
      question: "Hekim kişisel sağlık verisini izinsiz paylaştı",
      sourceMode: "mock",
    });

    // At minimum, we should have some legislation results
    expect(pack.relevantLegislation.length).toBeGreaterThan(0);

    // shortAnswer should exist
    expect(pack.shortAnswer).toBeDefined();
    expect(pack.shortAnswer.length).toBeGreaterThan(0);

    // The first legislation should be Hasta Hakları (health-primary priority)
    const firstLegislation = pack.relevantLegislation[0];
    expect(firstLegislation.legislationName.toLowerCase()).toMatch(/hasta hakla/);
  });
});
