import type { CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";
import type { LiveDanistaySearchResult } from "./liveTypes.js";

const BASE_URL = "https://karararama.danistay.gov.tr";

export function normalizeDanistaySearchResults(raw: unknown): LiveDanistaySearchResult[] {
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

    const chamber = str(row.DAIRESI ?? row.dairesi ?? row.BIRIMI ?? row.birimi ?? row.daire ?? row.birim ?? "");
    const esasYil = str(row.ESAS_YILI ?? row.esasYili ?? "");
    const esasSira = str(row.ESAS_SIRASI ?? row.esasSirasi ?? "");
    const kararYil = str(row.KARAR_YILI ?? row.kararYili ?? "");
    const kararSira = str(row.KARAR_SIRASI ?? row.kararSirasi ?? "");

    return [{
      documentId: `danistay:${id}`,
      sourceId: id,
      title: str(row.OZET ?? row.ozet ?? row.title ?? row.baslik ?? ""),
      date: normalizeDate(str(row.KARAR_TARIHI ?? row.kararTarihi ?? row.tarih ?? "")),
      chamber: chamber || undefined,
      meritsNumber: esasYil && esasSira ? `${esasYil}/${esasSira}` : undefined,
      decisionNumber: kararYil && kararSira ? `${kararYil}/${kararSira}` : undefined,
      sourceUrl: `${BASE_URL}/DanistayDetail.aspx?id=${id}`,
      documentUrl: `${BASE_URL}/DownloadDanistayDoc?id=${id}`,
      summaryText: str(row.OZET ?? row.ozet ?? "")
    }];
  });
}

export function extractDanistayFullText(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  return text.replace(/\s+/g, " ").trim();
}

export function buildDanistayDecision(
  result: LiveDanistaySearchResult,
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
    court: "danistay",
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
      source: "danistay",
      documentId: result.documentId,
      sourceId: result.sourceId,
      sourceUrl: result.sourceUrl,
      retrievedAt,
      official: true,
      fullText: fullText !== null
    }
  };
}

export function buildDanistayEmptyTrace(
  query: string,
  searchRequest: DecisionSourceTrace["searchRequest"]
): DecisionSourceTrace {
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

function extractLegalReasoning(fullText: string): string | undefined {
  const markers = ["gerekçe", "değerlendirme", "hukuki değerlendirme", "inceleme", "gerekce", "degerlendirme"];
  const lower = fullText.toLocaleLowerCase("tr-TR");
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) return fullText.slice(idx, idx + 3000).trim();
  }
  return fullText.length > 200 ? fullText.slice(0, 3000).trim() : undefined;
}

function extractOutcome(fullText: string): string | undefined {
  const markers = ["sonuç", "hüküm", "karar", "sonuc"];
  const lower = fullText.toLocaleLowerCase("tr-TR");
  for (const marker of markers) {
    const idx = lower.lastIndexOf(marker);
    if (idx !== -1 && idx > fullText.length / 2) return fullText.slice(idx, idx + 500).trim();
  }
  return undefined;
}

function normalizeDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw.slice(0, 10) || undefined;
}

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}
