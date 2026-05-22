/**
 * Precedent Source Probe / Calibration CLI
 * Usage: npm run probe:precedents -- "query" -- --source yargitay
 *        npm run probe:precedents -- "query" -- --source danistay
 *        npm run probe:precedents -- "query" -- --source yargitay,danistay
 *        npm run probe:precedents -- "query" -- --source yargitay --save-fixture
 *        npm run probe:precedents -- "query" -- --source yargitay --save-raw-fixture
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface ProbeSourceReport {
  source: string;
  url: string;
  query: string;
  httpStatus: number | null;
  contentType: string | null;
  redirected: boolean;
  blocked: boolean;
  captchaLike: boolean;
  dnsError: boolean;
  fetchError: boolean;
  errorMessage: string | null;
  responseShape: ResponseShapeSummary | null;
  calibrationStatus: string;
  timestamp: string;
}

export interface ResponseShapeSummary {
  isJson: boolean;
  isArray: boolean;
  hasDataField: boolean;
  hasResultsField: boolean;
  hasKararlarField: boolean;
  hasItemsField: boolean;
  topLevelKeys: string[];
  itemCount: number | null;
  sampleItemKeys: string[] | null;
}

export function buildResponseShapeSummary(body: unknown): ResponseShapeSummary {
  const isJson = body !== null && body !== undefined;
  const isArray = Array.isArray(body);

  if (!isJson) {
    return {
      isJson: false,
      isArray: false,
      hasDataField: false,
      hasResultsField: false,
      hasKararlarField: false,
      hasItemsField: false,
      topLevelKeys: [],
      itemCount: null,
      sampleItemKeys: null
    };
  }

  if (isArray) {
    const arr = body as unknown[];
    const sample = arr[0];
    return {
      isJson: true,
      isArray: true,
      hasDataField: false,
      hasResultsField: false,
      hasKararlarField: false,
      hasItemsField: false,
      topLevelKeys: [],
      itemCount: arr.length,
      sampleItemKeys: sample && typeof sample === "object" ? Object.keys(sample as object).slice(0, 15) : null
    };
  }

  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const keys = Object.keys(obj);
    const dataField = obj.data;
    const dataArray = Array.isArray(dataField) ? dataField : null;
    const candidates = [obj.data, obj.results, obj.kararlar, obj.items];
    const arr = candidates.find(Array.isArray) as unknown[] | undefined;

    return {
      isJson: true,
      isArray: false,
      hasDataField: "data" in obj,
      hasResultsField: "results" in obj,
      hasKararlarField: "kararlar" in obj,
      hasItemsField: "items" in obj,
      topLevelKeys: keys.slice(0, 20),
      itemCount: arr ? arr.length : (dataArray ? dataArray.length : null),
      sampleItemKeys: arr && arr[0] && typeof arr[0] === "object" ? Object.keys(arr[0] as object).slice(0, 15) : null
    };
  }

  return {
    isJson: true,
    isArray: false,
    hasDataField: false,
    hasResultsField: false,
    hasKararlarField: false,
    hasItemsField: false,
    topLevelKeys: [],
    itemCount: null,
    sampleItemKeys: null
  };
}

function detectCaptchaLike(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("captcha") ||
    lower.includes("robot") ||
    lower.includes("bot detection") ||
    lower.includes("cloudflare") ||
    lower.includes("challenge") ||
    lower.includes("access denied")
  );
}

export async function probeSource(
  sourceName: string,
  url: string,
  body: object,
  headers: Record<string, string>,
  query: string
): Promise<ProbeSourceReport> {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });

    const contentType = response.headers.get("content-type") ?? null;
    const redirected = response.redirected;
    const httpStatus = response.status;

    const blocked = httpStatus === 403 || httpStatus === 401 || httpStatus === 429;

    let rawText: string;
    try {
      rawText = await response.text();
    } catch {
      rawText = "";
    }

    const captchaLike = detectCaptchaLike(rawText);

    let parsedBody: unknown = null;
    let responseShape: ResponseShapeSummary | null = null;

    if (contentType?.includes("json") || rawText.trimStart().startsWith("{") || rawText.trimStart().startsWith("[")) {
      try {
        parsedBody = JSON.parse(rawText);
        responseShape = buildResponseShapeSummary(parsedBody);
      } catch {
        responseShape = null;
      }
    }

    let calibrationStatus: string;
    if (!response.ok && blocked) {
      calibrationStatus = "source_blocked";
    } else if (!response.ok) {
      calibrationStatus = `http_error_${httpStatus}`;
    } else if (captchaLike) {
      calibrationStatus = "captcha_detected";
    } else if (responseShape?.isJson) {
      calibrationStatus = "reachable_json";
    } else {
      calibrationStatus = "reachable_non_json";
    }

    return {
      source: sourceName,
      url,
      query,
      httpStatus,
      contentType,
      redirected,
      blocked,
      captchaLike,
      dnsError: false,
      fetchError: false,
      errorMessage: null,
      responseShape,
      calibrationStatus,
      timestamp
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isDns = msg.includes("ENOTFOUND") || msg.includes("getaddrinfo") || msg.includes("EAI_AGAIN");
    const isTimeout = msg.includes("AbortError") || msg.includes("timeout") || msg.includes("TimeoutError");

    return {
      source: sourceName,
      url,
      query,
      httpStatus: null,
      contentType: null,
      redirected: false,
      blocked: false,
      captchaLike: false,
      dnsError: isDns,
      fetchError: true,
      errorMessage: msg,
      responseShape: null,
      calibrationStatus: isDns ? "unavailable_in_environment" : isTimeout ? "timeout" : "fetch_error",
      timestamp
    };
  }
}

const YARGITAY_SEARCH_URL = "https://emsal.yargitay.gov.tr/BilgiBankasiIslem";
const DANISTAY_SEARCH_URL = "https://karararama.danistay.gov.tr/YargitayBilgiBankasiIstemciService";

function buildYargitayProbeBody(query: string) {
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
      kayitSayisi: 3,
      baslangicKayit: 0
    }
  };
}

function buildDanistayProbeBody(query: string) {
  return {
    data: {
      arananKelime: query,
      birimDanistayDaire: 0,
      birimDanistayHGK: 0,
      birimDanistayBGK: 0,
      birimDanistayIDDK: 0,
      basTarih: "",
      bitTarih: "",
      esasYil: "",
      esasSira: "",
      kararYil: "",
      kararSira: "",
      kayitSayisi: 3,
      baslangicKayit: 0
    }
  };
}

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const queryParts = separator === -1 ? args.filter((a) => !a.startsWith("--")) : args.slice(0, separator);
const optionParts = separator === -1 ? args.filter((a) => a.startsWith("--")) : args.slice(separator + 1);

const query = queryParts.join(" ") || "aydınlatılmış rıza";

const sourceIndex = optionParts.indexOf("--source");
const sourceArg = sourceIndex !== -1 ? optionParts[sourceIndex + 1] : "yargitay,danistay";
const sources = sourceArg.split(",").map((s) => s.trim()) as Array<"yargitay" | "danistay">;

const saveFixture = optionParts.includes("--save-fixture");
const saveRawFixture = optionParts.includes("--save-raw-fixture");

const reports: ProbeSourceReport[] = [];

for (const source of sources) {
  let report: ProbeSourceReport;

  if (source === "yargitay") {
    report = await probeSource(
      "yargitay",
      YARGITAY_SEARCH_URL,
      buildYargitayProbeBody(query),
      {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json, text/html;q=0.9",
        Referer: "https://emsal.yargitay.gov.tr/",
        "User-Agent": "physician-legal-mcp/0.11 probe-cli"
      },
      query
    );
  } else if (source === "danistay") {
    report = await probeSource(
      "danistay",
      DANISTAY_SEARCH_URL,
      buildDanistayProbeBody(query),
      {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json, text/html;q=0.9",
        Referer: "https://karararama.danistay.gov.tr/",
        "User-Agent": "physician-legal-mcp/0.11 probe-cli"
      },
      query
    );
  } else {
    report = {
      source,
      url: "",
      query,
      httpStatus: null,
      contentType: null,
      redirected: false,
      blocked: false,
      captchaLike: false,
      dnsError: false,
      fetchError: true,
      errorMessage: `Unknown source: ${source}`,
      responseShape: null,
      calibrationStatus: "unknown_source",
      timestamp: new Date().toISOString()
    };
  }

  reports.push(report);

  if (saveFixture || saveRawFixture) {
    const fixturesDir = new URL("../fixtures/live-samples", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    await mkdir(fixturesDir, { recursive: true });

    const fixtureName = `${source}-probe-${Date.now()}.json`;
    const fixtureData = {
      _note: "Probe shape fixture — no raw body content",
      source: report.source,
      url: report.url,
      query: report.query,
      httpStatus: report.httpStatus,
      contentType: report.contentType,
      calibrationStatus: report.calibrationStatus,
      responseShape: report.responseShape,
      timestamp: report.timestamp
    };
    await writeFile(join(fixturesDir, fixtureName), JSON.stringify(fixtureData, null, 2), "utf-8");
  }
}

const output = {
  tool: "probe_precedent_sources",
  input: { query, sources, saveFixture, saveRawFixture },
  reports
};

console.log(JSON.stringify(output, null, 2));
