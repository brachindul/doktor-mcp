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
    vi.useRealTimers();
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

  it("21st pack evicts the least recently used (LRU test)", () => {
    const cache = new PackSessionCache(3); // small capacity for easy testing
    const ids: string[] = [];

    // Store 3 packs: A(0), B(1), C(2) — all at capacity
    ids.push(cache.store(makePack("A"))); // index 0
    ids.push(cache.store(makePack("B"))); // index 1
    ids.push(cache.store(makePack("C"))); // index 2
    expect(cache.size).toBe(3);

    // Access A — moves A to most-recently-used position
    expect(cache.get(ids[0])?.shortAnswer).toBe("A");

    // Store D — should evict B (least recently used), not A
    ids.push(cache.store(makePack("D"))); // index 3

    expect(cache.size).toBe(3);
    expect(cache.get(ids[0])?.shortAnswer).toBe("A"); // A still exists (was accessed)
    expect(cache.get(ids[1])).toBeNull();               // B evicted (LRU)
    expect(cache.get(ids[2])?.shortAnswer).toBe("C");   // C still exists
    expect(cache.get(ids[3])?.shortAnswer).toBe("D");   // D is new
  });

  it("get returns null after TTL expires", () => {
    vi.useFakeTimers();
    const cache = new PackSessionCache(20, 1000); // 1 second TTL
    const packId = cache.store(makePack("TTL test"));

    // Within TTL — should succeed
    expect(cache.get(packId)).not.toBeNull();

    // After TTL — should return null
    vi.advanceTimersByTime(1001);
    expect(cache.get(packId)).toBeNull();
  });

  it("get does NOT refresh TTL (TTL measured from creation)", () => {
    vi.useFakeTimers();
    const cache = new PackSessionCache(20, 1000);
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

  it("clear removes all entries", () => {
    const cache = new PackSessionCache();
    cache.store(makePack("A"));
    cache.store(makePack("B"));
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);

    // After clear, stored IDs are no longer retrievable
    // (we can't get the IDs back, but size confirms it's empty)
  });

  it("default constructor uses maxSize=20 and ttlMs=30min", () => {
    const cache = new PackSessionCache();
    // Store 20 packs — all should fit
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      ids.push(cache.store(makePack(`Pack ${i}`)));
    }
    expect(cache.size).toBe(20);

    // 21st should evict
    cache.store(makePack("Overflow"));
    expect(cache.size).toBe(20);
    // First pack should be evicted
    expect(cache.get(ids[0])).toBeNull();
  });
});
