import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrecedentCache } from "../src/sources/precedentCache.js";

async function makeTempCache(ttlMs = 3600_000) {
  const dir = await mkdtemp(join(tmpdir(), "precedent-cache-test-"));
  return { dir, cache: new PrecedentCache({ dir, fullTextDir: join(dir, "fulltext"), ttlMs }) };
}

describe("T22.1 — emsal tam-metin önbelleği", () => {
  it("returns null on full-text cache miss", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      const result = await cache.getFullText("yargitay:doc-123");
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("stores and retrieves full text by document id", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      await cache.setFullText("yargitay:doc-123", "Karar tam metni burada.");
      const result = await cache.getFullText("yargitay:doc-123");
      expect(result).not.toBeNull();
      expect(result!.text).toBe("Karar tam metni burada.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when full-text entry is expired", async () => {
    const { dir, cache } = await makeTempCache(1);
    try {
      await cache.setFullText("yargitay:doc-123", "Karar tam metni burada.");
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await cache.getFullText("yargitay:doc-123");
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when full-text cache is disabled", async () => {
    const cache = PrecedentCache.disabled();
    await cache.setFullText("yargitay:doc-123", "Karar tam metni burada.");
    const result = await cache.getFullText("yargitay:doc-123");
    expect(result).toBeNull();
  });

  it("uses separate keys for different document ids", async () => {
    const { dir, cache } = await makeTempCache();
    try {
      await cache.setFullText("yargitay:doc-123", "Yargıtay metni.");
      await cache.setFullText("danistay:doc-456", "Danıştay metni.");

      const y = await cache.getFullText("yargitay:doc-123");
      const d = await cache.getFullText("danistay:doc-456");
      expect(y?.text).toBe("Yargıtay metni.");
      expect(d?.text).toBe("Danıştay metni.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
