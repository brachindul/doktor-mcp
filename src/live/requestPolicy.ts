/**
 * src/live/requestPolicy.ts
 *
 * v0.25.0 — Live Timeout / Retry / Backoff Policy
 *
 * Pure utility module — no network calls, no external dependencies.
 * Inspired by patterns observed in local-yargi's httpClient and rateLimiter;
 * reimplemented fresh for doktor-mcp's architecture.
 * local-yargi is NOT imported and its code is NOT copied verbatim.
 *
 * Key capabilities:
 *   - Per-source configurable timeout via AbortController
 *   - Error classification: timeout | network | rateLimit | serverError |
 *     clientError | zeroResult | parseError | unknown
 *   - shouldRetry: transient errors only (timeout / rateLimit / serverError / network)
 *   - computeBackoffMs: deterministic jittered exponential backoff
 *   - withTimeout: wraps any fetch call with an AbortController deadline
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LiveRequestErrorKind =
  | "timeout"
  | "network"
  | "rateLimit"
  | "serverError"
  | "clientError"
  | "zeroResult"
  | "parseError"
  | "unknown";

export interface LiveRequestPolicy {
  /** Wall-clock deadline for a single network attempt (ms). */
  timeoutMs: number;
  /** Maximum number of *additional* retry attempts after the first try. */
  maxRetries: number;
  /** Base delay for exponential backoff before jitter (ms). */
  backoffBaseMs: number;
  /** Maximum single-step backoff delay (ms, before jitter). */
  backoffMaxMs: number;
  /** Jitter fraction [0, 1]; actual delay ∈ [base*(1-jitter), base*(1+jitter)]. */
  jitterFactor: number;
}

export interface LiveRequestTelemetry {
  kind: LiveRequestErrorKind;
  httpStatus: number | null;
  timedOut: boolean;
  retryCount: number;
  backoffMs: number;
  durationMs: number;
  message: string;
}

export interface RetryDecision {
  shouldRetry: boolean;
  reason: string;
}

// ─── Default Policies ──────────────────────────────────────────────────────────

/**
 * Source-specific timeout and retry policies.
 *
 * Rationale:
 *   - mevzuat search: short JSON request, should be fast; 8 s is generous.
 *   - mevzuat PDF:    PDF download can be large; 30 s allows for slow servers.
 *   - Bedesten search: API response; 12 s covers most real-world cases.
 *   - Bedesten fulltext: document fetch; 20 s.
 *   - Danistay:        similar to Bedesten; 15 s.
 *
 * maxRetries is kept low (2) to avoid accumulating large benchmarkMs costs
 * from repeated slow sources. Backoff is exponential with jitter so retries
 * don't hammer the same endpoint simultaneously.
 */
export const SOURCE_POLICIES: Record<string, LiveRequestPolicy> = {
  "mevzuat-search": {
    timeoutMs: 8_000,
    maxRetries: 2,
    backoffBaseMs: 300,
    backoffMaxMs: 2_000,
    jitterFactor: 0.3
  },
  "mevzuat-pdf": {
    timeoutMs: 30_000,
    maxRetries: 1,
    backoffBaseMs: 500,
    backoffMaxMs: 3_000,
    jitterFactor: 0.2
  },
  "bedesten-search": {
    timeoutMs: 12_000,
    maxRetries: 2,
    backoffBaseMs: 400,
    backoffMaxMs: 3_000,
    jitterFactor: 0.3
  },
  "bedesten-fulltext": {
    timeoutMs: 20_000,
    maxRetries: 1,
    backoffBaseMs: 600,
    backoffMaxMs: 4_000,
    jitterFactor: 0.2
  },
  "danistay-search": {
    timeoutMs: 15_000,
    maxRetries: 2,
    backoffBaseMs: 400,
    backoffMaxMs: 3_000,
    jitterFactor: 0.3
  }
};

/** Safe fallback for unknown source names. */
export const DEFAULT_POLICY: LiveRequestPolicy = {
  timeoutMs: 15_000,
  maxRetries: 2,
  backoffBaseMs: 400,
  backoffMaxMs: 3_000,
  jitterFactor: 0.3
};

export function policyForSource(sourceName: string): LiveRequestPolicy {
  return SOURCE_POLICIES[sourceName] ?? DEFAULT_POLICY;
}

// ─── Error Classification ──────────────────────────────────────────────────────

/**
 * Classify a thrown error or an HTTP status into a `LiveRequestErrorKind`.
 *
 * Priority (highest first):
 *   1. AbortError / DOMException with name "AbortError" → timeout
 *   2. TypeError / non-HTTP error → network
 *   3. HTTP 429 → rateLimit
 *   4. HTTP 5xx → serverError
 *   5. HTTP 4xx (excl. 429) → clientError
 *   6. HTTP 200 with zero results → zeroResult (caller-supplied flag)
 *   7. JSON parse failure → parseError
 */
export function classifyLiveError(
  error: unknown,
  httpStatus?: number | null
): LiveRequestErrorKind {
  // AbortError from AbortController.abort()
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError"))
  ) {
    return "timeout";
  }

  // Non-HTTP errors (network level): TypeError always indicates a connection failure;
  // a generic Error with an explicit null httpStatus also indicates no HTTP response was received.
  if (error instanceof TypeError || (error instanceof Error && httpStatus === null)) {
    return "network";
  }

  const status = httpStatus ?? (error instanceof Error ? extractHttpStatus(error) : null);

  if (status === 429) return "rateLimit";
  if (status !== null && status >= 500) return "serverError";
  if (status !== null && status >= 400 && status !== 429) return "clientError";

  if (error instanceof Error && /parse|json|syntax/i.test(error.message)) return "parseError";

  return "unknown";
}

/**
 * Classify a zero-result HTTP 200 response (no error thrown, but empty results).
 */
export function classifyZeroResult(): LiveRequestErrorKind {
  return "zeroResult";
}

/**
 * Extract numeric HTTP status from an error message heuristically.
 * Used when the error object doesn't directly expose the status.
 */
function extractHttpStatus(error: Error): number | null {
  const match = /HTTP\s+(\d{3})/i.exec(error.message);
  return match ? Number(match[1]) : null;
}

// ─── Retry Decision ───────────────────────────────────────────────────────────

/**
 * Decide whether a failed attempt should be retried.
 *
 * Retry on: timeout | rateLimit | serverError | network
 * Do NOT retry on: clientError | zeroResult | parseError | unknown
 *
 * Design rationale:
 *   - zeroResult: the query returned an empty set; retrying the same query
 *     will return the same empty set. The caller should try a different query.
 *   - clientError (4xx excl. 429): bad request; the same request will fail again.
 *   - parseError: the server sent something unparseable; retrying is unlikely
 *     to help without a code fix.
 *   - unknown: conservative — don't retry what we can't diagnose.
 */
export function shouldRetry(kind: LiveRequestErrorKind, attemptsUsed: number, maxRetries: number): RetryDecision {
  if (attemptsUsed >= maxRetries) {
    return { shouldRetry: false, reason: `Max retries (${maxRetries}) reached.` };
  }

  switch (kind) {
    case "timeout":
      return { shouldRetry: true, reason: "Request timed out; transient — will retry." };
    case "rateLimit":
      return { shouldRetry: true, reason: "HTTP 429 rate limit; transient — will retry after backoff." };
    case "serverError":
      return { shouldRetry: true, reason: "HTTP 5xx server error; transient — will retry." };
    case "network":
      return { shouldRetry: true, reason: "Network error; transient — will retry." };
    case "zeroResult":
      return { shouldRetry: false, reason: "Zero results returned; retry of same query won't help." };
    case "clientError":
      return { shouldRetry: false, reason: "HTTP 4xx client error; same request will fail again." };
    case "parseError":
      return { shouldRetry: false, reason: "Parse error; source returned malformed data." };
    case "unknown":
      return { shouldRetry: false, reason: "Unknown error kind; conservative — not retrying." };
  }
}

// ─── Backoff ──────────────────────────────────────────────────────────────────

/**
 * Compute jittered exponential backoff delay.
 *
 * Formula: clamp(base * 2^attempt, 0, maxMs) with ±jitterFactor random noise.
 * Deterministic when `random` is seeded.
 */
export function computeBackoffMs(
  attempt: number,
  policy: LiveRequestPolicy,
  random: () => number = Math.random
): number {
  const exponential = policy.backoffBaseMs * 2 ** attempt;
  const clamped = Math.min(exponential, policy.backoffMaxMs);
  const jitterRange = clamped * policy.jitterFactor;
  const jittered = clamped + jitterRange * (2 * random() - 1);
  return Math.max(0, Math.round(jittered));
}

// ─── Timeout Wrapper ──────────────────────────────────────────────────────────

/**
 * Wrap a single fetch call with an AbortController deadline.
 *
 * If the fetch does not resolve within `timeoutMs`, the AbortController is
 * aborted and the fetch rejects with an `AbortError` — which `classifyLiveError`
 * will classify as `"timeout"`.
 *
 * @param fetchImpl  - the global `fetch` or a test stub
 * @param url        - request URL
 * @param init       - RequestInit (must NOT already carry a signal; will be merged)
 * @param timeoutMs  - deadline in milliseconds
 * @param sleep      - injectable sleep for testing; not used here but accepted for API symmetry
 */
export async function withTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

// ─── High-level executeWithRetry ──────────────────────────────────────────────

export interface RetryResult<T> {
  value: T | null;
  succeeded: boolean;
  retryCount: number;
  totalBackoffMs: number;
  lastErrorKind: LiveRequestErrorKind | null;
  timedOut: boolean;
  lastError: unknown;
}

/**
 * Execute an async operation with policy-governed retry and backoff.
 *
 * `operation` must throw on failure; `extractKind` converts the thrown
 * error to a `LiveRequestErrorKind` for the retry decision.
 *
 * Uses injectable `sleep` so unit tests run without real delays.
 */
export async function executeWithRetry<T>(options: {
  operation: (attempt: number) => Promise<T>;
  policy: LiveRequestPolicy;
  extractKind: (error: unknown) => LiveRequestErrorKind;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}): Promise<RetryResult<T>> {
  const {
    operation,
    policy,
    extractKind,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random = Math.random
  } = options;

  let retryCount = 0;
  let totalBackoffMs = 0;
  let lastErrorKind: LiveRequestErrorKind | null = null;
  let lastError: unknown = null;
  let timedOut = false;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      const value = await operation(attempt);
      return { value, succeeded: true, retryCount, totalBackoffMs, lastErrorKind, timedOut, lastError: null };
    } catch (error) {
      lastError = error;
      const kind = extractKind(error);
      lastErrorKind = kind;
      if (kind === "timeout") timedOut = true;

      const decision = shouldRetry(kind, retryCount, policy.maxRetries);
      if (!decision.shouldRetry) break;

      const backoff = computeBackoffMs(attempt, policy, random);
      totalBackoffMs += backoff;
      retryCount++;
      if (backoff > 0) await sleep(backoff);
    }
  }

  return { value: null, succeeded: false, retryCount, totalBackoffMs, lastErrorKind, timedOut, lastError };
}
