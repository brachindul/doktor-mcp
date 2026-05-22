import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import { pickHealthLawQuery } from "../../health/healthLawQueryExpansion.js";
import type { PrecedentSourceAdapter } from "../types.js";
import type { LiveYargitayResult, LiveYargitaySearchResult, LiveYargitayUnavailable } from "./liveTypes.js";
import { YARGITAY_SOURCE } from "./liveTypes.js";
import {
  normalizeYargitaySearchResults,
  extractYargitayFullText,
  buildYargitayDecision,
  buildYargitayEmptyTrace,
  classifyNonJsonResponse
} from "./yargitayNormalizer.js";

const BASE_URL = "https://emsal.yargitay.gov.tr";
const SEARCH_URL = `${BASE_URL}/BilgiBankasiIslem`;
const MAX_RESULTS_PER_QUERY = 5;

export interface LiveYargitayAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
}

export class LiveYargitayAdapter implements PrecedentSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(options: LiveYargitayAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const query = pickHealthLawQuery(classification);
    const result = await this.searchAndNormalize(query);
    return result.status === "ok" ? result.decisions : [];
  }

  async searchAndNormalize(query: string): Promise<LiveYargitayResult> {
    const searchRequest = { url: SEARCH_URL, phrase: query, pageSize: MAX_RESULTS_PER_QUERY };
    const emptyTrace = buildYargitayEmptyTrace(query, searchRequest);

    const response = await this.fetchWithRetry(SEARCH_URL, {
      method: "POST",
      headers: yargitayHeaders("application/json; charset=utf-8"),
      body: JSON.stringify(buildSearchBody(query))
    });

    if (isUnavailable(response)) {
      const err = response as LiveYargitayUnavailable;
      return { ...err, sourceTrace: [{ ...emptyTrace, error: err.message }] };
    }

    let rawData: unknown;
    try {
      const rawText = await (response as Response).text();
      try {
        rawData = JSON.parse(rawText);
      } catch {
        const kind = classifyNonJsonResponse(rawText);
        const nextStep = kind === "html_shell_response" || kind === "needs_browser_capture"
          ? "Use browser DevTools Network tab to capture the actual search XHR endpoint."
          : kind === "captcha_or_block"
            ? "Endpoint returned a CAPTCHA/block page. Retry from a different network."
            : "Check the search endpoint format and retry.";
        return unavailable(
          "parse_failed",
          `Yargıtay emsal search response is not parseable JSON (${kind}).`,
          kind !== "captcha_or_block",
          nextStep,
          [{ ...emptyTrace, error: `non_json_response:${kind}` }]
        );
      }
    } catch {
      return unavailable(
        "parse_failed",
        "Yargıtay emsal search response could not be read.",
        true,
        "Check the search endpoint format and retry.",
        [{ ...emptyTrace, error: "response_read_failed" }]
      );
    }

    const searchResults = normalizeYargitaySearchResults(rawData);
    const searchResultsCount = searchResults.length;
    const retrievedAt = this.now().toISOString();

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
            exclusionReasons: ["Arama sonucu bulunamadı."]
          }
        ]
      };
    }

    const decisions: CourtDecision[] = [];
    const sourceTraces: DecisionSourceTrace[] = [];

    for (const searchResult of searchResults.slice(0, MAX_RESULTS_PER_QUERY)) {
      let fullText: string | null = null;
      let fullTextRetrievalMethod: string | null = null;

      if (searchResult.documentUrl) {
        const text = await this.fetchFullText(searchResult.documentUrl);
        if (text !== null) {
          fullText = text;
          fullTextRetrievalMethod = "html-text";
        }
      }

      const decision = buildYargitayDecision(searchResult, fullText, query, retrievedAt);
      const { status, eligibilityReasons, exclusionReasons } = assessDecisionEligibility(decision);

      const trace: DecisionSourceTrace = {
        ...emptyTrace,
        searchResultsCount,
        selectedResult: { documentId: searchResult.documentId },
        selectedResultReason: `Health law term '${query}' matched Yargıtay emsal search.`,
        documentId: searchResult.documentId,
        sourceId: searchResult.sourceId,
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
      source: YARGITAY_SOURCE,
      query,
      searchResultsCount,
      selectedResult: searchResults[0] ?? null,
      decisions,
      sourceTraces
    };
  }

  private async fetchFullText(url: string): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(url, { headers: yargitayHeaders() });
      if (isUnavailable(response)) return null;
      const resp = response as Response;
      const contentType = resp.headers.get("content-type") ?? "";
      const body = await resp.text();
      if (contentType.includes("html") || body.trimStart().startsWith("<")) {
        return extractYargitayFullText(body) || null;
      }
      return body.trim() || null;
    } catch {
      return null;
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response | LiveYargitayUnavailable> {
    const attempts = [0, 250, 750];

    for (const delay of attempts) {
      if (delay > 0) await this.wait(delay);

      try {
        const response = await this.fetchImpl(url, init);
        if (response.ok) return response;
        if ((response.status === 403 || response.status === 429) && delay !== attempts.at(-1)) continue;
        if (response.status >= 500 && delay !== attempts.at(-1)) continue;

        if (response.status === 403 || response.status === 429) {
          return unavailable("source_blocked", `Yargıtay source returned HTTP ${response.status}.`, true, "Retry after the source cools down.");
        }
        return unavailable(
          response.status >= 500 ? "source_error" : "document_not_found",
          `Yargıtay source returned HTTP ${response.status}.`,
          response.status >= 500,
          "Retry the request or verify the endpoint."
        );
      } catch (error) {
        if (delay !== attempts.at(-1)) continue;
        return unavailable(
          "source_error",
          `Yargıtay request failed: ${error instanceof Error ? error.message : String(error)}`,
          true,
          "Retry after checking network access to emsal.yargitay.gov.tr."
        );
      }
    }

    return unavailable("source_error", "Yargıtay request ended unexpectedly.", true, "Retry the request.");
  }
}

function buildSearchBody(query: string) {
  return {
    data: {
      arananKelime: query,
      birimYrgKurulDaire: 0,
      birimYrgHGK: 0,
      birimYrgBGK: 0,
      basTarih: "",
      bitTarih: "",
      esasYil: "",
      esasSira: "",
      kararYil: "",
      kararSira: "",
      ilkDerece: 0,
      kayitSayisi: MAX_RESULTS_PER_QUERY,
      baslangicKayit: 0
    }
  };
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

function isUnavailable(value: unknown): value is LiveYargitayUnavailable {
  return typeof value === "object" && value !== null && "status" in value && (value as { status: unknown }).status === "unavailable";
}

function yargitayHeaders(contentType?: string): Record<string, string> {
  return {
    Accept: "application/json, text/html;q=0.9",
    ...(contentType ? { "Content-Type": contentType } : {}),
    Referer: `${BASE_URL}/`,
    "User-Agent": "physician-legal-mcp/0.9 yargitay-emsal-check"
  };
}

