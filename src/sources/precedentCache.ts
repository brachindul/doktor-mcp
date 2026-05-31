import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache", "precedents");
const FULLTEXT_CACHE_DIR = join(process.cwd(), ".cache", "precedents-fulltext");
const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  cachedAt: string;
  result: T;
}

export interface CacheLookupResult<T> {
  hit: boolean;
  value: T | null;
  ageMs: number | null;
  key: string;
}

function safeKey(source: string, query: string, pageSize: number): string {
  const safe = query.replace(/[^a-zA-Z0-9À-ɏ]/g, "-").slice(0, 50).replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${source}_${safe}_${pageSize}.json`;
}

export class PrecedentCache {
  private readonly dir: string;
  private readonly fullTextDir: string;
  private readonly ttlMs: number;
  private readonly enabled: boolean;

  constructor(options: { dir?: string; fullTextDir?: string; ttlMs?: number; enabled?: boolean } = {}) {
    this.dir = options.dir ?? CACHE_DIR;
    this.fullTextDir = options.fullTextDir ?? join(this.dir, "fulltext");
    this.ttlMs = options.ttlMs ?? TTL_MS;
    this.enabled = options.enabled ?? true;
  }

  async get<T>(source: string, query: string, pageSize: number): Promise<T | null> {
    const result = await this.getWithMeta<T>(source, query, pageSize);
    return result.value;
  }

  async getWithMeta<T>(source: string, query: string, pageSize: number): Promise<CacheLookupResult<T>> {
    const key = safeKey(source, query, pageSize);
    if (!this.enabled) return { hit: false, value: null, ageMs: null, key };
    const filePath = join(this.dir, key);
    try {
      const raw = await readFile(filePath, "utf-8");
      const entry = JSON.parse(raw) as CacheEntry<T>;
      const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
      if (ageMs > this.ttlMs) return { hit: false, value: null, ageMs, key };
      return { hit: true, value: entry.result, ageMs, key };
    } catch {
      return { hit: false, value: null, ageMs: null, key };
    }
  }

  async set<T>(source: string, query: string, pageSize: number, result: T): Promise<void> {
    if (!this.enabled) return;
    try {
      await mkdir(this.dir, { recursive: true });
      const path = join(this.dir, safeKey(source, query, pageSize));
      const entry: CacheEntry<T> = { cachedAt: new Date().toISOString(), result };
      await writeFile(path, JSON.stringify(entry, null, 2), "utf-8");
    } catch {
      // Cache write failure is non-fatal
    }
  }

  static disabled() {
    return new PrecedentCache({ enabled: false });
  }

  // --- Full-text cache (per document) ---
  async getFullText(documentId: string): Promise<{ text: string; cachedAt: string } | null> {
    if (!this.enabled) return null;
    const filePath = join(this.fullTextDir, `${documentId.replace(/[:/]/g, "_")}.txt`);
    try {
      const raw = await readFile(filePath, "utf-8");
      const entry: CacheEntry<string> = JSON.parse(raw);
      const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
      if (ageMs > this.ttlMs) return null;
      return { text: entry.result, cachedAt: entry.cachedAt };
    } catch {
      return null;
    }
  }

  async setFullText(documentId: string, text: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await mkdir(this.fullTextDir, { recursive: true });
      const filePath = join(this.fullTextDir, `${documentId.replace(/[:/]/g, "_")}.txt`);
      const entry: CacheEntry<string> = { cachedAt: new Date().toISOString(), result: text };
      await writeFile(filePath, JSON.stringify(entry), "utf-8");
    } catch {
      // Cache write failure is non-fatal
    }
  }
}
