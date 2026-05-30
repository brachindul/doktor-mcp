/**
 * Live AYM (Anayasa Mahkemesi) adapter skeleton.
 *
 * AYM Kararlar Bilgi Bankası (kararlarbilgibankasi.anayasa.gov.tr) is a
 * server-rendered HTML application with no public JSON API. The search form
 * at `/Ara` accepts GET parameters and returns full HTML pages.
 *
 * This adapter probes the endpoint once, detects HTML-only responses, and
 * operates in "synthetic_only" mode when no JSON API is available.
 * NEVER fabricates decision text or court decisions.
 */

import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import type { PrecedentSourceAdapter } from "../types.js";
import type { LiveAymResult, LiveAymUnavailable } from "./liveTypes.js";
import { AYM_SOURCE } from "./liveTypes.js";
import { PrecedentCache } from "../precedentCache.js";
import type { AdapterRequestTelemetry } from "../../contracts/queryTelemetry.js";
import { defaultAdapterRequestTelemetry } from "../../contracts/queryTelemetry.js";
import { readConfig } from "../../core/runtimeConfig.js";

const BASE_URL = "https://kararlarbilgibankasi.anayasa.gov.tr";
const SEARCH_URL = `${BASE_URL}/Ara`;
const MAX_RESULTS_PER_QUERY = 5;

export interface LiveAymAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  cache?: PrecedentCache;
}

export class LiveAymAdapter implements PrecedentSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly cache: PrecedentCache;

  /** Telemetry from the most recent searchAndNormalize call. */
  public lastRequestTelemetry: AdapterRequestTelemetry = defaultAdapterRequestTelemetry();

  /** One-time calibration state */
  private calibrationChecked = false;
  private endpointReachable = false;
  private endpointContentType: string | null = null;

  constructor(options: LiveAymAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.cache = options.cache ?? PrecedentCache.disabled();
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    const result = await this.searchAndNormalize(query);
    return result.status === "ok" ? result.decisions : [];
  }

  async searchAndNormalize(query: string): Promise<LiveAymResult> {
    this.lastRequestTelemetry = defaultAdapterRequestTelemetry();

    // Cache lookup
    const cacheLookup = await this.cache.getWithMeta<LiveAymResult>("aym", query, MAX_RESULTS_PER_QUERY);
    if (cacheLookup.hit && cacheLookup.value !== null) {
      this.lastRequestTelemetry = {
        ...defaultAdapterRequestTelemetry(),
        cacheHit: true,
        cacheMiss: false,
        servedFromCache: true,
        networkRequestMade: false,
        cacheAgeMs: cacheLookup.ageMs
      };
      return cacheLookup.value;
    }
    this.lastRequestTelemetry.cacheMiss = true;

    const emptyTrace = this.buildEmptyTrace(query);

    // One-time calibration: probe the endpoint
    if (!this.calibrationChecked) {
      await this.calibrateEndpoint();
    }

    if (!this.endpointReachable) {
      const result: LiveAymUnavailable = {
        status: "unavailable",
        source: AYM_SOURCE,
        errorCode: "endpoint_html_only",
        message: "AYM Kararlar Bilgi Bankası yalnızca HTML sayfa döndürüyor. JSON API mevcut değil.",
        retryable: false,
        recommendedNextStep: "AYM kararları için tarayıcı DevTools ile gerçek arama isteğini yakalayın veya normkararlarbilgibankasi.anayasa.gov.tr alt domainini kontrol edin.",
        sourceTrace: [{ ...emptyTrace, error: "endpoint_html_only" }]
      };
      return result;
    }

    // If we ever reach JSON (future discovery), implement real parsing here.
    // For now, this branch is unreachable — the calibration detects HTML.
    const result: LiveAymResult = {
      status: "ok",
      source: AYM_SOURCE,
      query,
      searchResultsCount: 0,
      selectedResult: null,
      decisions: [],
      sourceTraces: [{
        ...emptyTrace,
        searchResultsCount: 0,
        retrievedAt: this.now().toISOString(),
        eligibilityStatus: "metadata_only",
        eligibilityReasons: [],
        exclusionReasons: ["AYM JSON API henüz desteklenmiyor."]
      }]
    };

    await this.cache.set("aym", query, MAX_RESULTS_PER_QUERY, result);
    return result;
  }

  /**
   * Probe the AYM endpoint once to determine if it serves JSON or HTML.
   * This runs only on the first searchAndNormalize call.
   */
  private async calibrateEndpoint(): Promise<void> {
    this.calibrationChecked = true;
    const timeoutMs = readConfig().fetchTimeoutMs;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await this.fetchImpl(SEARCH_URL, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "doktor-mcp/0.14 aym-probe"
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      const contentType = response.headers.get("content-type") ?? "";
      this.endpointContentType = contentType;

      if (response.ok && (contentType.includes("json"))) {
        this.endpointReachable = true;
      } else if (response.ok && (contentType.includes("html") || contentType.includes("text"))) {
        // HTML-only — no JSON API available
        this.endpointReachable = false;
      } else {
        // HTTP error or unexpected
        this.endpointReachable = false;
      }
    } catch {
      this.endpointReachable = false;
    }
  }

  private buildEmptyTrace(query: string): DecisionSourceTrace {
    return {
      query,
      source: "aym",
      court: "aym",
      searchRequest: { url: SEARCH_URL, phrase: query, pageSize: MAX_RESULTS_PER_QUERY },
      searchResultsCount: null,
      selectedResult: null,
      selectedResultReason: null,
      documentId: "",
      fullTextAvailable: false,
      fullTextRetrievalMethod: null,
      retrievedAt: null,
      eligibilityStatus: "metadata_only",
      eligibilityReasons: [],
      exclusionReasons: []
    };
  }
}
