import type { DoctorLegalInformationPack } from "../contracts/legal.js";
import { randomUUID } from "node:crypto";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  pack: DoctorLegalInformationPack;
  createdAtMs: number;
}

// ─── PackSessionCache ──────────────────────────────────────────────────────

/**
 * In-memory LRU cache for DoctorLegalInformationPack objects.
 *
 * - Capacity: 20 packs (LRU eviction)
 * - TTL: 30 minutes (measured from creation time; `get` does not refresh it)
 * - No disk persistence — this is a per-process session cache.
 */
export class PackSessionCache {
  private readonly cacheStore = new Map<string, CacheEntry>();
  private readonly createdAtOrder: string[] = []; // FIFO order for LRU eviction
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options?: { maxEntries?: number; ttlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? 20;
    this.ttlMs = options?.ttlMs ?? 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Store a pack and return a short packId.
   */
  store(pack: DoctorLegalInformationPack): string {
    // Evict if at capacity
    while (this.cacheStore.size >= this.maxEntries) {
      const oldest = this.createdAtOrder.shift();
      if (oldest) this.cacheStore.delete(oldest);
    }

    // Evict expired entries
    this.evictExpired();

    const packId = "pack-" + randomUUID().replace(/-/g, "").slice(0, 6);
    this.cacheStore.set(packId, { pack, createdAtMs: Date.now() });
    this.createdAtOrder.push(packId);
    return packId;
  }

  /**
   * Retrieve a pack by packId. Returns null if not found or expired.
   * Does NOT refresh TTL (TTL is measured from creation time).
   */
  get(packId: string): DoctorLegalInformationPack | null {
    const entry = this.cacheStore.get(packId);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAtMs > this.ttlMs) {
      this.cacheStore.delete(packId);
      const idx = this.createdAtOrder.indexOf(packId);
      if (idx !== -1) this.createdAtOrder.splice(idx, 1);
      return null;
    }

    return entry.pack;
  }

  /**
   * Evict all expired entries.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.cacheStore) {
      if (now - entry.createdAtMs > this.ttlMs) {
        this.cacheStore.delete(id);
        const idx = this.createdAtOrder.indexOf(id);
        if (idx !== -1) this.createdAtOrder.splice(idx, 1);
      }
    }
  }

  /** Number of currently stored entries (including possibly expired ones not yet evicted by access). */
  get size(): number {
    return this.cacheStore.size;
  }
}
