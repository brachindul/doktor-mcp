import { PDFParse } from "pdf-parse";
import type {
  ClassifiedMedicalLegalQuestion,
  LegislationProvision,
  LegislationSourceTrace
} from "../../contracts/legal.js";
import type { LegislationSourceAdapter } from "../types.js";
import { classifyLiveError, policyForSource, withTimeout } from "../../live/requestPolicy.js";
import { extractArticlesFromOfficialText } from "./articleParser.js";
import { healthLegislationHints } from "./healthMappings.js";
import { PROVISION_RANKING_METHOD, rankExtractedArticles } from "./provisionRanker.js";
import { buildLegislationSelectionDiagnostics } from "./selectionDiagnostics.js";
import { LegislationDocCache } from "../legislationDocCache.js";
import type {
  HealthLegislationHint,
  LiveLegislationDocument,
  LiveLegislationResult,
  LiveLegislationUnavailable,
  OfficialLegislationSearchResult
} from "./liveTypes.js";

const OFFICIAL_SOURCE = "mevzuat.gov.tr" as const;
const BASE_URL = "https://www.mevzuat.gov.tr";

export interface LiveOfficialLegislationAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  wait?: (milliseconds: number) => Promise<void>;
  /** T35.2: Document cache for large PDF resilience (e.g., 657 DMK) */
  docCache?: LegislationDocCache;
}

export class LiveOfficialLegislationAdapter implements LegislationSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly docCache: LegislationDocCache | null;

  constructor(options: LiveOfficialLegislationAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.docCache = options.docCache ?? null;
  }

  async searchHealthLegislation(classification: ClassifiedMedicalLegalQuestion): Promise<LegislationProvision[]> {
    const result = await this.getMappedHealthProvisions(classification.question);
    return result.status === "ok" ? result.provisions : [];
  }

  async getLegislationProvisions(documentIds: string[]): Promise<LegislationProvision[]> {
    const query = healthLegislationHints
      .filter((hint) => documentIds.includes(hint.sourceId))
      .map((hint) => hint.terms[0])
      .join(" ");
    const result = await this.getMappedHealthProvisions(query);
    return result.status === "ok" ? result.provisions : [];
  }

  async getMappedHealthProvisions(query: string): Promise<LiveLegislationResult> {
    const hints = matchingHints(query);
    if (hints.length === 0) {
      return unavailable(
        "document_not_found",
        `No MVP health legislation mapping matched "${query}".`,
        false,
        "Refine the health-law query or add a verified official legislation hint.",
        [emptyTrace(query, null, {
          attemptedHealthMappings: healthLegislationHints.map((hint) => hint.sourceId),
          error: "No health mapping matched the query."
        })]
      );
    }

    const searchResults: OfficialLegislationSearchResult[] = [];
    const sourceTrace: LegislationSourceTrace[] = [];

    // T25.1: Parallel hint resolution — resolve all hints to selectedSearchResult first
    const hintResolution = await Promise.all(hints.map(async (hint) => {
      const trace = emptyTrace(query, hint, { officialSearchRequest: officialSearchRequest(hint.query) });
      let officialResults: OfficialLegislationSearchResult[] = [];
      let usedDirectFastPath = false;
      if (hintHasDirectSourceId(hint)) {
        usedDirectFastPath = true;
      } else {
        const officialSearch = await this.searchOfficialLegislation(hint.query);
        if (isUnavailable(officialSearch)) {
          return { status: "unavailable" as const, result: officialSearch, trace };
        }
        officialResults = officialSearch;
      }
      trace.officialSearchResultsCount = officialResults.length;
      trace.officialSearchResults = officialResults.map(traceSearchResult);
      const mappedResult = mapHintToSearchResult(hint);
      const matchedInSearch = officialResults.some((result) => result.sourceId === hint.sourceId);
      const selectedSearchResult = officialResults.find((result) => result.sourceId === hint.sourceId) ?? mappedResult;
      trace.selectedSearchResult = traceSearchResult(selectedSearchResult);
      trace.selectedResultReason = usedDirectFastPath
        ? `${hint.selectionReason} Topic cluster: ${hint.topicCluster}. Role: ${hint.legislationRole}. Verified mapping sourceId resolved via direct-fetch fast path (search API bypassed).`
        : matchedInSearch
          ? `${hint.selectionReason} Topic cluster: ${hint.topicCluster}. Role: ${hint.legislationRole}. Official search matched the verified mapping sourceId.`
          : `${hint.selectionReason} Topic cluster: ${hint.topicCluster}. Role: ${hint.legislationRole}. Verified mapping path selected because official search returned no exact sourceId match.`;
      return { status: "ok" as const, hint, selectedSearchResult, trace };
    }));

    // Graceful per-hint degradation: a single hint failing (search error, document fetch
    // failure, or no rankable article) must NOT discard provisions already gathered from the
    // other hints matched by the same query. Failures are collected; we only surface an
    // unavailable result if NO hint produced any provision.
    const failures: Array<{ result: LiveLegislationUnavailable; trace: LegislationSourceTrace }> = [];

    for (const res of hintResolution) {
      if (res.status === "unavailable") {
        failures.push({ result: res.result, trace: completeTrace(res.trace, { error: res.result.message }) });
        continue;
      }
      searchResults.push(res.selectedSearchResult);
      sourceTrace.push(res.trace);
    }

    // T25.1: Parallel document fetching — fetch all documents simultaneously
    const documentResults = await Promise.all(
      hintResolution.filter((r) => r.status === "ok").map(async (res) => {
        const document = await this.getDocument(res.selectedSearchResult);
        if (isUnavailable(document)) {
          return { status: "unavailable" as const, result: document, trace: res.trace, hint: res.hint, selectedSearchResult: res.selectedSearchResult };
        }
        return { status: "ok" as const, document, trace: res.trace, hint: res.hint, selectedSearchResult: res.selectedSearchResult };
      })
    );

    const documents: LiveLegislationDocument[] = [];
    const provisions: LegislationProvision[] = [];

    for (const docRes of documentResults) {
      if (docRes.status === "unavailable") {
        failures.push({ result: docRes.result, trace: completeTrace(docRes.trace, {
          landingUrl: docRes.selectedSearchResult.sourceUrl,
          detailUrl: docRes.selectedSearchResult.sourceUrl,
          fullTextUrl: docRes.selectedSearchResult.documentUrl,
          error: docRes.result.message
        }) });
        continue;
      }
      const { document, trace, hint, selectedSearchResult } = docRes;
      documents.push(document);

      const extracted = extractArticlesFromOfficialText(document.text);
      const ranking = rankExtractedArticles(query, hint, extracted);
      const selected = ranking.selected;
      Object.assign(trace, traceDocument(document, selected.map(({ article }) => article.articleNumber), {
        candidateArticleNumbers: extracted.map((article) => article.articleNumber),
        rankedArticleNumbers: ranking.ranked.map(({ article }) => article.articleNumber),
        rejectedArticleNumbers: ranking.rejected.map(({ article }) => article.articleNumber),
        rankingMethod: PROVISION_RANKING_METHOD
      }));
      if (selected.length === 0) {
        failures.push({
          result: unavailable(
            "provision_not_found",
            `Official text was retrieved for ${hint.title}, but no extracted article passed deterministic ranking.`,
            false,
            "Inspect the official article extraction and ranking signals before using this provision in an answer."
          ),
          trace: completeTrace(trace, { error: "No extracted article passed provision ranking." })
        });
        continue;
      }

      provisions.push(...selected.map(({ article, ranking: articleRanking }) => provisionFromArticle(
        hint,
        article.text,
        article.articleNumber,
        document,
        trace,
        articleRanking,
        selectedSearchResult.rawMetadata,
        article.articleStatus,
        article.crossReferences
      )));
    }

    // No hint produced any provision — surface the failure (prefer the last structured one)
    // with the full trace trail so the audit shows every attempted source.
    if (provisions.length === 0) {
      const allTraces = [...sourceTrace, ...failures.map((f) => f.trace)];
      const lastFailure = failures[failures.length - 1];
      if (lastFailure) {
        return withTrace(lastFailure.result, allTraces);
      }
      return unavailable(
        "provision_not_found",
        `No official provision could be resolved for "${query}".`,
        false,
        "Refine the health-law query or verify the mapped legislation sources.",
        allTraces
      );
    }

    const sortedProvisions = sortProvisionsByHealthPriority(provisions);
    return {
      status: "ok",
      source: OFFICIAL_SOURCE,
      query,
      searchResults,
      documents,
      provisions: sortedProvisions,
      sourceTrace: sourceTrace.sort(tracePriority),
      selectionDiagnostics: buildLegislationSelectionDiagnostics({
        query,
        sourceMode: "live",
        provisions: sortedProvisions
      })
    };
  }

  /**
   * Fetch an official document directly by its mevzuat.gov.tr sourceId.
   * Bypasses the search API — used for type-7 (yonetmelik) direct verification.
   * Returns the document text and title extracted from the PDF content.
   */
  async fetchOfficialDocument(
    sourceId: string
  ): Promise<{ title: string; text: string; retrievedAt: string } | LiveLegislationUnavailable> {
    const parts = sourceId.replace("mevzuat:", "").split(".");
    if (parts.length !== 3) {
      return unavailable(
        "document_not_found",
        `Invalid sourceId format: ${sourceId}. Expected mevzuat:<type>.<arrangement>.<number>`,
        false,
        "Use a valid mevzuat.gov.tr sourceId."
      );
    }
    const [type, arrangement, number] = parts;
    const searchResult: OfficialLegislationSearchResult = {
      sourceId,
      title: "",
      sourceUrl: `${BASE_URL}/mevzuat?MevzuatNo=${number}&MevzuatTur=${type}&MevzuatTertip=${arrangement}`,
      documentUrl: officialDocumentUrlForParts(type, arrangement, number),
      legislationNumber: number,
      legislationType: type,
      legislationArrangement: arrangement
    };
    const doc = await this.getDocument(searchResult);
    if (isUnavailable(doc)) return doc;
    // Extract a meaningful title from the PDF text (first meaningful line)
    const extractedTitle = extractDocumentTitle(doc.text);
    return { title: extractedTitle || doc.title || "", text: doc.text, retrievedAt: doc.retrievedAt };
  }

  async searchOfficialLegislation(query: string): Promise<OfficialLegislationSearchResult[] | LiveLegislationUnavailable> {
    const response = await this.fetchWithAdaptiveBackoff(`${BASE_URL}/anasayfa/MevzuatDatatable`, {
      method: "POST",
      headers: officialHeaders("application/json; charset=utf-8"),
      body: JSON.stringify({
        draw: 1,
        start: 0,
        length: 10,
        parameters: {
          AranacakIfade: Buffer.from(query, "utf8").toString("base64"),
          AranacakYer: "Tumu",
          TamCumle: false,
          MevzuatTur: 0,
          GenelArama: true
        }
      })
    }, "mevzuat-search");
    if (isUnavailable(response)) return response;

    try {
      const raw = (await response.json()) as { data?: Array<Record<string, unknown>> };
      return (raw.data ?? []).flatMap((row) => {
        const number = stringField(row.mevzuatNo);
        const type = stringField(row.mevzuatTur);
        const arrangement = stringField(row.mevzuatTertip);
        const title = cleanSearchTitle(stringField(row.mevAdi));
        if (!number || !type || !arrangement || !title) return [];

        return [{
          sourceId: `mevzuat:${type}.${arrangement}.${number}`,
          title,
          sourceUrl: new URL(stringField(row.url) || `/mevzuat?MevzuatNo=${number}&MevzuatTur=${type}&MevzuatTertip=${arrangement}`, BASE_URL).toString(),
          documentUrl: officialDocumentUrlForParts(type, arrangement, number),
          legislationNumber: number,
          legislationType: type,
          legislationArrangement: arrangement,
          rawMetadata: row
        }];
      });
    } catch {
      return unavailable(
        "search_failed",
        "Official legislation search did not return parseable JSON.",
        true,
        "Retry the live search or use a verified MVP health legislation hint."
      );
    }
  }

  async getDocument(result: OfficialLegislationSearchResult): Promise<LiveLegislationDocument | LiveLegislationUnavailable> {
    // T35.2: Check document cache first — avoid refetch on flaky PDF
    if (this.docCache) {
      const cachedText = await this.docCache.get(result.sourceId);
      if (cachedText) {
        return {
          sourceId: result.sourceId,
          title: result.title,
          sourceUrl: result.sourceUrl,
          documentUrl: result.documentUrl,
          text: cachedText,
          contentType: "text/plain; cached",
          retrievedAt: this.now().toISOString()
        };
      }
    }

    // Attempt 1: Direct PDF download
    let response = await this.fetchWithAdaptiveBackoff(result.documentUrl, {
      headers: officialHeaders()
    }, "mevzuat-pdf");

    // Fallback: if direct PDF fails, try landing page first
    if (isUnavailable(response)) {
      const landingResponse = await this.fetchWithAdaptiveBackoff(result.sourceUrl, {
        headers: officialHeaders()
      }, "mevzuat-landing");

      if (!isUnavailable(landingResponse) && landingResponse.ok) {
        const contentType = landingResponse.headers.get("content-type") ?? "";
        // Only parse HTML landing pages — skip if we got PDF or other binary
        if (contentType.toLocaleLowerCase("en-US").includes("text/html")) {
          const html = await landingResponse.text();
          const extractedUrl = extractPdfUrlFromLandingPage(html);
          if (extractedUrl) {
            // Retry with the extracted URL and full browser headers
            response = await this.fetchWithAdaptiveBackoff(extractedUrl, {
              headers: officialHeaders()
            }, "mevzuat-pdf-fallback");
          }
        }
      }
    }

    // Still failed — check if it's a Cloudflare block
    if (isUnavailable(response)) {
      if (response.errorCode === "source_blocked" || response.errorCode === "source_error") {
        return unavailable(
          "source_blocked_cloudflare",
          `Mevzuat.gov.tr PDF erişimi Cloudflare bot koruması tarafından engellendi: ${result.documentUrl}. Landing page fallback de başarısız oldu.`,
          true,
          "Manuel olarak mevzuat.gov.tr adresini ziyaret edip Cloudflare challenge'ı geçtikten sonra tekrar deneyin veya recorded fixture kullanın."
        );
      }
      return response; // return original error
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.toLocaleLowerCase("en-US").includes("pdf")) {
      return unavailable(
        "unsupported_content_type",
        `Official document ${result.documentUrl} returned ${contentType} instead of PDF.`,
        true,
        "Retry later or add an extractor for the official document format returned by the source."
      );
    }

    try {
      const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) });
      const text = (await parser.getText()).text;
      await parser.destroy();

      // T35.2: Cache successful document fetch for future resilience
      if (this.docCache && text) {
        await this.docCache.set(result.sourceId, text);
      }

      return {
        sourceId: result.sourceId,
        title: result.title,
        sourceUrl: result.sourceUrl,
        documentUrl: result.documentUrl,
        text,
        contentType,
        retrievedAt: this.now().toISOString()
      };
    } catch (error) {
      return unavailable(
        "parse_failed",
        `Official PDF text extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        false,
        "Inspect the official document format and parser before composing legislation quotes."
      );
    }
  }

  private async fetchWithAdaptiveBackoff(url: string, init: RequestInit, sourceName: string): Promise<Response | LiveLegislationUnavailable> {
    const policy = policyForSource(sourceName);
    const delays = [0, 250, 750];

    for (const delay of delays) {
      if (delay > 0) await this.wait(delay);

      try {
        const response = await withTimeout(this.fetchImpl, url, init, policy.timeoutMs);
        if (response.ok) return response;
        if ((response.status === 403 || response.status === 429) && delay !== delays.at(-1)) continue;
        if (response.status >= 500 && delay !== delays.at(-1)) continue;

        if (response.status === 403 || response.status === 429) {
          return unavailable(
            "source_blocked",
            `Official source returned HTTP ${response.status}.`,
            true,
            "Retry after the source cools down; keep request volume normal until a real block is observed."
          );
        }

        return unavailable(
          response.status >= 500 ? "source_error" : "document_not_found",
          `Official source returned HTTP ${response.status}.`,
          response.status >= 500,
          "Retry the official source or verify the mapped document identifier."
        );
      } catch (error) {
        const kind = classifyLiveError(error);
        if (delay !== delays.at(-1)) continue;
        const message = kind === "timeout"
          ? `Official source request timed out after ${policy.timeoutMs}ms (source: ${sourceName}).`
          : `Official source request failed: ${error instanceof Error ? error.message : String(error)}`;
        return unavailable(
          "source_error",
          message,
          true,
          "Retry the official source after checking network access."
        );
      }
    }

    return unavailable("source_error", "Official source request ended unexpectedly.", true, "Retry the request.");
  }
}

/**
 * Attempt to extract force-status metadata from the raw mevzuat.gov.tr search response row.
 * When metadata fields are absent or unrecognizable, returns inForce: "unknown" — never defaults to true.
 */
function extractForceMetadata(rawRow?: Record<string, unknown>): { inForce?: boolean | "unknown"; lastAmendedDate?: string; repealed?: boolean } {
  if (!rawRow) {
    return { inForce: "unknown" };
  }

  const result: { inForce?: boolean | "unknown"; lastAmendedDate?: string; repealed?: boolean } = {};

  // Try to determine from known Turkish legal metadata fields
  const status = stringField(rawRow.yururluk ?? rawRow.durum ?? rawRow.status ?? rawRow.mevzuatDurum);
  if (status === "Yürürlükte" || status === "InForce" || status === "active" || status === "YURURLUKTE") {
    result.inForce = true;
  } else if (status === "Mülga" || status === "Repealed" || status === "Yürürlükten Kalktı" || status === "MULGA") {
    result.inForce = false;
    result.repealed = true;
  } else {
    result.inForce = "unknown";
  }

  // Try to get amendment date
  const amendDate = stringField(rawRow.lastAmendedDate ?? rawRow.sonDegisiklikTarihi ?? rawRow.mevzuatTarih);
  if (amendDate) {
    result.lastAmendedDate = amendDate;
  }

  return result;
}

function provisionFromArticle(
  hint: HealthLegislationHint,
  text: string,
  articleNumber: string,
  document: LiveLegislationDocument,
  sourceTrace: LegislationSourceTrace,
  ranking: LegislationProvision["ranking"],
  rawMetadata?: Record<string, unknown>,
  articleStatus?: LegislationProvision["articleStatus"],
  crossReferences?: string[]
): LegislationProvision {
  const forceMetadata = extractForceMetadata(rawMetadata);
  return {
    documentId: document.sourceId,
    legislationName: document.title,
    articleNumber,
    verbatimText: text,
    connection: `Official MVP mapping for ${hint.query}; quote extracted from article ${articleNumber} source text.`,
    dimensions: hint.dimensions,
    sourceTrace,
    ...(ranking ? { ranking } : {}),
    ...forceMetadata,
    ...(articleStatus ? { articleStatus } : {}),
    ...(crossReferences && crossReferences.length > 0 ? { crossReferences } : {}),
    evidence: {
      source: "legislation",
      documentId: document.sourceId,
      sourceId: document.sourceId,
      sourceUrl: document.documentUrl,
      retrievedAt: document.retrievedAt,
      official: true,
      fullText: true,
      retrievalMetadata: {
        landingUrl: document.sourceUrl,
        contentType: document.contentType,
        extraction: "pdf-text"
      }
    }
  };
}

function matchingHints(query: string): HealthLegislationHint[] {
  const normalized = normalize(query);
  const matches = healthLegislationHints.filter((hint) =>
    // Only hints carrying a verified mevzuat document coordinate are resolvable live.
    // Placeholder/unverified hints (e.g. sourceId "needs_manual_review:...", empty
    // legislationNumber) cannot be fetched — including them would build a garbage
    // mevzuatNo= URL whose failure aborts the whole legislation result, silently
    // dropping the valid hints matched by the same query. They stay out of live
    // resolution (their coverage gap is surfaced separately).
    hintHasDirectSourceId(hint) &&
    hint.terms.some((term) => normalized.includes(normalize(term)))
  );
  const combined = new Map<string, HealthLegislationHint>();

  for (const hint of matches.sort((a, b) => a.healthLawPriority - b.healthLawPriority)) {
    const current = combined.get(hint.sourceId);
    if (!current) {
      combined.set(hint.sourceId, { ...hint, articleNumbers: [...hint.articleNumbers], terms: [...hint.terms] });
      continue;
    }

    current.articleNumbers = [...new Set([...current.articleNumbers, ...hint.articleNumbers])];
    current.terms = [...new Set([...current.terms, ...hint.terms])];
  }

  return [...combined.values()].sort((a, b) => a.healthLawPriority - b.healthLawPriority);
}

/**
 * A hint can be resolved via the direct-fetch fast path (bypassing the search API) when it
 * carries a verified mevzuat document coordinate (number/type/arrangement). Those three fields
 * are all that `mapHintToSearchResult` + `getDocument` need to build the PDF/GeneratePdf URL.
 */
export function hintHasDirectSourceId(hint: HealthLegislationHint): boolean {
  return Boolean(hint.legislationNumber && hint.legislationType && hint.legislationArrangement);
}

function mapHintToSearchResult(hint: HealthLegislationHint): OfficialLegislationSearchResult {
  return {
    sourceId: hint.sourceId,
    title: hint.title,
    sourceUrl: `${BASE_URL}/mevzuat?MevzuatNo=${hint.legislationNumber}&MevzuatTur=${hint.legislationType}&MevzuatTertip=${hint.legislationArrangement}`,
    documentUrl: officialDocumentUrl(hint),
    legislationNumber: hint.legislationNumber,
    legislationType: hint.legislationType,
    legislationArrangement: hint.legislationArrangement
  };
}

/**
 * Extract a valid PDF download URL from mevzuat.gov.tr landing page HTML.
 *
 * The landing page contains full-URL links like:
 *   https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.17232.pdf
 *   https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=17232&...
 *
 * Priorities:
 *   1. MevzuatMetin/...pdf (static PDF)
 *   2. File/GeneratePdf (dynamic PDF generator)
 *   3. Any .pdf href (broader catch)
 */
function extractPdfUrlFromLandingPage(html: string): string | null {
  // 1. Full-URL or relative MevzuatMetin PDF links (highest priority — static file)
  const metinFull = html.match(/href="(https?:\/\/www\.mevzuat\.gov\.tr\/MevzuatMetin[^"]+\.pdf)"/i);
  if (metinFull) return metinFull[1];

  const metinRelative = html.match(/href="(\/MevzuatMetin[^"]+\.pdf)"/i);
  if (metinRelative) return new URL(metinRelative[1], BASE_URL).toString();

  // 2. GeneratePdf links (dynamic PDF — full URL or relative)
  const genFull = html.match(/href="(https?:\/\/www\.mevzuat\.gov\.tr\/File\/GeneratePdf[^"]+)"/i);
  if (genFull) return genFull[1];

  const genRelative = html.match(/href="(\/File\/GeneratePdf[^"]+)"/i);
  if (genRelative) return new URL(genRelative[1], BASE_URL).toString();

  // 3. Any other .pdf link on the page (broader catch)
  const anyPdf = html.match(/href="([^"]+\.pdf)"/i);
  if (anyPdf) {
    const raw = anyPdf[1];
    return raw.startsWith("http") ? raw : new URL(raw, BASE_URL).toString();
  }

  return null;
}

function officialPdfUrl(type: string, arrangement: string, number: string) {
  return `${BASE_URL}/MevzuatMetin/${type}.${arrangement}.${number}.pdf`;
}

function officialGeneratedPdfUrl(type: string, arrangement: string, number: string) {
  const typeName = type === "7" ? "KurumVeKurulusYonetmeligi" : type;
  return `${BASE_URL}/File/GeneratePdf?mevzuatNo=${number}&mevzuatTur=${typeName}&mevzuatTertip=${arrangement}`;
}

function officialDocumentUrl(hint: HealthLegislationHint) {
  return officialDocumentUrlForParts(hint.legislationType, hint.legislationArrangement, hint.legislationNumber);
}

function officialDocumentUrlForParts(type: string, arrangement: string, number: string) {
  return type === "7"
    ? officialGeneratedPdfUrl(type, arrangement, number)
    : officialPdfUrl(type, arrangement, number);
}

function officialHeaders(contentType?: string): Record<string, string> {
  return {
    Accept: "application/pdf, application/json, text/html;q=0.9",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: `${BASE_URL}/`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function unavailable(
  errorCode: LiveLegislationUnavailable["errorCode"],
  message: string,
  retryable: boolean,
  recommendedNextStep: string,
  sourceTrace?: LegislationSourceTrace[]
): LiveLegislationUnavailable {
  const result = { status: "unavailable" as const, source: OFFICIAL_SOURCE, errorCode, message, retryable, recommendedNextStep, ...(sourceTrace ? { sourceTrace } : {}) };
  return {
    ...result,
    ...(sourceTrace ? {
      selectionDiagnostics: buildLegislationSelectionDiagnostics({
        query: sourceTrace[0]?.query ?? "",
        sourceMode: "live",
        provisions: [],
        sourceUnavailable: [result]
      })
    } : {})
  };
}

function isUnavailable(value: unknown): value is LiveLegislationUnavailable {
  return typeof value === "object" && value !== null && "status" in value && value.status === "unavailable";
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function stringField(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function cleanSearchTitle(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function officialSearchRequest(phrase: string): LegislationSourceTrace["officialSearchRequest"] {
  return {
    url: `${BASE_URL}/anasayfa/MevzuatDatatable`,
    phrase,
    searchArea: "Tumu",
    pageSize: 10
  };
}

function emptyTrace(
  query: string,
  hint: HealthLegislationHint | null,
  extra: Partial<LegislationSourceTrace> = {}
): LegislationSourceTrace {
  return {
    query,
    matchedHealthMapping: hint ? {
      sourceId: hint.sourceId,
      query: hint.query,
      title: hint.title,
      articleNumbers: hint.articleNumbers,
      topicCluster: hint.topicCluster,
      legislationRole: hint.legislationRole,
      healthLawPriority: hint.healthLawPriority,
      selectionReason: hint.selectionReason
    } : null,
    officialSearchRequest: null,
    officialSearchResultsCount: null,
    selectedSearchResult: null,
    selectedResultReason: null,
    landingUrl: null,
    detailUrl: null,
    fullTextUrl: null,
    directPdfUrl: null,
    generatedPdfUrl: null,
    contentType: null,
    extractionMethod: null,
    extractedArticleNumbers: [],
    candidateArticleNumbers: [],
    rankedArticleNumbers: [],
    rejectedArticleNumbers: [],
    rankingMethod: null,
    retrievedAt: null,
    ...extra
  };
}

function traceSearchResult(result: OfficialLegislationSearchResult) {
  return {
    sourceId: result.sourceId,
    title: result.title,
    landingUrl: result.sourceUrl,
    documentUrl: result.documentUrl
  };
}

function traceDocument(
  document: LiveLegislationDocument,
  extractedArticleNumbers: string[],
  rankingTrace: Pick<
    LegislationSourceTrace,
    "candidateArticleNumbers" | "rankedArticleNumbers" | "rejectedArticleNumbers" | "rankingMethod"
  >
): Partial<LegislationSourceTrace> {
  const isGenerated = document.documentUrl.includes("/File/GeneratePdf");
  return {
    landingUrl: document.sourceUrl,
    detailUrl: document.sourceUrl,
    fullTextUrl: document.documentUrl,
    directPdfUrl: isGenerated ? null : document.documentUrl,
    generatedPdfUrl: isGenerated ? document.documentUrl : null,
    contentType: document.contentType,
    extractionMethod: "pdf-text > article-marker",
    extractedArticleNumbers,
    ...rankingTrace,
    retrievedAt: document.retrievedAt
  };
}

function completeTrace(trace: LegislationSourceTrace, extra: Partial<LegislationSourceTrace>) {
  return { ...trace, ...extra };
}

function withTrace(unavailableResult: LiveLegislationUnavailable, sourceTrace: LegislationSourceTrace[]) {
  return {
    ...unavailableResult,
    sourceTrace,
    selectionDiagnostics: buildLegislationSelectionDiagnostics({
      query: sourceTrace[0]?.query ?? "",
      sourceMode: "live",
      provisions: [],
      sourceUnavailable: [unavailableResult]
    })
  };
}

/**
 * Extract a document title from the first ~200 chars of official PDF text.
 * Turkish official legislation PDFs typically start with the full regulation name
 * in uppercase on the first line. We take the first line or up to 200 chars.
 */
function extractDocumentTitle(text: string): string {
  const cleaned = text.trim().replace(/^\uFEFF/, "").trim();
  if (!cleaned) return "";
  // First line (up to first newline or 200 chars, whichever is shorter)
  const firstNewline = cleaned.indexOf("\n");
  const line = firstNewline >= 0 ? cleaned.slice(0, firstNewline).trim() : cleaned.slice(0, 200).trim();
  // Clean up: remove leading page numbers, dashes, whitespace
  return line.replace(/^[\d\s\-–—.]+/, "").trim();
}

function sortProvisionsByHealthPriority(provisions: LegislationProvision[]) {
  return provisions.sort((left, right) =>
    (left.sourceTrace?.matchedHealthMapping?.healthLawPriority ?? Number.MAX_SAFE_INTEGER) -
    (right.sourceTrace?.matchedHealthMapping?.healthLawPriority ?? Number.MAX_SAFE_INTEGER)
  );
}

function tracePriority(left: LegislationSourceTrace, right: LegislationSourceTrace) {
  return (left.matchedHealthMapping?.healthLawPriority ?? Number.MAX_SAFE_INTEGER) -
    (right.matchedHealthMapping?.healthLawPriority ?? Number.MAX_SAFE_INTEGER);
}
