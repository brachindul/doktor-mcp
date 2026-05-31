import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { LegislationCache } from "../src/health/legislationCache.js";
import type { LegislationProvision } from "../src/contracts/legal.js";

function fakeProvision(id: string): LegislationProvision {
  return {
    documentId: id,
    legislationName: "Test Kanun",
    articleNumber: "1",
    verbatimText: "Test metin",
    connection: "Test bağlantı",
    dimensions: ["criminal"],
    evidence: {
      source: "legislation",
      documentId: id,
      retrievedAt: new Date().toISOString(),
      official: true,
      fullText: true,
    },
  };
}

async function makeTempCache(ttlMs = 3600_000) {
  const dir = await mkdtemp(join(tmpdir(), "legislation-cache-test-"));
  return { dir, cache: new LegislationCache({ dir, ttlMs }) };
}

describe("LegislationCache", () => {
  it("returns null on cache miss", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      const result = await cache.get("kanun:test/123");
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("stores and retrieves provisions", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      const provisions = [fakeProvision("doc-1"), fakeProvision("doc-2")];
      await cache.set("kanun:test/123", provisions);
      const result = await cache.get("kanun:test/123");
      expect(result).toEqual(provisions);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when entry is expired", async () => {
    const { dir, cache } = await makeTempCache(1);
    try {
      await cache.set("kanun:test/123", [fakeProvision("doc-1")]);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await cache.get("kanun:test/123");
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when cache is disabled", async () => {
    const cache = LegislationCache.disabled();
    await cache.set("kanun:test/123", [fakeProvision("doc-1")]);
    const result = await cache.get("kanun:test/123");
    expect(result).toBeNull();
  });

  it("returns null when cache file is corrupt JSON", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "kanun_test-123.json"), "not valid json", "utf-8");
      const result = await cache.get("kanun:test/123");
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses separate keys for different sourceIds", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      const p1 = [fakeProvision("doc-1")];
      const p2 = [fakeProvision("doc-2")];
      await cache.set("kanun:a/1", p1);
      await cache.set("kanun:b/2", p2);

      const r1 = await cache.get("kanun:a/1");
      const r2 = await cache.get("kanun:b/2");
      expect(r1).toEqual(p1);
      expect(r2).toEqual(p2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
