export interface RateLimitConfig {
  bedestenMinIntervalMs: number;
  bedestenBurst: number;
  bedestenConcurrency: number;
  bedestenAdaptiveThrottle: boolean;
}

export function readRateLimitConfig(): RateLimitConfig {
  return {
    bedestenMinIntervalMs: 2000,
    bedestenBurst: 5,
    bedestenConcurrency: 1,
    bedestenAdaptiveThrottle: true
  };
}
