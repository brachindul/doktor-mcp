import { bedestenRateLimiter, type RateLimiter, type SleepFn } from "./rateLimiter.js";

export interface HttpClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryFallbackMs?: number;
  rateLimiter?: RateLimiter;
  sleep?: SleepFn;
  random?: () => number;
  onRetry?: (message: string) => void;
}

export interface RequestJsonOptions {
  headers?: HeadersInit;
}

export class BedestenNetworkError extends Error {
  constructor(cause?: unknown) {
    super("Bedesten’e bağlanılamadı.");
    this.name = "BedestenNetworkError";
    this.cause = cause;
  }
}

export class BedestenHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseText: string
  ) {
    super(`Bedesten isteği başarısız oldu (HTTP ${status}).`);
    this.name = "BedestenHttpError";
  }
}

export class BedestenRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(
      `Bedesten geçici olarak çok fazla istek uyarısı verdi. ${Math.ceil(
        retryAfterMs / 1_000
      )} saniye sonra tekrar denenebilir.`
    );
    this.name = "BedestenRateLimitError";
  }
}

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryFallbackMs: number;
  private readonly rateLimiter: RateLimiter;
  private readonly sleep: SleepFn;
  private readonly random: () => number;
  private readonly onRetry?: (message: string) => void;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryFallbackMs = options.retryFallbackMs ?? 5_000;
    this.rateLimiter = options.rateLimiter ?? bedestenRateLimiter;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.onRetry = options.onRetry;
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

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;

      try {
        response = await this.rateLimiter.schedule(() => this.fetchImpl(url, init));
      } catch (error) {
        throw new BedestenNetworkError(error);
      }

      if (response.status === 429) {
        this.rateLimiter.notifyThrottled();
        const retryAfterMs = this.retryDelayMs(response.headers.get("Retry-After"), attempt);
        const message = `Bedesten geçici olarak çok fazla istek uyarısı verdi. ${Math.ceil(
          retryAfterMs / 1_000
        )} saniye sonra tekrar denenecek.`;

        if (attempt >= this.maxRetries) {
          throw new BedestenRateLimitError(retryAfterMs);
        }

        this.onRetry?.(message);
        await this.sleep(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        throw new BedestenHttpError(response.status, await response.text());
      }

      return parseResponse<T>(response);
    }

    throw new BedestenRateLimitError(this.retryFallbackMs);
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

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}
