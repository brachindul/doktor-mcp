import { PDFParse } from "pdf-parse";
import type { ClassifiedMedicalLegalQuestion, LegislationProvision } from "../../contracts/legal.js";
import type { LegislationSourceAdapter } from "../types.js";
import { extractArticlesFromOfficialText } from "./articleParser.js";
import { healthLegislationHints } from "./healthMappings.js";
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
}

export class LiveOfficialLegislationAdapter implements LegislationSourceAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(options: LiveOfficialLegislationAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
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
        "Refine the health-law query or add a verified official legislation hint."
      );
    }

    const documents: LiveLegislationDocument[] = [];
    const provisions: LegislationProvision[] = [];
    const searchResults = hints.map(mapHintToSearchResult);

    for (const hint of hints) {
      const document = await this.getDocument(mapHintToSearchResult(hint));
      if (isUnavailable(document)) return document;
      documents.push(document);

      const selected = extractArticlesFromOfficialText(document.text)
        .filter((article) => hint.articleNumbers.includes(article.articleNumber));
      if (selected.length === 0) {
        return unavailable(
          "provision_not_found",
          `Official text was retrieved for ${hint.title}, but mapped articles ${hint.articleNumbers.join(", ")} were not extracted.`,
          false,
          "Inspect the official text parser before using this provision in an answer."
        );
      }

      provisions.push(...selected.map((article) => provisionFromArticle(hint, article.text, article.articleNumber, document)));
    }

    return { status: "ok", source: OFFICIAL_SOURCE, query, searchResults, documents, provisions };
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
          AranacakIfade: query,
          AranacakYer: "Tumu",
          TamCumle: false,
          MevzuatTur: 0,
          GenelArama: true
        }
      })
    });
    if (isUnavailable(response)) return response;

    try {
      const raw = (await response.json()) as { data?: Array<Record<string, unknown>> };
      return (raw.data ?? []).flatMap((row) => {
        const number = stringField(row.mevzuatNo);
        const type = stringField(row.mevzuatTur);
        const arrangement = stringField(row.mevzuatTertip);
        const title = stringField(row.mevAdi);
        if (!number || !type || !arrangement || !title) return [];

        return [{
          sourceId: `mevzuat:${type}.${arrangement}.${number}`,
          title,
          sourceUrl: new URL(stringField(row.url) || `/mevzuat?MevzuatNo=${number}&MevzuatTur=${type}&MevzuatTertip=${arrangement}`, BASE_URL).toString(),
          documentUrl: officialPdfUrl(type, arrangement, number),
          legislationNumber: number,
          legislationType: type,
          legislationArrangement: arrangement
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
    const response = await this.fetchWithAdaptiveBackoff(result.documentUrl, {
      headers: officialHeaders()
    });
    if (isUnavailable(response)) return response;

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

  private async fetchWithAdaptiveBackoff(url: string, init: RequestInit): Promise<Response | LiveLegislationUnavailable> {
    const attempts = [0, 250, 750];

    for (const delay of attempts) {
      if (delay > 0) await this.wait(delay);

      try {
        const response = await this.fetchImpl(url, init);
        if (response.ok) return response;
        if ((response.status === 403 || response.status === 429) && delay !== attempts.at(-1)) continue;
        if (response.status >= 500 && delay !== attempts.at(-1)) continue;

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
        if (delay !== attempts.at(-1)) continue;
        return unavailable(
          "source_error",
          `Official source request failed: ${error instanceof Error ? error.message : String(error)}`,
          true,
          "Retry the official source after checking network access."
        );
      }
    }

    return unavailable("source_error", "Official source request ended unexpectedly.", true, "Retry the request.");
  }
}

function provisionFromArticle(hint: HealthLegislationHint, text: string, articleNumber: string, document: LiveLegislationDocument): LegislationProvision {
  return {
    documentId: document.sourceId,
    legislationName: document.title,
    articleNumber,
    verbatimText: text,
    connection: `Official MVP mapping for ${hint.query}; quote extracted from article ${articleNumber} source text.`,
    dimensions: hint.dimensions,
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
    hint.terms.some((term) => normalized.includes(normalize(term)))
  );
  return [...new Map(matches.map((hint) => [hint.sourceId, hint])).values()];
}

function mapHintToSearchResult(hint: HealthLegislationHint): OfficialLegislationSearchResult {
  return {
    sourceId: hint.sourceId,
    title: hint.title,
    sourceUrl: `${BASE_URL}/mevzuat?MevzuatNo=${hint.legislationNumber}&MevzuatTur=${hint.legislationType}&MevzuatTertip=${hint.legislationArrangement}`,
    documentUrl: officialPdfUrl(hint.legislationType, hint.legislationArrangement, hint.legislationNumber),
    legislationNumber: hint.legislationNumber,
    legislationType: hint.legislationType,
    legislationArrangement: hint.legislationArrangement
  };
}

function officialPdfUrl(type: string, arrangement: string, number: string) {
  return `${BASE_URL}/MevzuatMetin/${type}.${arrangement}.${number}.pdf`;
}

function officialHeaders(contentType?: string): Record<string, string> {
  return {
    Accept: "application/pdf, application/json;q=0.9, text/html;q=0.8",
    ...(contentType ? { "Content-Type": contentType } : {}),
    Referer: `${BASE_URL}/`,
    "User-Agent": "physician-legal-mcp/0.2 official-legislation-check"
  };
}

function unavailable(errorCode: LiveLegislationUnavailable["errorCode"], message: string, retryable: boolean, recommendedNextStep: string): LiveLegislationUnavailable {
  return { status: "unavailable", source: OFFICIAL_SOURCE, errorCode, message, retryable, recommendedNextStep };
}

function isUnavailable(value: Response | LiveLegislationDocument | LiveLegislationUnavailable): value is LiveLegislationUnavailable {
  return "status" in value && value.status === "unavailable";
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function stringField(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}
