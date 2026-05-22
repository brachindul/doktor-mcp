import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import type { PrecedentSourceAdapter } from "../types.js";
import type { LiveYargitayResult, LiveYargitayUnavailable } from "./liveTypes.js";
import { YARGITAY_SOURCE } from "./liveTypes.js";
import {
  BEDESTEN_BASE_URL,
  BEDESTEN_PUBLIC_HEADERS,
  buildBedestenDocumentBody,
  buildBedestenSearchBody,
  normalizeBedestenDocumentResponse,
  normalizeBedestenSearchResponse
} from "../bedesten/bedestenApi.js";
import { extractLegalReasoning, extractOutcome } from "../precedentUtils.js";
import { HttpClient, BedestenRateLimitError, BedestenParseError, BedestenNetworkError } from "../../core/httpClient.js";

const SEARCH_URL = `${BEDESTEN_BASE_URL}/emsal-karar/searchDocuments`;
const MAX_RESULTS_PER_QUERY = 5;

export interface LiveYargitayAdapterOptions {
  httpClient?: HttpClient;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
}

export class LiveYargitayAdapter implements PrecedentSourceAdapter {
  private readonly httpClient: HttpClient;
  private readonly now: () => Date;

  constructor(options: LiveYargitayAdapterOptions = {}) {
    this.httpClient = options.httpClient ?? new HttpClient({
      baseUrl: BEDESTEN_BASE_URL,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.wait
    });
    this.now = options.now ?? (() => new Date());
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    const result = await this.searchAndNormalize(query);
    return result.status === "ok" ? result.decisions : [];
  }

  async searchAndNormalize(query: string): Promise<LiveYargitayResult> {
    const emptyTrace = this.buildEmptyTrace(query);

    const searchBody = buildBedestenSearchBody(query, ["YARGITAYKARARI"], MAX_RESULTS_PER_QUERY);
    
    let rawData: unknown;
    try {
      rawData = await this.httpClient.postJson<unknown>("/emsal-karar/searchDocuments", searchBody, {
        headers: BEDESTEN_PUBLIC_HEADERS
      });
    } catch (error) {
      const telemetry = (error as { telemetry?: { retryCount: number; backoffMs: number; httpStatus: number | null; contentType: string | null } }).telemetry;
      const errTrace = { ...emptyTrace, error: error instanceof Error ? error.message : String(error), ...(telemetry ?? {}) };
      if (error instanceof BedestenRateLimitError) {
        return unavailable("source_blocked", error.message, true, "Retry after the source cools down.", [errTrace]);
      }
      if (error instanceof BedestenParseError) {
        return unavailable("parse_failed", error.message, false, "Verify the upstream endpoint format.", [errTrace]);
      }
      if (error instanceof BedestenNetworkError) {
        const cause = (error.cause instanceof Error ? error.cause.message : String(error.cause ?? error.message));
        return unavailable("source_error", `Yargıtay (Bedesten) network error: ${cause}`, true, "Retry the request.", [{ ...emptyTrace, error: cause, ...(telemetry ?? {}) }]);
      }
      return unavailable("source_error", `Yargıtay (Bedesten) request failed: ${error instanceof Error ? error.message : String(error)}`, true, "Retry the request.", [errTrace]);
    }

    const searchResults = normalizeBedestenSearchResponse(rawData);
    const searchResultsCount = searchResults.length;
    const retrievedAt = this.now().toISOString();
    const searchTelemetry = this.httpClient.lastTelemetry;

    if (searchResultsCount === 0) {
      return {
        status: "ok",
        source: YARGITAY_SOURCE,
        query,
        searchResultsCount: 0,
        selectedResult: null,
        decisions: [],
        sourceTraces: [
          {
            ...emptyTrace,
            searchResultsCount: 0,
            retrievedAt,
            eligibilityStatus: "metadata_only",
            eligibilityReasons: [],
            exclusionReasons: ["Arama sonucu bulunamadı."],
            retryCount: searchTelemetry.retryCount,
            backoffMs: searchTelemetry.backoffMs,
            httpStatus: searchTelemetry.httpStatus,
            contentType: searchTelemetry.contentType
          }
        ]
      };
    }

    const decisions: CourtDecision[] = [];
    const sourceTraces: DecisionSourceTrace[] = [];

    for (const searchResult of searchResults.slice(0, MAX_RESULTS_PER_QUERY)) {
      let fullText: string | null = null;
      let fullTextRetrievalMethod: string | null = null;

      try {
        const docData = await this.httpClient.postJson<unknown>("/emsal-karar/getDocumentContent", buildBedestenDocumentBody(searchResult.documentId), {
          headers: BEDESTEN_PUBLIC_HEADERS
        });
        const doc = normalizeBedestenDocumentResponse(searchResult.documentId, docData);
        if (doc.contentBase64) {
          const html = Buffer.from(doc.contentBase64, "base64").toString("utf-8");
          fullText = this.stripHtml(html);
          fullTextRetrievalMethod = "bedesten-base64-html";
        }
      } catch {
        // Ignore document errors, fallback to metadata_only
      }

      const legalReasoning = fullText ? extractLegalReasoning(fullText) : undefined;
      const outcome = fullText ? extractOutcome(fullText) : undefined;
      const relevanceNote = fullText && legalReasoning
        ? `'${query}' sağlık hukuku aramasıyla eşleşti; tam metin ve gerekçe mevcut.`
        : undefined;

      const decision: CourtDecision = {
        id: `yargitay:${searchResult.documentId}`,
        court: "yargitay",
        chamber: searchResult.chamber || undefined,
        decisionDate: searchResult.decisionDate || undefined,
        meritsNumber: searchResult.esasNo || undefined,
        decisionNumber: searchResult.kararNo || undefined,
        factSummary: searchResult.title || undefined,
        legalReasoning,
        outcome,
        relevanceNote,
        topicTags: [],
        fullText: fullText || undefined,
        evidence: {
          source: "yargitay",
          documentId: searchResult.documentId,
          sourceUrl: `https://mevzuat.adalet.gov.tr/ictihat/${searchResult.documentId}`,
          retrievedAt,
          official: true,
          fullText: fullText !== null
        }
      };

      const { status, eligibilityReasons, exclusionReasons } = assessDecisionEligibility(decision);

      const trace: DecisionSourceTrace = {
        ...emptyTrace,
        searchResultsCount,
        selectedResult: { documentId: searchResult.documentId },
        selectedResultReason: `Health law term '${query}' matched Yargıtay (Bedesten) search.`,
        documentId: searchResult.documentId,
        sourceId: decision.id,
        fullTextAvailable: fullText !== null,
        fullTextRetrievalMethod,
        retrievedAt,
        eligibilityStatus: status,
        eligibilityReasons,
        exclusionReasons,
        retryCount: searchTelemetry.retryCount,
        backoffMs: searchTelemetry.backoffMs,
        httpStatus: searchTelemetry.httpStatus,
        contentType: searchTelemetry.contentType
      };

      decisions.push({ ...decision, decisionSourceTrace: trace });
      sourceTraces.push(trace);
    }

    return {
      status: "ok",
      source: YARGITAY_SOURCE,
      query,
      searchResultsCount,
      selectedResult: searchResults[0] ? {
        documentId: searchResults[0].documentId,
        sourceUrl: `https://mevzuat.adalet.gov.tr/ictihat/${searchResults[0].documentId}`
      } : null,
      decisions,
      sourceTraces
    };
  }

  private buildEmptyTrace(query: string): DecisionSourceTrace {
    return {
      query,
      source: "yargitay",
      court: "yargitay",
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

  private stripHtml(html: string): string {
    return html.replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function unavailable(
  errorCode: LiveYargitayUnavailable["errorCode"],
  message: string,
  retryable: boolean,
  recommendedNextStep: string,
  sourceTrace?: DecisionSourceTrace[]
): LiveYargitayUnavailable {
  return { status: "unavailable", source: YARGITAY_SOURCE, errorCode, message, retryable, recommendedNextStep, ...(sourceTrace ? { sourceTrace } : {}) };
}
