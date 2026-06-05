export const BEDESTEN_BASE_URL = "https://bedesten.adalet.gov.tr";
export const BEDESTEN_SOURCE = "bedesten";

export type BedestenCourtType =
  | "YARGITAYKARARI"
  | "DANISTAYKARAR"
  | "YERELHUKUK"
  | "ISTINAFHUKUK"
  | "KYB";

export const BEDESTEN_PUBLIC_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json; charset=utf-8",
  AdaletApplicationName: "UyapMevzuat",
  Origin: "https://mevzuat.adalet.gov.tr",
  Referer: "https://mevzuat.adalet.gov.tr/"
};

export interface BedestenSearchRequestData {
  pageSize: number;
  pageNumber: number;
  itemTypeList: BedestenCourtType[];
  phrase: string;
  sortFields: string[];
  sortDirection: "asc" | "desc";
}

export interface BedestenSearchRequestBody {
  data: BedestenSearchRequestData;
  applicationName: "UyapMevzuat";
  paging: true;
}

export interface BedestenDocumentRequestBody {
  data: {
    documentId: string;
  };
  applicationName: "UyapMevzuat";
}

export interface BedestenSearchResult {
  documentId: string;
  title: string;
  court: string | null;
  chamber: string | null;
  decisionDate: string | null;
  esasNo: string | null;
  kararNo: string | null;
  summary: string | null;
  raw: Record<string, unknown>;
}

export interface BedestenDocument {
  documentId: string;
  title: string | null;
  court: string | null;
  chamber: string | null;
  decisionDate: string | null;
  esasNo: string | null;
  kararNo: string | null;
  mimeType: string;
  contentBase64: string | null;
  raw: Record<string, unknown>;
}

export function buildBedestenSearchBody(
  query: string,
  courtTypes: BedestenCourtType[] = ["YARGITAYKARARI", "DANISTAYKARAR", "YERELHUKUK", "ISTINAFHUKUK", "KYB"],
  pageSize = 5,
  chamber?: string
): BedestenSearchRequestBody {
  const body: BedestenSearchRequestBody = {
    data: {
      pageSize,
      pageNumber: 1,
      itemTypeList: courtTypes,
      phrase: query,
      sortFields: ["KARAR_TARIHI"],
      sortDirection: "desc"
    },
    applicationName: "UyapMevzuat",
    paging: true
  };
  // T47.1: Optional chamber filter via birimAdi field
  if (chamber) {
    (body.data as unknown as Record<string, unknown>).birimAdi = chamber;
  }
  return body;
}

export function buildBedestenDocumentBody(documentId: string): BedestenDocumentRequestBody {
  return {
    data: {
      documentId
    },
    applicationName: "UyapMevzuat"
  };
}

export function normalizeBedestenSearchResponse(raw: unknown): BedestenSearchResult[] {
  const rawRecord = asRecord(raw);
  const data = asRecord(rawRecord.data);
  const listValue = data.emsalKararList ?? data.items ?? data.results ?? rawRecord.emsalKararList ?? [];
  const list = Array.isArray(listValue) ? listValue : [];

  return list.map((entry) => {
    const record = asRecord(entry);
    const itemType = asRecord(record.itemType);
    const court = nullableString(itemType.description ?? itemType.name ?? record.itemType);
    const chamber = nullableString(record.birimAdi ?? record.chamber);
    const decisionDate = nullableString(record.kararTarihiStr ?? record.kararTarihi ?? record.decisionDate);
    const esasNo = nullableString(record.esasNo);
    const kararNo = nullableString(record.kararNo);
    
    const title = [court, chamber, decisionDate, esasNo && `E. ${esasNo}`, kararNo && `K. ${kararNo}`]
      .filter(Boolean)
      .join(" | ");

    return {
      documentId: String(record.documentId ?? record.id ?? ""),
      title: title || nullableString(record.title) || "Başlıksız karar",
      court,
      chamber,
      decisionDate,
      esasNo,
      kararNo,
      summary: nullableString(record.ozet ?? record.summary ?? record.kararTuru),
      raw: record
    };
  }).filter((entry) => entry.documentId);
}

export function normalizeBedestenDocumentResponse(documentId: string, raw: unknown): BedestenDocument {
  const rawRecord = asRecord(raw);
  const data = asRecord(rawRecord.data ?? rawRecord);
  const contentValue = data.content;
  const mimeType = String(data.mimeType ?? data.mime_type ?? "application/octet-stream");
  const contentBase64 = typeof contentValue === "string" ? contentValue.trim() : null;

  return {
    documentId,
    title: nullableString(data.title),
    court: nullableString(data.court),
    chamber: nullableString(data.chamber ?? data.birimAdi),
    decisionDate: nullableString(data.decisionDate ?? data.kararTarihi ?? data.kararTarihiStr),
    esasNo: nullableString(data.esasNo),
    kararNo: nullableString(data.kararNo),
    mimeType,
    contentBase64,
    raw: rawRecord
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  return stringValue ? stringValue : null;
}
