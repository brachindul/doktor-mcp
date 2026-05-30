import { readConfig } from "./runtimeConfig.js";

export type SleepFn = (ms: number) => Promise<void>;

export interface RateLimiterOptions {
  minIntervalMs?: number;
  burst?: number;
  concurrency?: number;
  adaptiveThrottle?: boolean;
  maxIntervalMs?: number;
  cooldownMs?: number;
  recoveryFactor?: number;
  sleep?: SleepFn;
  now?: () => number;
}

interface QueuedTask<T> {
  task: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class RateLimiter {
  readonly minIntervalMs: number;
  readonly burst: number;
  readonly concurrency: number;
  private readonly adaptiveThrottle: boolean;
  private readonly maxIntervalMs: number;
  private readonly cooldownMs: number;
  private readonly recoveryFactor: number;
  private readonly sleep: SleepFn;
  private readonly now: () => number;
  private readonly queue: Array<QueuedTask<unknown>> = [];
  private activeCount = 0;
  private tokens: number;
  private lastRefillAt: number;
  private currentIntervalMs: number;
  private lastThrottledAt: number | null = null;
  private tokenWakeup: Promise<void> | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.minIntervalMs = Math.max(0, options.minIntervalMs ?? 2_000);
    this.burst = clampInteger(options.burst ?? 1, 1, 10);
    this.concurrency = clampInteger(options.concurrency ?? 1, 1, 10);
    this.adaptiveThrottle = options.adaptiveThrottle ?? true;
    this.maxIntervalMs = Math.max(this.minIntervalMs, options.maxIntervalMs ?? this.minIntervalMs * 8);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 60_000);
    this.recoveryFactor = clampRecoveryFactor(options.recoveryFactor ?? 0.5);
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.tokens = this.burst;
    this.lastRefillAt = this.now();
    this.currentIntervalMs = this.minIntervalMs;
  }

  schedule<T>(task: () => Promise<T> | T): Promise<T> {
    const run = new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve: resolve as (value: unknown) => void,
        reject
      });
    });

    this.drain();

    return run;
  }

  notifyThrottled(): void {
    if (!this.adaptiveThrottle) {
      return;
    }

    this.currentIntervalMs = Math.min(this.maxIntervalMs, this.currentIntervalMs * 2);
    this.lastThrottledAt = this.now();
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const delayMs = this.consumeTokenOrDelay();

      if (delayMs > 0) {
        this.scheduleTokenWakeup(delayMs);
        return;
      }

      const queued = this.queue.shift();

      if (!queued) {
        return;
      }

      this.start(queued);
    }
  }

  private consumeTokenOrDelay(): number {
    if (this.currentIntervalMs === 0) {
      this.tokens = this.burst;
      return 0;
    }

    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }

    return Math.ceil((1 - this.tokens) * this.currentIntervalMs);
  }

  private refillTokens(): void {
    this.maybeRecover();
    const current = this.now();
    const elapsed = Math.max(0, current - this.lastRefillAt);

    if (elapsed > 0) {
      this.tokens = Math.min(this.burst, this.tokens + elapsed / this.currentIntervalMs);
      this.lastRefillAt = current;
    }
  }

  private maybeRecover(): void {
    if (
      !this.adaptiveThrottle ||
      this.lastThrottledAt === null ||
      this.currentIntervalMs <= this.minIntervalMs ||
      this.cooldownMs === 0
    ) {
      return;
    }

    const current = this.now();

    if (current - this.lastThrottledAt >= this.cooldownMs) {
      this.currentIntervalMs = Math.max(this.minIntervalMs, this.currentIntervalMs * this.recoveryFactor);
      this.lastThrottledAt = current;
    }
  }

  private scheduleTokenWakeup(delayMs: number): void {
    if (this.tokenWakeup) {
      return;
    }

    this.tokenWakeup = this.sleep(delayMs).then(
      () => {
        this.tokenWakeup = null;
        this.drain();
      },
      () => {
        this.tokenWakeup = null;
        this.drain();
      }
    );
  }

  private start<T>(queued: QueuedTask<T>): void {
    this.activeCount += 1;

    Promise.resolve()
      .then(() => queued.task())
      .then(queued.resolve, queued.reject)
      .finally(() => {
        this.activeCount -= 1;
        this.drain();
      });
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampRecoveryFactor(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    return 0.5;
  }

  return value;
}

const rateLimitConfig = readConfig().rateLimit;

export const bedestenRateLimiter = new RateLimiter({
  minIntervalMs: rateLimitConfig.bedestenMinIntervalMs,
  burst: rateLimitConfig.bedestenBurst,
  concurrency: rateLimitConfig.bedestenConcurrency,
  adaptiveThrottle: rateLimitConfig.bedestenAdaptiveThrottle
});
