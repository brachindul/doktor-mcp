import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { PrecedentCache } from "../src/sources/precedentCache.js";

async function makeTempCache(ttlMs = 3600_000) {
  const dir = await mkdtemp(join(tmpdir(), "precedent-cache-test-"));
  return { dir, cache: new PrecedentCache({ dir, ttlMs }) };
}

describe("PrecedentCache", () => {
  it("returns null on cache miss", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      const result = await cache.get("yargitay", "rıza", 5);
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("stores and retrieves a result", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      const payload = { status: "ok", decisions: [] };
      await cache.set("yargitay", "rıza", 5, payload);
      const result = await cache.get("yargitay", "rıza", 5);
      expect(result).toEqual(payload);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when entry is expired", async () => {
    const { dir, cache } = await makeTempCache(1);
    try {
      const payload = { status: "ok" };
      await cache.set("yargitay", "rıza", 5, payload);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await cache.get("yargitay", "rıza", 5);
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when cache is disabled", async () => {
    const cache = PrecedentCache.disabled();
    await cache.set("yargitay", "rıza", 5, { data: "x" });
    const result = await cache.get("yargitay", "rıza", 5);
    expect(result).toBeNull();
  });

  it("returns null when cache file is corrupt JSON", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "yargitay_r-za_5.json"), "not valid json", "utf-8");
      const result = await cache.get("yargitay", "rıza", 5);
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses separate keys for different sources", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      await cache.set("yargitay", "rıza", 5, { source: "yargitay" });
      await cache.set("danistay", "rıza", 5, { source: "danistay" });

      const y = await cache.get<{ source: string }>("yargitay", "rıza", 5);
      const d = await cache.get<{ source: string }>("danistay", "rıza", 5);
      expect(y?.source).toBe("yargitay");
      expect(d?.source).toBe("danistay");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses separate keys for different page sizes", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      await cache.set("yargitay", "rıza", 5, { size: 5 });
      await cache.set("yargitay", "rıza", 10, { size: 10 });

      const r5 = await cache.get<{ size: number }>("yargitay", "rıza", 5);
      const r10 = await cache.get<{ size: number }>("yargitay", "rıza", 10);
      expect(r5?.size).toBe(5);
      expect(r10?.size).toBe(10);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
