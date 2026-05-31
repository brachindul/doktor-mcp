import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import { deriveContentStatus, isQuoteUsable, buildDecisionKey } from "../../live/decisionProvenance.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import type { PrecedentSourceAdapter } from "../types.js";
import type { LiveDanistayResult, LiveDanistayUnavailable } from "./liveTypes.js";
import { DANISTAY_SOURCE } from "./liveTypes.js";
import { extractDanistayFullText, classifyNonJsonResponse } from "./danistayNormalizer.js";
import { extractLegalReasoning, extractOutcome } from "../precedentUtils.js";
import { PrecedentCache } from "../precedentCache.js";
import type { AdapterRequestTelemetry } from "../../contracts/queryTelemetry.js";
import { defaultAdapterRequestTelemetry } from "../../contracts/queryTelemetry.js";
import { withTimeout, policyForSource, classifyLiveError } from "../../live/requestPolicy.js";

const BASE_URL = "https://karararama.danistay.gov.tr";
const SEARCH_URL = `${BASE_URL}/aramalist`;
const MAX_RESULTS_PER_QUERY = 5;

export interface LiveDanistayAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  cache?: PrecedentCache;
}

export class LiveDanistayAdapter implements PrecedentSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly cache: PrecedentCache;
  /** Telemetry from the most recent searchAndNormalize call. */
  public lastRequestTelemetry: AdapterRequestTelemetry = defaultAdapterRequestTelemetry();
  /** Internal retry counter, reset per searchAndNormalize call. */
  private _retryCount = 0;
  private _totalBackoffMs = 0;
  private _timedOut = false;

  constructor(options: LiveDanistayAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.cache = options.cache ?? PrecedentCache.disabled();
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    const result = await this.searchAndNormalize(query);
    return result.status === "ok" ? result.decisions : [];
  }

  async searchAndNormalize(query: string): Promise<LiveDanistayResult> {
    this.lastRequestTelemetry = defaultAdapterRequestTelemetry();
    this._retryCount = 0;
    this._totalBackoffMs = 0;
    this._timedOut = false;

    // Cache lookup
    const cacheLookup = await this.cache.getWithMeta<LiveDanistayResult>("danistay", query, MAX_RESULTS_PER_QUERY);
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

    const searchRequest = { url: SEARCH_URL, phrase: query, pageSize: MAX_RESULTS_PER_QUERY };
    const emptyTrace = this.buildEmptyTrace(query, searchRequest);

    const response = await this.fetchWithRetry(SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${BASE_URL}/`,
        "User-Agent": "doktor-mcp/0.14 danistay-emsal-check"
      },
      body: JSON.stringify(buildSearchBody(query))
    });

    if (isUnavailable(response)) {
      const err = response as LiveDanistayUnavailable;
      // Update telemetry before early return so timedOut is propagated
      this.lastRequestTelemetry = {
        ...this.lastRequestTelemetry,
        retryCount: this._retryCount,
        backoffMs: this._totalBackoffMs,
        timedOut: this._timedOut
      };
      return { ...err, sourceTrace: [{ ...emptyTrace, error: err.message }] };
    }

    let rawData: any;
    try {
      const rawText = await (response as Response).text();
      try {
        rawData = JSON.parse(rawText);
      } catch {
        const kind = classifyNonJsonResponse(rawText);
        return unavailable("parse_failed", `Danıştay emsal search response is not parseable JSON (${kind}).`, false, "Check endpoint", [{ ...emptyTrace, error: `non_json_response:${kind}` }]);
      }
    } catch {
      return unavailable("parse_failed", "Danıştay search response could not be read.", true, "Check endpoint", [{ ...emptyTrace, error: "response_read_failed" }]);
    }

    const items: any[] = rawData?.data?.data ?? [];
    const searchResultsCount = rawData?.data?.recordsFiltered ?? rawData?.data?.recordsTotal ?? items.length;
    const retrievedAt = this.now().toISOString();

    if (searchResultsCount === 0 || items.length === 0) {
      return {
        status: "ok",
        source: DANISTAY_SOURCE,
        query,
        searchResultsCount: 0,
        selectedResult: null,
        decisions: [],
        sourceTraces: [{
          ...emptyTrace,
          searchResultsCount: 0,
          retrievedAt,
          eligibilityStatus: "metadata_only",
          eligibilityReasons: [],
          exclusionReasons: ["Arama sonucu bulunamadı."]
        }]
      };
    }

    const decisions: CourtDecision[] = [];
    const sourceTraces: DecisionSourceTrace[] = [];

    // Capture timedOut state from the search phase; fullText fetches are best-effort
    // and their timeout state should not pollute the primary search telemetry.
    const searchPhaseTimedOut = this._timedOut;

    for (const item of items.slice(0, MAX_RESULTS_PER_QUERY)) {
      const documentId = item.id ? String(item.id).trim() : "";
      if (!documentId) continue;

      const chamber = item.daireKurul ?? item.daire ?? undefined;
      const esasNo = item.esasNo ?? undefined;
      const kararNo = item.kararNo ?? undefined;
      const decisionDate = item.kararTarihi ?? undefined;
      
      const titleParts = ["Danıştay", chamber, esasNo, kararNo].filter(Boolean);
      const title = titleParts.join(" | ") || `Danıştay Kararı ${documentId}`;

      let fullText: string | null = null;
      let fullTextRetrievalMethod: string | null = null;
      const docUrl = `${BASE_URL}/getDokuman?id=${encodeURIComponent(documentId)}&arananKelime=`;

      // Check full-text cache first
      const docId = `danistay:${documentId}`;
      const cached = await this.cache.getFullText(docId);
      if (cached) {
        fullText = cached.text;
        fullTextRetrievalMethod = "html-text-cache";
      } else {
        const text = await this.fetchFullText(docUrl);
        if (text !== null) {
          fullText = text;
          fullTextRetrievalMethod = "html-text";
          await this.cache.setFullText(docId, fullText);
        }
      }

      const legalReasoning = fullText ? extractLegalReasoning(fullText) : undefined;
      const outcome = fullText ? extractOutcome(fullText) : undefined;
      const relevanceNote = fullText && legalReasoning
        ? `'${query}' sağlık hukuku aramasıyla eşleşti; tam metin ve gerekçe mevcut.`
        : undefined;

      const decision: CourtDecision = {
        id: `danistay:${documentId}`,
        court: "danistay",
        chamber,
        decisionDate,
        meritsNumber: esasNo,
        decisionNumber: kararNo,
        factSummary: title,
        legalReasoning,
        outcome,
        relevanceNote,
        topicTags: [],
        fullText: fullText || undefined,
        evidence: {
          source: "danistay",
          documentId,
          sourceUrl: docUrl,
          retrievedAt,
          official: true,
          fullText: fullText !== null
        }
      };

      const { status, eligibilityReasons, exclusionReasons } = assessDecisionEligibility(decision);

      const trace: DecisionSourceTrace = {
        ...emptyTrace,
        searchResultsCount,
        selectedResult: { documentId, title },
        selectedResultReason: `Health law term '${query}' matched Danıştay emsal search.`,
        documentId,
        sourceId: decision.id,
        fullTextAvailable: fullText !== null,
        fullTextRetrievalMethod,
        retrievedAt,
        eligibilityStatus: status,
        eligibilityReasons,
        exclusionReasons
      };

      const decisionWithTrace: CourtDecision = { ...decision, decisionSourceTrace: trace };
      const contentStatus = deriveContentStatus(decisionWithTrace);
      const quoteUsable = isQuoteUsable(decisionWithTrace);
      const normalizedDecisionKey = buildDecisionKey(decisionWithTrace) ?? undefined;
      const fetchStatus = fullText !== null ? "full_text_fetched" : "metadata_only";
      decisionWithTrace.contentStatus = contentStatus;
      decisionWithTrace.quoteUsable = quoteUsable;
      decisionWithTrace.normalizedDecisionKey = normalizedDecisionKey;
      decisionWithTrace.provenance = [{
        source: "danistay",
        fetchStatus,
        contentStatus,
        quoteUsable,
        fetchedAt: retrievedAt
      }];

      decisions.push(decisionWithTrace);
      sourceTraces.push(trace);
    }

    // Restore search-phase timedOut; fullText timeouts are swallowed and non-critical.
    this._timedOut = searchPhaseTimedOut;

    const result: LiveDanistayResult = {
      status: "ok",
      source: DANISTAY_SOURCE,
      query,
      searchResultsCount,
      selectedResult: items[0] ?? null,
      decisions,
      sourceTraces
    };

    // Update HTTP telemetry from accumulated retry counters
    this.lastRequestTelemetry = {
      ...this.lastRequestTelemetry,
      retryCount: this._retryCount,
      backoffMs: this._totalBackoffMs,
      timedOut: this._timedOut
    };

    // Write to cache for warm runs
    await this.cache.set("danistay", query, MAX_RESULTS_PER_QUERY, result);

    return result;
  }

  private async fetchFullText(url: string): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: `${BASE_URL}/`,
          "User-Agent": "doktor-mcp/0.14 danistay-emsal-check"
        }
      });
      if (isUnavailable(response)) return null;
      const body = await (response as Response).text();
      return extractDanistayFullText(body) || body.trim() || null;
    } catch {
      return null;
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response | LiveDanistayUnavailable> {
    const policy = policyForSource("danistay-search");
    const delays = [0, 250, 750];

    for (const delay of delays) {
      if (delay > 0) {
        this._retryCount += 1;
        this._totalBackoffMs += delay;
        await this.wait(delay);
      }

      try {
        const response = await withTimeout(this.fetchImpl, url, init, policy.timeoutMs);
        if (response.ok) return response;
        if ((response.status === 403 || response.status === 429) && delay !== delays.at(-1)) continue;
        if (response.status >= 500 && delay !== delays.at(-1)) continue;

        if (response.status === 403 || response.status === 429) {
          return unavailable("source_blocked", `Danıştay source returned HTTP ${response.status}.`, true, "Retry after the source cools down.");
        }
        return unavailable(
          response.status >= 500 ? "source_error" : "document_not_found",
          `Danıştay source returned HTTP ${response.status}.`,
          response.status >= 500,
          "Retry the request or verify the endpoint."
        );
      } catch (error) {
        const kind = classifyLiveError(error);
        if (kind === "timeout") this._timedOut = true;
        if (delay !== delays.at(-1)) continue;
        const message = kind === "timeout"
          ? `Danıştay request timed out after ${policy.timeoutMs}ms.`
          : `Danıştay request failed: ${error instanceof Error ? error.message : String(error)}`;
        return unavailable("source_error", message, true, "Retry after checking network access.");
      }
    }

    return unavailable("source_error", "Danıştay request ended unexpectedly.", true, "Retry the request.");
  }

  private buildEmptyTrace(query: string, searchRequest: { url: string; phrase: string; pageSize: number }): DecisionSourceTrace {
    return {
      query,
      source: "danistay",
      court: "danistay",
      searchRequest,
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

function buildSearchBody(query: string) {
  const trimmedQuery = query.trim();
  return {
    data: {
      andKelimeler: trimmedQuery ? [`"${trimmedQuery.replace(/^"|"$/g, "")}"`] : [],
      orKelimeler: [],
      notAndKelimeler: [],
      notOrKelimeler: [],
      pageSize: MAX_RESULTS_PER_QUERY,
      pageNumber: 1
    }
  };
}

function unavailable(
  errorCode: LiveDanistayUnavailable["errorCode"],
  message: string,
  retryable: boolean,
  recommendedNextStep: string,
  sourceTrace?: DecisionSourceTrace[]
): LiveDanistayUnavailable {
  return { status: "unavailable", source: DANISTAY_SOURCE, errorCode, message, retryable, recommendedNextStep, ...(sourceTrace ? { sourceTrace } : {}) };
}

function isUnavailable(value: unknown): value is LiveDanistayUnavailable {
  return typeof value === "object" && value !== null && "status" in value && (value as { status: unknown }).status === "unavailable";
}
