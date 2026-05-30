import { bedestenRateLimiter, RateLimiter, type SleepFn } from "./rateLimiter.js";
import { policyForSource, withTimeout } from "../live/requestPolicy.js";

export interface HttpClientOptions {
  baseUrl: string;
  /** Human-readable source label used in error messages (e.g. "bedesten", "yargitay", "danistay"). */
  source?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryFallbackMs?: number;
  /** Per-request timeout in ms. Defaults to the "bedesten-search" policy timeout (12 s). */
  timeoutMs?: number;
  rateLimiter?: RateLimiter;
  sleep?: SleepFn;
  /** Alias for sleep — kept for backward compatibility with adapter `wait` option. */
  wait?: SleepFn;
  random?: () => number;
  onRetry?: (message: string) => void;
}

export interface RequestJsonOptions {
  headers?: RequestInit["headers"];
}

export interface HttpRequestTelemetry {
  retryCount: number;
  backoffMs: number;
  httpStatus: number | null;
  contentType: string | null;
  timedOut: boolean;
}

export class LiveSourceNetworkError extends Error {
  public readonly telemetry: HttpRequestTelemetry;
  constructor(
    public readonly source: string,
    cause?: unknown,
    telemetry?: HttpRequestTelemetry
  ) {
    super(`${source} ile bağlantı kurulamadı.`);
    this.name = "LiveSourceNetworkError";
    this.cause = cause;
    this.telemetry = telemetry ?? { retryCount: 0, backoffMs: 0, httpStatus: null, contentType: null, timedOut: false };
  }
}

/** @deprecated Use `LiveSourceNetworkError` instead. */
export class BedestenNetworkError extends LiveSourceNetworkError {
  constructor(cause?: unknown, telemetry?: HttpRequestTelemetry) {
    super("bedesten", cause, telemetry);
    this.name = "BedestenNetworkError";
  }
}

export class LiveSourceHttpError extends Error {
  public readonly telemetry: HttpRequestTelemetry;
  constructor(
    public readonly source: string,
    public readonly status: number,
    public readonly responseText: string,
    telemetry?: HttpRequestTelemetry
  ) {
    super(`${source} isteği başarısız oldu (HTTP ${status}).`);
    this.name = "LiveSourceHttpError";
    this.telemetry = telemetry ?? { retryCount: 0, backoffMs: 0, httpStatus: status, contentType: null, timedOut: false };
  }
}

/** @deprecated Use `LiveSourceHttpError` instead. */
export class BedestenHttpError extends LiveSourceHttpError {
  constructor(status: number, responseText: string, telemetry?: HttpRequestTelemetry) {
    super("bedesten", status, responseText, telemetry);
    this.name = "BedestenHttpError";
  }
}

export class LiveSourceRateLimitError extends Error {
  public readonly telemetry: HttpRequestTelemetry;
  constructor(
    public readonly source: string,
    public readonly retryAfterMs: number,
    telemetry?: HttpRequestTelemetry
  ) {
    super(
      `${source} geçici olarak çok fazla istek uyarısı verdi. ${Math.ceil(
        retryAfterMs / 1_000
      )} saniye sonra tekrar denenebilir.`
    );
    this.name = "LiveSourceRateLimitError";
    this.telemetry = telemetry ?? { retryCount: 0, backoffMs: retryAfterMs, httpStatus: 429, contentType: null, timedOut: false };
  }
}

/** @deprecated Use `LiveSourceRateLimitError` instead. */
export class BedestenRateLimitError extends LiveSourceRateLimitError {
  constructor(retryAfterMs: number, telemetry?: HttpRequestTelemetry) {
    super("bedesten", retryAfterMs, telemetry);
    this.name = "BedestenRateLimitError";
  }
}

export class LiveSourceParseError extends Error {
  public readonly telemetry: HttpRequestTelemetry;
  constructor(
    public readonly source: string,
    message: string,
    cause?: unknown,
    telemetry?: HttpRequestTelemetry
  ) {
    super(message);
    this.name = "LiveSourceParseError";
    this.cause = cause;
    this.telemetry = telemetry ?? { retryCount: 0, backoffMs: 0, httpStatus: null, contentType: null, timedOut: false };
  }
}

/** @deprecated Use `LiveSourceParseError` instead. */
export class BedestenParseError extends LiveSourceParseError {
  constructor(message: string, cause?: unknown, telemetry?: HttpRequestTelemetry) {
    super("bedesten", message, cause, telemetry);
    this.name = "BedestenParseError";
  }
}
const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class HttpClient {
  private readonly source: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryFallbackMs: number;
  private readonly timeoutMs: number;
  private readonly rateLimiter: RateLimiter;
  private readonly sleep: SleepFn;
  private readonly random: () => number;
  private readonly onRetry?: (message: string) => void;
  /** Last request telemetry (read by adapters to enrich traces). */
  public lastTelemetry: HttpRequestTelemetry = {
    retryCount: 0,
    backoffMs: 0,
    httpStatus: null,
    contentType: null,
    timedOut: false
  };

  constructor(options: HttpClientOptions) {
    this.source = options.source ?? "bedesten";
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryFallbackMs = options.retryFallbackMs ?? 5_000;
    this.timeoutMs = options.timeoutMs ?? policyForSource("bedesten-search").timeoutMs;
    const providedSleep = options.sleep ?? options.wait;
    this.sleep = providedSleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.onRetry = options.onRetry;
    // When a custom sleep was provided (test environment), use a per-instance
    // rate limiter that respects that sleep — otherwise we'd hit the shared
    // global limiter whose timers are real and cause test timeouts.
    if (options.rateLimiter) {
      this.rateLimiter = options.rateLimiter;
    } else if (providedSleep) {
      this.rateLimiter = new RateLimiter({
        minIntervalMs: 0,
        burst: 10,
        concurrency: 5,
        adaptiveThrottle: false,
        sleep: providedSleep
      });
    } else {
      this.rateLimiter = bedestenRateLimiter;
    }
  }

  postJson<T>(path: string, body: unknown, options: RequestJsonOptions = {}): Promise<T> {
    return this.requestJson<T>(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...options.headers
      },
      body: JSON.stringify(body)
    });
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    let totalBackoffMs = 0;
    let retryCount = 0;
    let lastStatus: number | null = null;
    let lastContentType: string | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;

      try {
        response = await this.rateLimiter.schedule(() => withTimeout(this.fetchImpl, url, init, this.timeoutMs));
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "AbortError";
        this.lastTelemetry = {
          retryCount,
          backoffMs: totalBackoffMs,
          httpStatus: lastStatus,
          contentType: lastContentType,
          timedOut
        };
        throw new LiveSourceNetworkError(this.source, error, this.lastTelemetry);
      }

      lastStatus = response.status;
      lastContentType = response.headers.get("Content-Type");

      if (response.status === 429) {
        this.rateLimiter.notifyThrottled();
        const retryAfterMs = this.retryDelayMs(response.headers.get("Retry-After"), attempt);
        const message = `${this.source} geçici olarak çok fazla istek uyarısı verdi. ${Math.ceil(
          retryAfterMs / 1_000
        )} saniye sonra tekrar denenecek.`;

        if (attempt >= this.maxRetries) {
          this.lastTelemetry = {
            retryCount,
            backoffMs: totalBackoffMs,
            httpStatus: 429,
            contentType: lastContentType,
            timedOut: false
          };
          throw new LiveSourceRateLimitError(this.source, retryAfterMs, this.lastTelemetry);
        }

        this.onRetry?.(message);
        retryCount += 1;
        totalBackoffMs += retryAfterMs;
        await this.sleep(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        this.lastTelemetry = {
          retryCount,
          backoffMs: totalBackoffMs,
          httpStatus: response.status,
          contentType: lastContentType,
          timedOut: false
        };
        throw new LiveSourceHttpError(this.source, response.status, await response.text(), this.lastTelemetry);
      }

      this.lastTelemetry = {
        retryCount,
        backoffMs: totalBackoffMs,
        httpStatus: response.status,
        contentType: lastContentType,
        timedOut: false
      };

      return parseResponse<T>(response, this.lastTelemetry, this.source);
    }

    this.lastTelemetry = {
      retryCount,
      backoffMs: totalBackoffMs,
      httpStatus: lastStatus,
      contentType: lastContentType,
      timedOut: false
    };
    throw new LiveSourceRateLimitError(this.source, this.retryFallbackMs, this.lastTelemetry);
  }

  private retryDelayMs(retryAfterHeader: string | null, attempt: number): number {
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader);

    if (retryAfterMs !== null) {
      return retryAfterMs;
    }

    return jitterDelay(this.retryFallbackMs * 2 ** attempt, this.random);
  }
}

export function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

export function jitterDelay(delayMs: number, random: () => number = Math.random): number {
  return Math.max(0, Math.round(delayMs * (0.8 + random() * 0.4)));
}

async function parseResponse<T>(response: Response, telemetry: HttpRequestTelemetry, source: string = "bedesten"): Promise<T> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new LiveSourceParseError(
        source,
        `${source} yanıtı JSON olarak ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)}`,
        error,
        telemetry
      );
    }
  }

  return (await response.text()) as T;
}
