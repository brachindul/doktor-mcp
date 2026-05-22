import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import type { PrecedentSourceAdapter } from "../types.js";
import {
  BEDESTEN_BASE_URL,
  BEDESTEN_PUBLIC_HEADERS,
  BEDESTEN_SOURCE,
  buildBedestenDocumentBody,
  buildBedestenSearchBody,
  normalizeBedestenDocumentResponse,
  normalizeBedestenSearchResponse,
  type BedestenCourtType
} from "./bedestenApi.js";

export interface LiveBedestenAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  courtTypes?: BedestenCourtType[];
  sourceName?: "bedesten" | "yargitay" | "danistay";
}

export class LiveBedestenAdapter implements PrecedentSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly courtTypes: BedestenCourtType[];
  private readonly sourceName: "bedesten" | "yargitay" | "danistay";

  constructor(options: LiveBedestenAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.courtTypes = options.courtTypes ?? ["YARGITAYKARARI", "DANISTAYKARAR", "YERELHUKUK", "ISTINAFHUKUK", "KYB"];
    this.sourceName = options.sourceName ?? "bedesten";
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    return this.searchAndNormalize(query);
  }

  async searchAndNormalize(query: string): Promise<CourtDecision[]> {
    const searchUrl = `${BEDESTEN_BASE_URL}/emsal-karar/searchDocuments`;
    const searchBody = buildBedestenSearchBody(query, this.courtTypes, 5);
    const emptyTrace = this.buildEmptyTrace(query, searchUrl);

    const response = await this.fetchWithRetry(searchUrl, {
      method: "POST",
      headers: BEDESTEN_PUBLIC_HEADERS,
      body: JSON.stringify(searchBody)
    });

    if (!response || !response.ok) {
      // In bedesten adapter, we just return empty on network failure for simplicity,
      // but to match traces, maybe we should return it in a specific structure?
      // Since `searchHealthPrecedents` only returns `CourtDecision[]`, failing gracefully is returning `[]`.
      return [];
    }

    let rawData: unknown;
    try {
      rawData = await response.json();
    } catch {
      return [];
    }

    const searchResults = normalizeBedestenSearchResponse(rawData);
    const retrievedAt = this.now().toISOString();

    const decisions: CourtDecision[] = [];

    for (const searchResult of searchResults) {
      let fullText: string | null = null;
      let fullTextRetrievalMethod: string | null = null;

      const docResponse = await this.fetchWithRetry(`${BEDESTEN_BASE_URL}/emsal-karar/getDocumentContent`, {
        method: "POST",
        headers: BEDESTEN_PUBLIC_HEADERS,
        body: JSON.stringify(buildBedestenDocumentBody(searchResult.documentId))
      });

      if (docResponse && docResponse.ok) {
        try {
          const docData = await docResponse.json();
          const doc = normalizeBedestenDocumentResponse(searchResult.documentId, docData);
          if (doc.contentBase64) {
            try {
              const html = Buffer.from(doc.contentBase64, "base64").toString("utf-8");
              fullText = this.stripHtml(html);
              fullTextRetrievalMethod = "bedesten-base64-html";
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

      decisions.push({ ...decision, decisionSourceTrace: trace });
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

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response | null> {
    const attempts = [0, 250, 750];
    for (const delay of attempts) {
      if (delay > 0) await this.wait(delay);
      try {
        const response = await this.fetchImpl(url, init);
        if (response.ok) return response;
        if (response.status >= 500 && delay !== attempts.at(-1)) continue;
        return null; // For simplicity in bedesten, we don't bubble complex UI errors yet.
      } catch {
        if (delay !== attempts.at(-1)) continue;
        return null;
      }
    }
    return null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
