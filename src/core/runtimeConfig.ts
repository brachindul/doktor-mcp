import { z } from "zod";

// ── Config Schema ──

const timeBudgetDefaults = {
  deadlineMs: 30_000,
  reserveMs: 3_000,
  legislationPhaseBudgetMs: 8_000,
  precedentPhaseBudgetMs: 15_000,
} as const;

const rateLimitDefaults = {
  bedestenMinIntervalMs: 2000,
  bedestenBurst: 5,
  bedestenConcurrency: 1,
  bedestenAdaptiveThrottle: true,
} as const;

const cacheDefaults = {
  ttlMs: 300_000, // 5 min
} as const;

const retryDefaults = {
  maxRetries: 2,
  initialBackoffMs: 1000,
  maxBackoffMs: 10_000,
} as const;

export const DoktorMcpConfigSchema = z.object({
  /** Time budget configuration for live research */
  timeBudget: z.object({
    /** Total deadline in milliseconds */
    deadlineMs: z.number().int().positive().default(timeBudgetDefaults.deadlineMs),
    /** Reserve time kept for pack assembly / rescue */
    reserveMs: z.number().int().nonnegative().default(timeBudgetDefaults.reserveMs),
    /** Budget for legislation phase */
    legislationPhaseBudgetMs: z.number().int().positive().default(timeBudgetDefaults.legislationPhaseBudgetMs),
    /** Budget for precedent phase */
    precedentPhaseBudgetMs: z.number().int().positive().default(timeBudgetDefaults.precedentPhaseBudgetMs),
  }).default(() => ({ ...timeBudgetDefaults })),

  /** Rate limit configuration for live sources */
  rateLimit: z.object({
    bedestenMinIntervalMs: z.number().int().positive().default(rateLimitDefaults.bedestenMinIntervalMs),
    bedestenBurst: z.number().int().positive().default(rateLimitDefaults.bedestenBurst),
    bedestenConcurrency: z.number().int().positive().default(rateLimitDefaults.bedestenConcurrency),
    bedestenAdaptiveThrottle: z.boolean().default(rateLimitDefaults.bedestenAdaptiveThrottle),
  }).default(() => ({ ...rateLimitDefaults })),

  /** Cache configuration */
  cache: z.object({
    /** Cache TTL in milliseconds */
    ttlMs: z.number().int().positive().default(cacheDefaults.ttlMs),
  }).default(() => ({ ...cacheDefaults })),

  /** Assessment tone default */
  assessmentTone: z.enum(["strict", "grounded-advisory"]).default("grounded-advisory"),

  /** Default source mode */
  sourceMode: z.enum(["mock", "live", "snapshot"]).default("mock"),

  /** Retry configuration for live sources */
  retry: z.object({
    maxRetries: z.number().int().nonnegative().default(retryDefaults.maxRetries),
    initialBackoffMs: z.number().int().positive().default(retryDefaults.initialBackoffMs),
    maxBackoffMs: z.number().int().positive().default(retryDefaults.maxBackoffMs),
  }).default(() => ({ ...retryDefaults })),

  /** HTTP fetch timeout */
  fetchTimeoutMs: z.number().int().positive().default(15_000),

  /** Assessment configuration */
  assessment: z.object({
    /** Minimum relevance score (0-5) for a precedent to appear in preliminaryAssessment */
    minRelevanceScore: z.number().int().min(0).max(5).default(2),
  }).default(() => ({ minRelevanceScore: 2 })),
});

export type DoktorMcpConfig = z.infer<typeof DoktorMcpConfigSchema>;

// ── Env Override Mapping ──
//
// Each entry maps a DOKTOR_MCP_* env var name to a setter that
// mutates the config object before final Zod validation.

type ConfigSetter = (config: Record<string, unknown>, value: string) => void;

function parseNum(value: string): number {
  const n = Number(value);
  if (isNaN(n) || value.trim() === "") throw new Error(`Invalid number: ${value}`);
  return n;
}

const ENV_SETTERS: Record<string, ConfigSetter> = {
  // timeBudget
  DOKTOR_MCP_TIME_BUDGET_DEADLINE_MS:       (c, v) => { (c.timeBudget as Record<string, unknown>).deadlineMs = parseNum(v); },
  DOKTOR_MCP_TIME_BUDGET_RESERVE_MS:        (c, v) => { (c.timeBudget as Record<string, unknown>).reserveMs = parseNum(v); },
  DOKTOR_MCP_TIME_BUDGET_LEGISLATION_PHASE_BUDGET_MS: (c, v) => { (c.timeBudget as Record<string, unknown>).legislationPhaseBudgetMs = parseNum(v); },
  DOKTOR_MCP_TIME_BUDGET_PRECEDENT_PHASE_BUDGET_MS:   (c, v) => { (c.timeBudget as Record<string, unknown>).precedentPhaseBudgetMs = parseNum(v); },

  // rateLimit
  DOKTOR_MCP_RATE_LIMIT_BEDESTEN_MIN_INTERVAL_MS: (c, v) => { (c.rateLimit as Record<string, unknown>).bedestenMinIntervalMs = parseNum(v); },
  DOKTOR_MCP_RATE_LIMIT_BEDESTEN_BURST:           (c, v) => { (c.rateLimit as Record<string, unknown>).bedestenBurst = parseNum(v); },
  DOKTOR_MCP_RATE_LIMIT_BEDESTEN_CONCURRENCY:     (c, v) => { (c.rateLimit as Record<string, unknown>).bedestenConcurrency = parseNum(v); },
  DOKTOR_MCP_RATE_LIMIT_BEDESTEN_ADAPTIVE_THROTTLE: (c, v) => { (c.rateLimit as Record<string, unknown>).bedestenAdaptiveThrottle = v === "true"; },

  // cache
  DOKTOR_MCP_CACHE_TTL_MS: (c, v) => { (c.cache as Record<string, unknown>).ttlMs = parseNum(v); },

  // retry
  DOKTOR_MCP_RETRY_MAX_RETRIES:       (c, v) => { (c.retry as Record<string, unknown>).maxRetries = parseNum(v); },
  DOKTOR_MCP_RETRY_INITIAL_BACKOFF_MS: (c, v) => { (c.retry as Record<string, unknown>).initialBackoffMs = parseNum(v); },
  DOKTOR_MCP_RETRY_MAX_BACKOFF_MS:     (c, v) => { (c.retry as Record<string, unknown>).maxBackoffMs = parseNum(v); },

  // assessment
  DOKTOR_MCP_ASSESSMENT_MIN_RELEVANCE_SCORE: (c, v) => {
    if (!c.assessment || typeof c.assessment !== "object") c.assessment = {};
    (c.assessment as Record<string, unknown>).minRelevanceScore = parseNum(v);
  },

  // scalars
  DOKTOR_MCP_ASSESSMENT_TONE: (c, v) => { c.assessmentTone = v; },
  DOKTOR_MCP_SOURCE_MODE:     (c, v) => { c.sourceMode = v; },
  DOKTOR_MCP_FETCH_TIMEOUT_MS: (c, v) => { c.fetchTimeoutMs = parseNum(v); },
};

// ── Runtime Config ──

let cachedConfig: DoktorMcpConfig | null = null;

function readEnvOverrides(): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("DOKTOR_MCP_") && value !== undefined) {
      overrides[key] = value;
    }
  }
  return overrides;
}

/**
 * Read and validate the runtime configuration.
 * Merges defaults with DOKTOR_MCP_* environment variable overrides.
 * Throws a descriptive ZodError if the resolved config is invalid.
 */
export function readConfig(): DoktorMcpConfig {
  if (cachedConfig) return cachedConfig;

  // Start from empty nested objects; inner .default() will fill them in
  const base: Record<string, unknown> = {
    timeBudget: {},
    rateLimit: {},
    cache: {},
    retry: {},
    assessment: {},
  };

  const envOverrides = readEnvOverrides();

  for (const [envKey, envValue] of Object.entries(envOverrides)) {
    const setter = ENV_SETTERS[envKey];
    if (setter) {
      setter(base, envValue);
    }
    // Unknown DOKTOR_MCP_* vars are silently ignored
  }

  cachedConfig = DoktorMcpConfigSchema.parse(base);
  return cachedConfig;
}

/**
 * Reset cached config (useful for testing).
 */
export function resetConfig(): void {
  cachedConfig = null;
}

// ── Backward-compatible accessors ──

/** @deprecated Use readConfig().rateLimit instead */
export interface RateLimitConfig {
  bedestenMinIntervalMs: number;
  bedestenBurst: number;
  bedestenConcurrency: number;
  bedestenAdaptiveThrottle: boolean;
}

/** @deprecated Use readConfig().rateLimit instead */
export function readRateLimitConfig(): RateLimitConfig {
  return readConfig().rateLimit;
}
