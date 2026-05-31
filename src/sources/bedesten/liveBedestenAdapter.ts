import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import { deriveContentStatus, isQuoteUsable, buildDecisionKey } from "../../live/decisionProvenance.js";
import type { PrecedentSourceAdapter } from "../types.js";
import {
  BEDESTEN_BASE_URL,
  BEDESTEN_PUBLIC_HEADERS,
  buildBedestenDocumentBody,
  buildBedestenSearchBody,
  normalizeBedestenDocumentResponse,
  normalizeBedestenSearchResponse,
  type BedestenCourtType
} from "./bedestenApi.js";
import { HttpClient, BedestenRateLimitError } from "../../core/httpClient.js";
import { policyForSource } from "../../live/requestPolicy.js";
import { PrecedentCache } from "../precedentCache.js";

export interface LiveBedestenAdapterOptions {
  httpClient?: HttpClient;
  /** Separate HttpClient for full-text document fetches (bedesten-fulltext 20s policy). */
  httpClientFullText?: HttpClient;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  courtTypes?: BedestenCourtType[];
  sourceName?: "bedesten" | "yargitay" | "danistay";
}

export class LiveBedestenAdapter implements PrecedentSourceAdapter {
  private readonly httpClient: HttpClient;
  /** Separate client for getDocumentContent (bedesten-fulltext: 20s timeout). */
  private readonly httpClientFullText: HttpClient;
  private readonly now: () => Date;
  private readonly courtTypes: BedestenCourtType[];
  private readonly sourceName: "bedesten" | "yargitay" | "danistay";
  private readonly cache: PrecedentCache;

  constructor(options: LiveBedestenAdapterOptions = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const sleep = options.wait;
    this.httpClient = options.httpClient ?? new HttpClient({
      baseUrl: BEDESTEN_BASE_URL,
      fetchImpl,
      sleep,
      timeoutMs: policyForSource("bedesten-search").timeoutMs
    });
    this.httpClientFullText = options.httpClientFullText ?? new HttpClient({
      baseUrl: BEDESTEN_BASE_URL,
      fetchImpl,
      sleep,
      timeoutMs: policyForSource("bedesten-fulltext").timeoutMs
    });
    this.now = options.now ?? (() => new Date());
    this.courtTypes = options.courtTypes ?? ["YARGITAYKARARI", "DANISTAYKARAR", "YERELHUKUK", "ISTINAFHUKUK", "KYB"];
    this.sourceName = options.sourceName ?? "bedesten";
    this.cache = new PrecedentCache();
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    return this.searchAndNormalize(query);
  }

  async searchAndNormalize(query: string): Promise<CourtDecision[]> {
    const searchUrl = `${BEDESTEN_BASE_URL}/emsal-karar/searchDocuments`;
    const searchBody = buildBedestenSearchBody(query, this.courtTypes, 5);
    const emptyTrace = this.buildEmptyTrace(query, searchUrl);

    let rawData: unknown;
    try {
      rawData = await this.httpClient.postJson<unknown>("/emsal-karar/searchDocuments", searchBody, {
        headers: BEDESTEN_PUBLIC_HEADERS
      });
    } catch (error) {
      if (error instanceof BedestenRateLimitError) {
        return [{
          id: `${this.sourceName}:error`,
          court: this.sourceName,
          topicTags: [],
          evidence: {
            source: this.sourceName,
            documentId: `${this.sourceName}:error`,
            sourceUrl: searchUrl,
            retrievedAt: this.now().toISOString(),
            official: true,
            fullText: false
          },
          decisionSourceTrace: {
            ...emptyTrace,
            error: error.message
          }
        }];
      }
      return [];
    }

    const searchResults = normalizeBedestenSearchResponse(rawData);
    const retrievedAt = this.now().toISOString();

    const decisions: CourtDecision[] = [];

    for (const searchResult of searchResults) {
      let fullText: string | null = null;
      let fullTextRetrievalMethod: string | null = null;

      // Check full-text cache first
      const docId = `${this.sourceName}:${searchResult.documentId}`;
      const cached = await this.cache.getFullText(docId);
      if (cached) {
        fullText = cached.text;
        fullTextRetrievalMethod = "bedesten-base64-html-cache";
      } else {
        try {
          const docData = await this.httpClientFullText.postJson<unknown>("/emsal-karar/getDocumentContent", buildBedestenDocumentBody(searchResult.documentId), {
            headers: BEDESTEN_PUBLIC_HEADERS
          });
          const doc = normalizeBedestenDocumentResponse(searchResult.documentId, docData);
          if (doc.contentBase64) {
            try {
              const html = Buffer.from(doc.contentBase64, "base64").toString("utf-8");
              fullText = this.stripHtml(html);
              fullTextRetrievalMethod = "bedesten-base64-html";
              if (fullText) {
                await this.cache.setFullText(docId, fullText);
              }
            } catch {
              // fallback
            }
          }
        } catch {
          // ignore doc errors
        }
      }

      const decision: CourtDecision = {
        id: `${this.sourceName}:${searchResult.documentId}`,
        court: this.sourceName,
        chamber: searchResult.chamber || undefined,
        decisionDate: searchResult.decisionDate || undefined,
        meritsNumber: searchResult.esasNo || undefined,
        decisionNumber: searchResult.kararNo || undefined,
        factSummary: searchResult.title || undefined,
        legalReasoning: undefined,
        outcome: undefined,
        relevanceNote: undefined,
        topicTags: [],
        fullText: fullText || undefined,
        evidence: {
          source: this.sourceName,
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
        searchResultsCount: searchResults.length,
        selectedResult: { documentId: searchResult.documentId },
        selectedResultReason: `Bedesten matched query '${query}'.`,
        documentId: searchResult.documentId,
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
        source: this.sourceName,
        fetchStatus,
        contentStatus,
        quoteUsable,
        fetchedAt: retrievedAt
      }];

      decisions.push(decisionWithTrace);
    }

    return decisions;
  }

  private buildEmptyTrace(query: string, url: string): DecisionSourceTrace {
    return {
      query,
      source: this.sourceName,
      court: this.sourceName,
      searchRequest: { url, phrase: query, pageSize: 5 },
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
