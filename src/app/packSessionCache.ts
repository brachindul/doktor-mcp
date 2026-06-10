import type { DoctorLegalInformationPack } from "../contracts/legal.js";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  pack: DoctorLegalInformationPack;
  created: number; // Date.now()
}

// ─── PackSessionCache ──────────────────────────────────────────────────────

/**
 * In-memory LRU cache for DoctorLegalInformationPack objects.
 *
 * - Capacity: 20 packs (LRU eviction — least recently *used/accessed*)
 * - TTL: 30 minutes (measured from creation time; `get` does not refresh TTL)
 * - No disk persistence — this is a per-process session cache.
 */
export class PackSessionCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number;
  /** LRU access order: front = least recently used, back = most recently used */
  private accessOrder: string[];

  constructor(maxSize?: number, ttlMs?: number) {
    this.maxSize = maxSize ?? 20;
    this.ttlMs = ttlMs ?? 30 * 60 * 1000; // 30 minutes
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Store a pack and return a short packId.
   */
  store(pack: DoctorLegalInformationPack): string {
    // Evict expired entries first
    this.evictExpired();

    // Evict least recently used if at capacity
    while (this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder.shift();
      if (lruKey !== undefined) this.cache.delete(lruKey);
    }

    const packId = "pack-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    this.cache.set(packId, { pack, created: Date.now() });
    this.accessOrder.push(packId);
    return packId;
  }

  /**
   * Retrieve a pack by packId. Returns null if not found or expired.
   * Does NOT refresh TTL (TTL is measured from creation time).
   * Updates LRU access order (accessed items move to most-recently-used).
   */
  get(packId: string): DoctorLegalInformationPack | null {
    const entry = this.cache.get(packId);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.created > this.ttlMs) {
      this.cache.delete(packId);
      const idx = this.accessOrder.indexOf(packId);
      if (idx !== -1) this.accessOrder.splice(idx, 1);
      return null;
    }

    // Update LRU: move to end (most recently used)
    const idx = this.accessOrder.indexOf(packId);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(packId);

    return entry.pack;
  }

  /** Number of currently stored entries (excluding expired ones not yet evicted by access). */
  get size(): number {
    return this.cache.size;
  }

  /** Remove all entries from the cache. */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /** Evict all expired entries. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache) {
      if (now - entry.created > this.ttlMs) {
        this.cache.delete(id);
        const idx = this.accessOrder.indexOf(id);
        if (idx !== -1) this.accessOrder.splice(idx, 1);
      }
    }
  }
}
