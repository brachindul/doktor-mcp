/**
 * Source capability registry ported from local-yargi's source registry
 * concept and trimmed to the doktor-mcp set. Adapters do NOT branch
 * on this; the registry is informational for tooling and MCP capability
 * reporting.
 */
export type SourceKind = "legislation" | "precedent" | "access_channel";

export interface RateLimitPolicy {
  requestsPerMinute: number;
  cooldownMs: number;
}

export interface CachePolicy {
  ttlMs: number;
  enabled: boolean;
}

export interface SourceCapability {
  id: string;
  sourceKind: SourceKind;
  supportsSearch: boolean;
  supportsGet: boolean;
  supportsFullText: boolean;
  supportsArticleExtraction: boolean;
  supportsPrecedents: boolean;
  supportsLegislation: boolean;
  calibrationStatus: string;
  /** Detailed explanation of calibration status (optional). */
  calibrationReason?: string;
  rateLimitPolicy: RateLimitPolicy;
  cachePolicy: CachePolicy;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

export const SOURCE_REGISTRY: Record<string, SourceCapability> = {
  "mevzuat.gov.tr": {
    id: "mevzuat.gov.tr",
    sourceKind: "legislation",
    supportsSearch: true,
    supportsGet: true,
    supportsFullText: true,
    supportsArticleExtraction: true,
    supportsPrecedents: false,
    supportsLegislation: true,
    calibrationStatus: "stable",
    rateLimitPolicy: { requestsPerMinute: 30, cooldownMs: 5_000 },
    cachePolicy: { ttlMs: SEVEN_DAYS_MS, enabled: true }
  },
  bedesten: {
    id: "bedesten",
    sourceKind: "access_channel",
    supportsSearch: true,
    supportsGet: true,
    supportsFullText: true,
    supportsArticleExtraction: false,
    supportsPrecedents: true,
    supportsLegislation: false,
    calibrationStatus: "stable",
    rateLimitPolicy: { requestsPerMinute: 30, cooldownMs: 60_000 },
    cachePolicy: { ttlMs: SEVEN_DAYS_MS, enabled: true }
  },
  "karararama.danistay.gov.tr": {
    id: "karararama.danistay.gov.tr",
    sourceKind: "precedent",
    supportsSearch: true,
    supportsGet: true,
    supportsFullText: true,
    supportsArticleExtraction: false,
    supportsPrecedents: true,
    supportsLegislation: false,
    calibrationStatus: "stable",
    rateLimitPolicy: { requestsPerMinute: 20, cooldownMs: 30_000 },
    cachePolicy: { ttlMs: SEVEN_DAYS_MS, enabled: true }
  },
  "emsal.yargitay.gov.tr": {
    id: "emsal.yargitay.gov.tr",
    sourceKind: "precedent",
    supportsSearch: true,
    supportsGet: true,
    supportsFullText: true,
    supportsArticleExtraction: false,
    supportsPrecedents: true,
    supportsLegislation: false,
    calibrationStatus: "via_bedesten",
    rateLimitPolicy: { requestsPerMinute: 30, cooldownMs: 60_000 },
    cachePolicy: { ttlMs: SEVEN_DAYS_MS, enabled: true }
  },
  aym: {
    id: "aym",
    sourceKind: "precedent",
    supportsSearch: false,
    supportsGet: false,
    supportsFullText: false,
    supportsArticleExtraction: false,
    supportsPrecedents: true,
    supportsLegislation: false,
    calibrationStatus: "synthetic_only",
    calibrationReason:
      "AYM kararlar bilgi bankası (kararlarbilgibankasi.anayasa.gov.tr) HTML tabanlı arayüzdür, JSON API sunmaz. " +
      "Canlı arama mümkün değildir. Sentetik (boş) sonuç döndürülür — uydurma karar yok.",
    rateLimitPolicy: { requestsPerMinute: 0, cooldownMs: 0 },
    cachePolicy: { ttlMs: 0, enabled: false }
  }
};

export function listSourceCapabilities(): SourceCapability[] {
  return Object.values(SOURCE_REGISTRY);
}

export function getSourceCapability(id: string): SourceCapability | undefined {
  return SOURCE_REGISTRY[id];
}
