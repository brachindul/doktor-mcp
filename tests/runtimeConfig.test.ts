import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readConfig, resetConfig, DoktorMcpConfigSchema, readRateLimitConfig } from "../src/core/runtimeConfig.js";

describe("runtimeConfig", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    // Clean up env vars set during tests
    delete process.env.DOKTOR_MCP_TIME_BUDGET_DEADLINE_MS;
    delete process.env.DOKTOR_MCP_SOURCE_MODE;
    delete process.env.DOKTOR_MCP_ASSESSMENT_TONE;
    delete process.env.DOKTOR_MCP_RETRY_MAX_RETRIES;
    delete process.env.DOKTOR_MCP_RATE_LIMIT_BEDESTEN_BURST;
    delete process.env.DOKTOR_MCP_RATE_LIMIT_BEDESTEN_ADAPTIVE_THROTTLE;
    delete process.env.DOKTOR_MCP_CACHE_TTL_MS;
    delete process.env.DOKTOR_MCP_FETCH_TIMEOUT_MS;
    delete process.env.DOKTOR_MCP_INVALID_KEY;
    delete process.env.OTHER_VAR;
    resetConfig();
  });

  it("should return defaults when no env vars are set", () => {
    const config = readConfig();
    expect(config.timeBudget.deadlineMs).toBe(30_000);
    expect(config.timeBudget.reserveMs).toBe(3_000);
    expect(config.timeBudget.legislationPhaseBudgetMs).toBe(8_000);
    expect(config.timeBudget.precedentPhaseBudgetMs).toBe(15_000);
    expect(config.sourceMode).toBe("mock");
    expect(config.assessmentTone).toBe("grounded-advisory");
    expect(config.rateLimit.bedestenMinIntervalMs).toBe(2000);
    expect(config.rateLimit.bedestenBurst).toBe(5);
    expect(config.cache.ttlMs).toBe(300_000);
    expect(config.fetchTimeoutMs).toBe(15_000);
    expect(config.retry.maxRetries).toBe(2);
    expect(config.retry.initialBackoffMs).toBe(1000);
    expect(config.retry.maxBackoffMs).toBe(10_000);
  });

  it("should override timeBudget.deadlineMs from env", () => {
    process.env.DOKTOR_MCP_TIME_BUDGET_DEADLINE_MS = "45000";
    const config = readConfig();
    expect(config.timeBudget.deadlineMs).toBe(45_000);
  });

  it("should override sourceMode from env", () => {
    process.env.DOKTOR_MCP_SOURCE_MODE = "live";
    const config = readConfig();
    expect(config.sourceMode).toBe("live");
  });

  it("should override assessmentTone from env", () => {
    process.env.DOKTOR_MCP_ASSESSMENT_TONE = "strict";
    const config = readConfig();
    expect(config.assessmentTone).toBe("strict");
  });

  it("should override nested retry config", () => {
    process.env.DOKTOR_MCP_RETRY_MAX_RETRIES = "5";
    const config = readConfig();
    expect(config.retry.maxRetries).toBe(5);
  });

  it("should override nested rate limit config", () => {
    process.env.DOKTOR_MCP_RATE_LIMIT_BEDESTEN_BURST = "10";
    const config = readConfig();
    expect(config.rateLimit.bedestenBurst).toBe(10);
  });

  it("should override nested cache config", () => {
    process.env.DOKTOR_MCP_CACHE_TTL_MS = "600000";
    const config = readConfig();
    expect(config.cache.ttlMs).toBe(600_000);
  });

  it("should override fetchTimeoutMs from env", () => {
    process.env.DOKTOR_MCP_FETCH_TIMEOUT_MS = "20000";
    const config = readConfig();
    expect(config.fetchTimeoutMs).toBe(20_000);
  });

  it("should override boolean env vars correctly", () => {
    process.env.DOKTOR_MCP_RATE_LIMIT_BEDESTEN_ADAPTIVE_THROTTLE = "false";
    const config = readConfig();
    expect(config.rateLimit.bedestenAdaptiveThrottle).toBe(false);
  });

  it("should cache config after first read", () => {
    const config1 = readConfig();
    process.env.DOKTOR_MCP_TIME_BUDGET_DEADLINE_MS = "99999";
    const config2 = readConfig();
    // Cached, so should be same as first
    expect(config2.timeBudget.deadlineMs).toBe(config1.timeBudget.deadlineMs);
  });

  it("should reset cache with resetConfig", () => {
    const config1 = readConfig();
    process.env.DOKTOR_MCP_TIME_BUDGET_DEADLINE_MS = "99999";
    resetConfig();
    const config2 = readConfig();
    expect(config2.timeBudget.deadlineMs).toBe(99_999);
  });

  it("should ignore non-DOKTOR_MCP env vars", () => {
    process.env.OTHER_VAR = "test";
    const config = readConfig();
    expect(config.sourceMode).toBe("mock"); // unchanged
  });

  it("should throw for invalid enum values", () => {
    process.env.DOKTOR_MCP_SOURCE_MODE = "invalid_mode";
    expect(() => readConfig()).toThrow();
  });

  it("should have backward-compatible readRateLimitConfig", () => {
    const rateConfig = readRateLimitConfig();
    expect(rateConfig.bedestenMinIntervalMs).toBe(2000);
    expect(rateConfig.bedestenBurst).toBe(5);
    expect(rateConfig.bedestenConcurrency).toBe(1);
    expect(rateConfig.bedestenAdaptiveThrottle).toBe(true);
  });

  it("should apply multiple env overrides simultaneously", () => {
    process.env.DOKTOR_MCP_SOURCE_MODE = "live";
    process.env.DOKTOR_MCP_ASSESSMENT_TONE = "strict";
    process.env.DOKTOR_MCP_TIME_BUDGET_DEADLINE_MS = "60000";
    process.env.DOKTOR_MCP_FETCH_TIMEOUT_MS = "25000";
    const config = readConfig();
    expect(config.sourceMode).toBe("live");
    expect(config.assessmentTone).toBe("strict");
    expect(config.timeBudget.deadlineMs).toBe(60_000);
    expect(config.fetchTimeoutMs).toBe(25_000);
  });
});
