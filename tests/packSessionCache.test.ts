import { describe, expect, it, vi, afterEach } from "vitest";
import { PackSessionCache } from "../src/app/packSessionCache.js";
import type { DoctorLegalInformationPack } from "../src/contracts/legal.js";

function makePack(shortAnswer = "Test pack"): DoctorLegalInformationPack {
  return {
    shortAnswer,
    legalClassification: {
      criminal: "", civilCompensation: "", disciplinaryAdministrative: "",
      patientRights: "", privacyKvkk: "", professionalEthics: ""
    },
    relevantLegislation: [],
    verifiedHighCourtPrecedents: [],
    missingInformation: [],
    lawyerReviewPoints: [],
    sourceWarnings: []
  };
}

describe("E1.1 — PackSessionCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("store returns a packId and get retrieves the same pack", () => {
    const cache = new PackSessionCache();
    const pack = makePack("E1.1 round-trip");
    const packId = cache.store(pack);

    expect(packId).toMatch(/^pack-[a-f0-9]{6}$/);

    const retrieved = cache.get(packId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.shortAnswer).toBe("E1.1 round-trip");
  });

  it("get returns null for unknown packId", () => {
    const cache = new PackSessionCache();
    expect(cache.get("pack-unknown")).toBeNull();
  });

  it("evicts oldest entry when capacity is exceeded (20 + 1)", () => {
    const cache = new PackSessionCache({ maxEntries: 20 });
    const packIds: string[] = [];

    // Store 21 packs
    for (let i = 0; i < 21; i++) {
      packIds.push(cache.store(makePack(`Pack ${i}`)));
    }

    // Oldest (first stored) should be evicted
    expect(cache.get(packIds[0])).toBeNull();
    // Newest (last stored) should still be there
    expect(cache.get(packIds[20])).not.toBeNull();
    // Size should be at capacity
    expect(cache.size).toBe(20);
  });

  it("get returns null after TTL expires", () => {
    vi.useFakeTimers();
    const cache = new PackSessionCache({ ttlMs: 1000 }); // 1 second TTL
    const packId = cache.store(makePack("TTL test"));

    // Within TTL — should succeed
    expect(cache.get(packId)).not.toBeNull();

    // After TTL — should return null
    vi.advanceTimersByTime(1001);
    expect(cache.get(packId)).toBeNull();
  });

  it("get does NOT refresh TTL (TTL measured from creation)", () => {
    vi.useFakeTimers();
    const cache = new PackSessionCache({ ttlMs: 1000 });
    const packId = cache.store(makePack("No refresh"));

    // Advance 800ms and get (should succeed)
    vi.advanceTimersByTime(800);
    expect(cache.get(packId)).not.toBeNull();

    // Advance another 300ms — total 1100ms > 1000ms TTL
    vi.advanceTimersByTime(300);
    expect(cache.get(packId)).toBeNull();
  });

  it("different packIds are unique per store call", () => {
    const cache = new PackSessionCache();
    const id1 = cache.store(makePack("A"));
    const id2 = cache.store(makePack("B"));
    expect(id1).not.toBe(id2);
  });
});
