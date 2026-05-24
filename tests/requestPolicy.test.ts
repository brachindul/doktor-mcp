/**
 * tests/requestPolicy.test.ts
 *
 * v0.25.0 — Pure unit tests for src/live/requestPolicy.ts
 *
 * All tests are synchronous or use injectable sleep/random — no real network,
 * no real timers. AbortController is emulated via a minimal fake fetch.
 */

import { describe, it, expect } from "vitest";
import {
  classifyLiveError,
  classifyZeroResult,
  computeBackoffMs,
  DEFAULT_POLICY,
  executeWithRetry,
  policyForSource,
  shouldRetry,
  SOURCE_POLICIES,
  withTimeout
} from "../src/live/requestPolicy.js";
import type { LiveRequestPolicy } from "../src/live/requestPolicy.js";

// ─── policyForSource ──────────────────────────────────────────────────────────

describe("policyForSource", () => {
  it("returns the mevzuat-search policy for that key", () => {
    const policy = policyForSource("mevzuat-search");
    expect(policy).toBe(SOURCE_POLICIES["mevzuat-search"]);
    expect(policy.timeoutMs).toBe(8_000);
  });

  it("returns the mevzuat-pdf policy with its 30 s timeout", () => {
    const policy = policyForSource("mevzuat-pdf");
    expect(policy.timeoutMs).toBe(30_000);
    expect(policy.maxRetries).toBe(1);
  });

  it("returns the bedesten-search policy for that key", () => {
    const policy = policyForSource("bedesten-search");
    expect(policy.timeoutMs).toBe(12_000);
  });

  it("returns the bedesten-fulltext policy", () => {
    const policy = policyForSource("bedesten-fulltext");
    expect(policy.timeoutMs).toBe(20_000);
  });

  it("returns the danistay-search policy", () => {
    const policy = policyForSource("danistay-search");
    expect(policy.timeoutMs).toBe(15_000);
  });

  it("returns the default policy for an unknown source name", () => {
    const policy = policyForSource("unknown-xyz");
    expect(policy).toBe(DEFAULT_POLICY);
    expect(policy.timeoutMs).toBe(15_000);
  });
});

// ─── classifyLiveError ────────────────────────────────────────────────────────

describe("classifyLiveError", () => {
  it("classifies an AbortError as timeout", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(classifyLiveError(err)).toBe("timeout");
  });

  it("classifies a DOMException AbortError as timeout", () => {
    // Simulate DOMException-like object with name AbortError
    const err = Object.assign(new Error("AbortError"), { name: "AbortError" });
    expect(classifyLiveError(err)).toBe("timeout");
  });

  it("classifies a TypeError as network", () => {
    expect(classifyLiveError(new TypeError("fetch failed"))).toBe("network");
  });

  it("classifies an Error with no httpStatus as network", () => {
    expect(classifyLiveError(new Error("connection reset"), null)).toBe("network");
  });

  it("classifies HTTP 429 as rateLimit", () => {
    expect(classifyLiveError(null, 429)).toBe("rateLimit");
  });

  it("classifies HTTP 500 as serverError", () => {
    expect(classifyLiveError(null, 500)).toBe("serverError");
  });

  it("classifies HTTP 503 as serverError", () => {
    expect(classifyLiveError(null, 503)).toBe("serverError");
  });

  it("classifies HTTP 404 as clientError", () => {
    expect(classifyLiveError(null, 404)).toBe("clientError");
  });

  it("classifies HTTP 400 as clientError", () => {
    expect(classifyLiveError(null, 400)).toBe("clientError");
  });

  it("classifies a parse error by message pattern", () => {
    const err = new Error("Unexpected token in JSON at position 0");
    expect(classifyLiveError(err)).toBe("parseError");
  });

  it("classifies a syntax error by message pattern", () => {
    const err = new Error("SyntaxError: unexpected end of JSON");
    expect(classifyLiveError(err)).toBe("parseError");
  });

  it("classifies an unrecognised error as unknown", () => {
    expect(classifyLiveError(new Error("something weird"))).toBe("unknown");
  });

  it("classifies non-Error values as unknown", () => {
    expect(classifyLiveError("string error")).toBe("unknown");
    expect(classifyLiveError(42)).toBe("unknown");
    expect(classifyLiveError(null)).toBe("unknown");
  });
});

// ─── classifyZeroResult ───────────────────────────────────────────────────────

describe("classifyZeroResult", () => {
  it("returns zeroResult", () => {
    expect(classifyZeroResult()).toBe("zeroResult");
  });
});

// ─── shouldRetry ─────────────────────────────────────────────────────────────

describe("shouldRetry", () => {
  const MAX = 2;

  it("retries on timeout", () => {
    expect(shouldRetry("timeout", 0, MAX).shouldRetry).toBe(true);
  });

  it("retries on rateLimit", () => {
    expect(shouldRetry("rateLimit", 0, MAX).shouldRetry).toBe(true);
  });

  it("retries on serverError", () => {
    expect(shouldRetry("serverError", 0, MAX).shouldRetry).toBe(true);
  });

  it("retries on network", () => {
    expect(shouldRetry("network", 0, MAX).shouldRetry).toBe(true);
  });

  it("does NOT retry on zeroResult", () => {
    expect(shouldRetry("zeroResult", 0, MAX).shouldRetry).toBe(false);
  });

  it("does NOT retry on clientError", () => {
    expect(shouldRetry("clientError", 0, MAX).shouldRetry).toBe(false);
  });

  it("does NOT retry on parseError", () => {
    expect(shouldRetry("parseError", 0, MAX).shouldRetry).toBe(false);
  });

  it("does NOT retry on unknown", () => {
    expect(shouldRetry("unknown", 0, MAX).shouldRetry).toBe(false);
  });

  it("stops retrying once maxRetries is reached", () => {
    expect(shouldRetry("timeout", 2, MAX).shouldRetry).toBe(false);
    expect(shouldRetry("timeout", 2, MAX).reason).toMatch(/max retries/i);
  });

  it("still allows retry when attemptsUsed < maxRetries", () => {
    expect(shouldRetry("serverError", 1, MAX).shouldRetry).toBe(true);
  });

  it("reason string is non-empty for every path", () => {
    const kinds = ["timeout", "rateLimit", "serverError", "network", "zeroResult", "clientError", "parseError", "unknown"] as const;
    for (const kind of kinds) {
      const decision = shouldRetry(kind, 0, MAX);
      expect(typeof decision.reason).toBe("string");
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });
});

// ─── computeBackoffMs ────────────────────────────────────────────────────────

describe("computeBackoffMs", () => {
  const policy: LiveRequestPolicy = {
    timeoutMs: 10_000,
    maxRetries: 3,
    backoffBaseMs: 200,
    backoffMaxMs: 2_000,
    jitterFactor: 0.0 // zero jitter for deterministic tests
  };

  it("attempt 0: base delay (no jitter)", () => {
    // 200 * 2^0 = 200, no jitter
    expect(computeBackoffMs(0, policy, () => 0.5)).toBe(200);
  });

  it("attempt 1: doubles (400ms no jitter)", () => {
    expect(computeBackoffMs(1, policy, () => 0.5)).toBe(400);
  });

  it("attempt 4: clamped to maxMs", () => {
    // 200 * 2^4 = 3200 → clamped to 2000
    expect(computeBackoffMs(4, policy, () => 0.5)).toBe(2_000);
  });

  it("never returns a negative value", () => {
    const negativeJitterPolicy = { ...policy, jitterFactor: 1.0 };
    const delay = computeBackoffMs(0, negativeJitterPolicy, () => 0);
    expect(delay).toBeGreaterThanOrEqual(0);
  });

  it("jitter shifts result within expected range", () => {
    const jitterPolicy = { ...policy, jitterFactor: 0.3 };
    // attempt 1 → exponential = 400, jitterRange = 400 * 0.3 = 120
    // with random()=1.0: 400 + 120 * (2*1 - 1) = 400 + 120 = 520
    // with random()=0.0: 400 + 120 * (2*0 - 1) = 400 - 120 = 280
    const high = computeBackoffMs(1, jitterPolicy, () => 1.0);
    const low = computeBackoffMs(1, jitterPolicy, () => 0.0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(520);
    expect(low).toBeGreaterThanOrEqual(280);
  });

  it("returns an integer (Math.round)", () => {
    const policy2 = { ...policy, jitterFactor: 0.25 };
    const ms = computeBackoffMs(1, policy2, () => Math.random());
    expect(Number.isInteger(ms)).toBe(true);
  });
});

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe("withTimeout", () => {
  it("resolves immediately when fetch resolves before deadline", async () => {
    const fakeResponse = { ok: true, status: 200 } as Response;
    const fakeFetch: typeof fetch = () => Promise.resolve(fakeResponse);
    const result = await withTimeout(fakeFetch, "https://example.com", {}, 5_000);
    expect(result).toBe(fakeResponse);
  });

  it("propagates AbortError when timeout fires before fetch resolves", async () => {
    // This fetch never resolves on its own; we rely on the AbortSignal
    const fakeFetch: typeof fetch = (_url, init) => {
      return new Promise((_resolve, reject) => {
        (init?.signal as AbortSignal | undefined)?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          reject(err);
        });
      });
    };

    await expect(withTimeout(fakeFetch, "https://example.com", {}, 10)).rejects.toMatchObject({
      name: "AbortError"
    });
  });

  it("clears the timer when fetch rejects before the deadline", async () => {
    const networkError = new TypeError("fetch failed");
    const fakeFetch: typeof fetch = () => Promise.reject(networkError);
    await expect(withTimeout(fakeFetch, "https://example.com", {}, 5_000)).rejects.toThrow("fetch failed");
  });

  it("merges the AbortSignal into the init without mutating the original", async () => {
    const fakeResponse = { ok: true } as Response;
    let capturedInit: RequestInit | undefined;
    const fakeFetch: typeof fetch = (_url, init) => {
      capturedInit = init;
      return Promise.resolve(fakeResponse);
    };
    const originalInit: RequestInit = { method: "GET" };
    await withTimeout(fakeFetch, "https://example.com", originalInit, 5_000);
    expect(capturedInit?.signal).toBeDefined();
    expect(originalInit.signal).toBeUndefined(); // original not mutated
  });
});

// ─── executeWithRetry ────────────────────────────────────────────────────────

describe("executeWithRetry", () => {
  const noSleep = () => Promise.resolve();
  const fixedRandom = () => 0.5;

  const smallPolicy: LiveRequestPolicy = {
    timeoutMs: 1_000,
    maxRetries: 2,
    backoffBaseMs: 0,
    backoffMaxMs: 0,
    jitterFactor: 0
  };

  it("returns succeeded=true when operation succeeds on first attempt", async () => {
    const result = await executeWithRetry({
      operation: async () => "ok",
      policy: smallPolicy,
      extractKind: () => "unknown",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(result.succeeded).toBe(true);
    expect(result.value).toBe("ok");
    expect(result.retryCount).toBe(0);
  });

  it("returns succeeded=false when operation always throws a non-retriable error", async () => {
    const result = await executeWithRetry({
      operation: async () => { throw new Error("bad request"); },
      policy: smallPolicy,
      extractKind: () => "clientError",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(result.succeeded).toBe(false);
    expect(result.value).toBeNull();
    expect(result.retryCount).toBe(0);
    expect(result.lastErrorKind).toBe("clientError");
  });

  it("retries transient errors up to maxRetries", async () => {
    let callCount = 0;
    const result = await executeWithRetry({
      operation: async () => {
        callCount++;
        if (callCount < 3) throw new Error("server error");
        return "success";
      },
      policy: smallPolicy,
      extractKind: () => "serverError",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(result.succeeded).toBe(true);
    expect(result.value).toBe("success");
    expect(result.retryCount).toBe(2);
    expect(callCount).toBe(3);
  });

  it("gives up after maxRetries even if error is transient", async () => {
    const result = await executeWithRetry({
      operation: async () => { throw new Error("always fails"); },
      policy: smallPolicy,
      extractKind: () => "serverError",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(result.succeeded).toBe(false);
    // 1 initial + 2 retries = 3 calls total; retryCount should be 2
    expect(result.retryCount).toBe(2);
  });

  it("sets timedOut=true when kind is timeout", async () => {
    const result = await executeWithRetry({
      operation: async () => { throw Object.assign(new Error("abort"), { name: "AbortError" }); },
      policy: smallPolicy,
      extractKind: () => "timeout",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(result.timedOut).toBe(true);
  });

  it("accumulates totalBackoffMs across retries", async () => {
    const backoffPolicy: LiveRequestPolicy = {
      ...smallPolicy,
      backoffBaseMs: 100,
      backoffMaxMs: 1_000,
      jitterFactor: 0
    };
    let calls = 0;
    const result = await executeWithRetry({
      operation: async () => {
        calls++;
        if (calls < 3) throw new Error("server");
        return 42;
      },
      policy: backoffPolicy,
      extractKind: () => "serverError",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(result.succeeded).toBe(true);
    // attempt 0 → backoff=100; attempt 1 → backoff=200; success on attempt 2 (no more backoff)
    expect(result.totalBackoffMs).toBe(300);
  });

  it("lastError is null on success, set on failure", async () => {
    const err = new Error("oops");
    const failResult = await executeWithRetry({
      operation: async () => { throw err; },
      policy: smallPolicy,
      extractKind: () => "clientError",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(failResult.lastError).toBe(err);

    const okResult = await executeWithRetry({
      operation: async () => "fine",
      policy: smallPolicy,
      extractKind: () => "unknown",
      sleep: noSleep,
      random: fixedRandom
    });
    expect(okResult.lastError).toBeNull();
  });
});

// ─── Source policy call-site contracts ────────────────────────────────────────
// These tests lock in the per-source timeout/retry values that live adapters rely
// on at their call sites. A failing test here means a policy was accidentally changed.

describe("Source policy call-site contracts", () => {
  it("bedesten-search: 12 s timeout covers JSON search requests", () => {
    expect(policyForSource("bedesten-search").timeoutMs).toBe(12_000);
    expect(policyForSource("bedesten-search").maxRetries).toBe(2);
  });

  it("bedesten-fulltext: 20 s timeout covers full-text document fetches (longer than search)", () => {
    const fullText = policyForSource("bedesten-fulltext");
    expect(fullText.timeoutMs).toBe(20_000);
    expect(fullText.maxRetries).toBe(1);
    // Must be strictly greater than bedesten-search so fulltext never times out earlier
    expect(fullText.timeoutMs).toBeGreaterThan(policyForSource("bedesten-search").timeoutMs);
  });

  it("danistay-search: 15 s timeout covers search and getDokuman requests", () => {
    expect(policyForSource("danistay-search").timeoutMs).toBe(15_000);
    expect(policyForSource("danistay-search").maxRetries).toBe(2);
  });

  it("mevzuat-search: 8 s timeout covers legislation search JSON requests", () => {
    expect(policyForSource("mevzuat-search").timeoutMs).toBe(8_000);
    expect(policyForSource("mevzuat-search").maxRetries).toBe(2);
  });

  it("mevzuat-pdf: 30 s timeout covers PDF downloads (longest allowed)", () => {
    const pdf = policyForSource("mevzuat-pdf");
    expect(pdf.timeoutMs).toBe(30_000);
    expect(pdf.maxRetries).toBe(1);
    // Must be strictly greater than mevzuat-search so PDF never times out before search
    expect(pdf.timeoutMs).toBeGreaterThan(policyForSource("mevzuat-search").timeoutMs);
  });

  it("no known source exceeds 30 s — ensures tests and benchmarks don't hang", () => {
    const MAX_ALLOWED_MS = 30_000;
    for (const [name, policy] of Object.entries(SOURCE_POLICIES)) {
      expect(policy.timeoutMs, `${name}.timeoutMs`).toBeLessThanOrEqual(MAX_ALLOWED_MS);
    }
  });

  it("DEFAULT_POLICY is in the acceptable timeout range (10–20 s)", () => {
    expect(DEFAULT_POLICY.timeoutMs).toBeGreaterThanOrEqual(10_000);
    expect(DEFAULT_POLICY.timeoutMs).toBeLessThanOrEqual(20_000);
  });
});
