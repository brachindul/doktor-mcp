import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import type { PrecedentSourceAdapter } from "../types.js";
import type { LiveDanistayResult, LiveDanistayUnavailable } from "./liveTypes.js";
import { DANISTAY_SOURCE } from "./liveTypes.js";
import { extractDanistayFullText, classifyNonJsonResponse } from "./danistayNormalizer.js";
import { extractLegalReasoning, extractOutcome } from "../precedentUtils.js";

const BASE_URL = "https://karararama.danistay.gov.tr";
const SEARCH_URL = `${BASE_URL}/aramalist`;
const MAX_RESULTS_PER_QUERY = 5;

export interface LiveDanistayAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
}

export class LiveDanistayAdapter implements PrecedentSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(options: LiveDanistayAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    const result = await this.searchAndNormalize(query);
    return result.status === "ok" ? result.decisions : [];
  }

  async searchAndNormalize(query: string): Promise<LiveDanistayResult> {
    const searchRequest = { url: SEARCH_URL, phrase: query, pageSize: MAX_RESULTS_PER_QUERY };
    const emptyTrace = this.buildEmptyTrace(query, searchRequest);

    const response = await this.fetchWithRetry(SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${BASE_URL}/`,
        "User-Agent": "physician-legal-mcp/0.14 danistay-emsal-check"
      },
      body: JSON.stringify(buildSearchBody(query))
    });

    if (isUnavailable(response)) {
      const err = response as LiveDanistayUnavailable;
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

    for (const item of items.slice(0, MAX_RESULTS_PER_QUERY)) {
      const documentId = item.id ? String(item.id).trim() : "";
      if (!documentId) continue;

      const chamber = item.daireKurul ?? item.daire ?? undefined;
      const esasNo = item.esasNo ?? undefined;
      const kararNo = item.kararNo ?? undefined;
      const decisionDate = item.kararTarihi ?? undefined;
      const summary = item.arananKelime ?? undefined;
      
      const titleParts = ["Danıştay", chamber, esasNo, kararNo].filter(Boolean);
      const title = titleParts.join(" | ") || `Danıştay Kararı ${documentId}`;

      let fullText: string | null = null;
      let fullTextRetrievalMethod: string | null = null;

      const docUrl = `${BASE_URL}/getDokuman?id=${encodeURIComponent(documentId)}&arananKelime=`;
      const text = await this.fetchFullText(docUrl);
      if (text !== null) {
        fullText = text;
        fullTextRetrievalMethod = "html-text";
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

      decisions.push({ ...decision, decisionSourceTrace: trace });
      sourceTraces.push(trace);
    }

    return {
      status: "ok",
      source: DANISTAY_SOURCE,
      query,
      searchResultsCount,
      selectedResult: items[0] ?? null,
      decisions,
      sourceTraces
    };
  }

  private async fetchFullText(url: string): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: `${BASE_URL}/`,
          "User-Agent": "physician-legal-mcp/0.14 danistay-emsal-check"
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
    const attempts = [0, 250, 750];

    for (const delay of attempts) {
      if (delay > 0) await this.wait(delay);

      try {
        const response = await this.fetchImpl(url, init);
        if (response.ok) return response;
        if ((response.status === 403 || response.status === 429) && delay !== attempts.at(-1)) continue;
        if (response.status >= 500 && delay !== attempts.at(-1)) continue;

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
        if (delay !== attempts.at(-1)) continue;
        return unavailable(
          "source_error",
          `Danıştay request failed: ${error instanceof Error ? error.message : String(error)}`,
          true,
          "Retry after checking network access."
        );
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

