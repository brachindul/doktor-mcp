import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LegislationProvision } from "../contracts/legal.js";

const CACHE_DIR = join(process.cwd(), ".cache", "legislation");

interface LegislationCacheEntry {
  sourceId: string;
  provisions: LegislationProvision[];
  cachedAt: string;
  ttlMs: number;
}

function safeKey(sourceId: string): string {
  return sourceId.replace(/[:\/]/g, "_") + ".json";
}

export class LegislationCache {
  private readonly dir: string;
  private readonly ttlMs: number;
  private readonly enabled: boolean;

  constructor(options: { dir?: string; ttlMs?: number; enabled?: boolean } = {}) {
    this.dir = options.dir ?? CACHE_DIR;
    this.ttlMs = options.ttlMs ?? 300_000; // 5 min default
    this.enabled = options.enabled ?? true;
  }

  async get(sourceId: string): Promise<LegislationProvision[] | null> {
    if (!this.enabled) return null;
    const filePath = join(this.dir, safeKey(sourceId));
    try {
      const raw = await readFile(filePath, "utf-8");
      const entry: LegislationCacheEntry = JSON.parse(raw);
      const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
      if (ageMs > entry.ttlMs) return null;
      return entry.provisions;
    } catch {
      return null;
    }
  }

  async set(sourceId: string, provisions: LegislationProvision[]): Promise<void> {
    if (!this.enabled) return;
    try {
      await mkdir(this.dir, { recursive: true });
      const filePath = join(this.dir, safeKey(sourceId));
      const entry: LegislationCacheEntry = {
        sourceId,
        provisions,
        cachedAt: new Date().toISOString(),
        ttlMs: this.ttlMs,
      };
      await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch {
      // Cache write failure is non-fatal
    }
  }

  static disabled(): LegislationCache {
    return new LegislationCache({ enabled: false });
  }
}
