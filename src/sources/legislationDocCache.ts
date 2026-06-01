/**
 * T35.2 — Legislation Document Cache
 *
 * Caches legislation document text by sourceId to handle large PDF flakiness
 * (e.g., 657 DMK). On cache hit, returns cached text even if live fetch fails.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache", "legislation-docs");

interface CacheEntry {
  sourceId: string;
  text: string;
  cachedAt: number;
}

export class LegislationDocCache {
  private readonly dir: string;
  private readonly enabled: boolean;

  constructor(options: { dir?: string; enabled?: boolean } = {}) {
    this.dir = options.dir ?? CACHE_DIR;
    this.enabled = options.enabled ?? true;
  }

  private filePath(sourceId: string): string {
    const safe = sourceId.replace(/[^a-zA-Z0-9\-_.:]/g, "_");
    return join(this.dir, `${safe}.json`);
  }

  async get(sourceId: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const raw = await readFile(this.filePath(sourceId), "utf-8");
      const entry = JSON.parse(raw) as CacheEntry;
      return entry.text ?? null;
    } catch {
      return null;
    }
  }

  async set(sourceId: string, text: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await mkdir(this.dir, { recursive: true });
    } catch { /* dir exists */ }
    const entry: CacheEntry = { sourceId, text, cachedAt: Date.now() };
    await writeFile(this.filePath(sourceId), JSON.stringify(entry), "utf-8");
  }

  /** Returns cached text if available, otherwise fetches and caches it. */
  async getOrFetch(
    sourceId: string,
    fetchFn: () => Promise<string | null>
  ): Promise<string | null> {
    const cached = await this.get(sourceId);
    if (cached) return cached;
    const fresh = await fetchFn();
    if (fresh) {
      await this.set(sourceId, fresh);
    }
    return fresh ?? cached; // prefer fresh, fall back to cached
  }
}
