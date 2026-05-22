import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache", "precedents");
const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  cachedAt: string;
  result: T;
}

function safeKey(source: string, query: string, pageSize: number): string {
  const safe = query.replace(/[^a-zA-Z0-9À-ɏ]/g, "-").slice(0, 50).replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${source}_${safe}_${pageSize}.json`;
}

export class PrecedentCache {
  private readonly dir: string;
  private readonly ttlMs: number;
  private readonly enabled: boolean;

  constructor(options: { dir?: string; ttlMs?: number; enabled?: boolean } = {}) {
    this.dir = options.dir ?? CACHE_DIR;
    this.ttlMs = options.ttlMs ?? TTL_MS;
    this.enabled = options.enabled ?? true;
  }

  async get<T>(source: string, query: string, pageSize: number): Promise<T | null> {
    if (!this.enabled) return null;
    const path = join(this.dir, safeKey(source, query, pageSize));
    try {
      const raw = await readFile(path, "utf-8");
      const entry = JSON.parse(raw) as CacheEntry<T>;
      const age = Date.now() - new Date(entry.cachedAt).getTime();
      if (age > this.ttlMs) return null;
      return entry.result;
    } catch {
      return null;
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
}
