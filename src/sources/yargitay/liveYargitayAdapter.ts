import type { ClassifiedMedicalLegalQuestion, CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import { assessDecisionEligibility } from "../../health/decisionEligibility.js";
import type { PrecedentSourceAdapter } from "../types.js";
import type { LiveYargitayResult, LiveYargitaySearchResult, LiveYargitayUnavailable } from "./liveTypes.js";
import { YARGITAY_SOURCE } from "./liveTypes.js";

const BASE_URL = "https://emsal.yargitay.gov.tr";
const SEARCH_URL = `${BASE_URL}/BilgiBankasiIslem`;
const MAX_RESULTS_PER_QUERY = 5;

const HEALTH_LAW_TERMS: Record<string, string> = {
  riza: "aydınlatılmış rıza",
  "rıza": "aydınlatılmış rıza",
  onam: "aydınlatılmış onam",
  aydinlat: "aydınlatılmış rıza",
  "aydınlat": "aydınlatılmış rıza",
  komplikasyon: "komplikasyon tıbbi müdahale",
  malpraktis: "malpraktis hekim",
  "tibbi": "tıbbi müdahale",
  "tıbbi": "tıbbi müdahale",
  mudahale: "tıbbi müdahale",
  "müdahale": "tıbbi müdahale",
  hekim: "hekimin özen yükümlülüğü",
  veri: "sağlık verisi mahremiyet",
  mahrem: "sağlık verisi mahremiyet"
};

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
    const query = pickHealthLawTerm(classification) ?? classification.question;
    const result = await this.searchAndNormalize(query);
    return result.status === "ok" ? result.decisions : [];
  }

  async searchAndNormalize(query: string): Promise<LiveYargitayResult> {
    const searchRequest = { url: SEARCH_URL, phrase: query, pageSize: MAX_RESULTS_PER_QUERY };
    const emptyTrace = buildEmptyTrace(query, searchRequest);

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
      rawData = await (response as Response).json();
    } catch {
      return unavailable(
        "parse_failed",
        "Yargıtay emsal search response is not parseable JSON.",
        true,
        "Check the search endpoint format and retry.",
        [{ ...emptyTrace, error: "JSON parse failed" }]
      );
    }

    const searchResults = normalizeSearchResults(rawData);
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

      const decision = buildDecision(searchResult, fullText, query, retrievedAt);
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
        return extractTextFromHtml(body) || null;
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

function normalizeSearchResults(raw: unknown): LiveYargitaySearchResult[] {
  if (!raw || typeof raw !== "object") return [];

  const asObj = raw as Record<string, unknown>;
  const candidates = [asObj.data, asObj.results, asObj.kararlar, asObj.items, raw];
  const arr = candidates.find(Array.isArray) as unknown[] | undefined;
  if (!arr) return [];

  return arr.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;

    const id = str(row.ID ?? row.id ?? row.kararId ?? row.KARAR_ID);
    if (!id) return [];

    const chamber = str(row.BIRIMI ?? row.birimi ?? row.daire ?? row.birim ?? row.BIRIM);
    const esasYil = str(row.ESAS_YILI ?? row.esasYili ?? "");
    const esasSira = str(row.ESAS_SIRASI ?? row.esasSirasi ?? "");
    const kararYil = str(row.KARAR_YILI ?? row.kararYili ?? "");
    const kararSira = str(row.KARAR_SIRASI ?? row.kararSirasi ?? "");

    return [{
      documentId: `yargitay:${id}`,
      sourceId: id,
      title: str(row.OZET ?? row.ozet ?? row.title ?? row.baslik ?? ""),
      date: normalizeDate(str(row.KARAR_TARIHI ?? row.kararTarihi ?? row.tarih ?? "")),
      chamber: chamber || undefined,
      meritsNumber: esasYil && esasSira ? `${esasYil}/${esasSira}` : undefined,
      decisionNumber: kararYil && kararSira ? `${kararYil}/${kararSira}` : undefined,
      sourceUrl: `${BASE_URL}/DetailMain.aspx?id=${id}`,
      documentUrl: `${BASE_URL}/DownloadYargitayDoc?id=${id}`,
      summaryText: str(row.OZET ?? row.ozet ?? "")
    }];
  });
}

function buildDecision(
  result: LiveYargitaySearchResult,
  fullText: string | null,
  query: string,
  retrievedAt: string
): CourtDecision {
  const legalReasoning = fullText ? extractLegalReasoning(fullText) : undefined;
  const outcome = fullText ? extractOutcome(fullText) : undefined;
  const relevanceNote = fullText && legalReasoning
    ? `'${query}' sağlık hukuku aramasıyla eşleşti; tam metin ve gerekçe mevcut.`
    : undefined;

  return {
    id: result.documentId,
    court: "yargitay",
    chamber: result.chamber,
    decisionDate: result.date,
    meritsNumber: result.meritsNumber,
    decisionNumber: result.decisionNumber,
    factSummary: result.summaryText,
    legalReasoning,
    outcome,
    relevanceNote,
    topicTags: [],
    fullText: fullText ?? undefined,
    evidence: {
      source: "yargitay",
      documentId: result.documentId,
      sourceId: result.sourceId,
      sourceUrl: result.sourceUrl,
      retrievedAt,
      official: true,
      fullText: fullText !== null
    }
  };
}

function buildEmptyTrace(
  query: string,
  searchRequest: DecisionSourceTrace["searchRequest"]
): DecisionSourceTrace {
  return {
    query,
    source: "yargitay",
    court: "yargitay",
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

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  return text.replace(/\s+/g, " ").trim();
}

function extractLegalReasoning(fullText: string): string | undefined {
  const markers = ["gerekçe", "değerlendirme", "hukuki değerlendirme", "inceleme", "gerekce", "degerlendirme"];
  const lower = fullText.toLocaleLowerCase("tr-TR");

  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      return fullText.slice(idx, idx + 3000).trim();
    }
  }

  return fullText.length > 200 ? fullText.slice(0, 3000).trim() : undefined;
}

function extractOutcome(fullText: string): string | undefined {
  const markers = ["sonuç", "hüküm", "karar", "sonuc", "huküm"];
  const lower = fullText.toLocaleLowerCase("tr-TR");

  for (const marker of markers) {
    const idx = lower.lastIndexOf(marker);
    if (idx !== -1 && idx > fullText.length / 2) {
      return fullText.slice(idx, idx + 500).trim();
    }
  }
  return undefined;
}

function pickHealthLawTerm(classification: ClassifiedMedicalLegalQuestion): string | undefined {
  for (const term of classification.searchTerms) {
    const mapped = HEALTH_LAW_TERMS[term];
    if (mapped) return mapped;
  }
  return undefined;
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

function normalizeDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw.slice(0, 10) || undefined;
}

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}
