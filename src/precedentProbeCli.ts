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

export interface HtmlAnalysis {
  title: string | null;
  hasLoginForm: boolean;
  hasSearchForm: boolean;
  formActions: string[];
  hiddenInputNames: string[];
  scriptEndpointHints: string[];
  bodyLengthBytes: number;
  looksLikeShell: boolean;
  looksLikeSoapOrXml: boolean;
  looksLikeErrorPage: boolean;
  captchaHints: string[];
  sessionOrAuthHints: string[];
}

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
  htmlAnalysis: HtmlAnalysis | null;
  calibrationStatus: string;
  recommendedNextStep: string;
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
    return { isJson: false, isArray: false, hasDataField: false, hasResultsField: false, hasKararlarField: false, hasItemsField: false, topLevelKeys: [], itemCount: null, sampleItemKeys: null };
  }

  if (isArray) {
    const arr = body as unknown[];
    const sample = arr[0];
    return {
      isJson: true, isArray: true, hasDataField: false, hasResultsField: false, hasKararlarField: false, hasItemsField: false,
      topLevelKeys: [], itemCount: arr.length,
      sampleItemKeys: sample && typeof sample === "object" ? Object.keys(sample as object).slice(0, 15) : null
    };
  }

  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const keys = Object.keys(obj);
    const candidates = [obj.data, obj.results, obj.kararlar, obj.items];
    const arr = candidates.find(Array.isArray) as unknown[] | undefined;

    return {
      isJson: true, isArray: false,
      hasDataField: "data" in obj, hasResultsField: "results" in obj,
      hasKararlarField: "kararlar" in obj, hasItemsField: "items" in obj,
      topLevelKeys: keys.slice(0, 20),
      itemCount: arr ? arr.length : null,
      sampleItemKeys: arr && arr[0] && typeof arr[0] === "object" ? Object.keys(arr[0] as object).slice(0, 15) : null
    };
  }

  return { isJson: true, isArray: false, hasDataField: false, hasResultsField: false, hasKararlarField: false, hasItemsField: false, topLevelKeys: [], itemCount: null, sampleItemKeys: null };
}

export function analyzeHtmlResponse(text: string): HtmlAnalysis {
  const lower = text.toLowerCase();
  const bodyLengthBytes = Buffer.byteLength(text, "utf-8");

  // Title
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 200) : null;

  // Forms
  const formActions: string[] = [];
  const formMatches = text.matchAll(/<form[^>]*action="([^"]+)"/gi);
  for (const m of formMatches) formActions.push(m[1]);

  const hasLoginForm = lower.includes("login") || lower.includes("giriş") || lower.includes("kullanici") || lower.includes("password") || lower.includes("sifre");
  const hasSearchForm = lower.includes("search") || lower.includes("ara") || lower.includes("arama");

  // Hidden inputs
  const hiddenInputNames: string[] = [];
  const hiddenMatches = text.matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"/gi);
  for (const m of hiddenMatches) hiddenInputNames.push(m[1]);

  // Script endpoint hints
  const scriptEndpointHints: string[] = [];
  const urlMatches = text.matchAll(/["'](\/[A-Za-z][A-Za-z0-9/_-]*(?:Service|Api|Search|Islem|Bilgi)[^"']*?)["']/g);
  for (const m of urlMatches) {
    const hint = m[1];
    if (!scriptEndpointHints.includes(hint)) scriptEndpointHints.push(hint);
  }

  // Captcha hints
  const captchaHints: string[] = [];
  if (lower.includes("captcha")) captchaHints.push("captcha");
  if (lower.includes("robot")) captchaHints.push("robot");
  if (lower.includes("cloudflare")) captchaHints.push("cloudflare");
  if (lower.includes("challenge")) captchaHints.push("challenge");
  if (lower.includes("access denied")) captchaHints.push("access-denied");

  // Session/auth hints
  const sessionOrAuthHints: string[] = [];
  if (hasLoginForm) sessionOrAuthHints.push("login-form");
  if (lower.includes("session")) sessionOrAuthHints.push("session");
  if (lower.includes("unauthorized")) sessionOrAuthHints.push("unauthorized");
  if (lower.includes("oturum")) sessionOrAuthHints.push("oturum-session");
  if (lower.includes("yetkisiz")) sessionOrAuthHints.push("yetkisiz");

  const looksLikeShell = bodyLengthBytes < 5000 && lower.includes("<html");
  const looksLikeSoapOrXml = text.trimStart().startsWith("<?xml") || lower.includes("soap:envelope") || lower.includes("xmlns:");
  const looksLikeErrorPage = lower.includes("404") || lower.includes("not found") || lower.includes("bulunamadi") || lower.includes("hata");

  return {
    title, hasLoginForm, hasSearchForm, formActions,
    hiddenInputNames: hiddenInputNames.slice(0, 20),
    scriptEndpointHints: scriptEndpointHints.slice(0, 10),
    bodyLengthBytes, looksLikeShell, looksLikeSoapOrXml, looksLikeErrorPage,
    captchaHints, sessionOrAuthHints
  };
}

function deriveCalibrationStatus(
  httpStatus: number,
  ok: boolean,
  blocked: boolean,
  parsedJson: boolean,
  html: HtmlAnalysis | null
): { calibrationStatus: string; recommendedNextStep: string } {
  if (!ok && blocked) {
    return { calibrationStatus: "source_blocked", recommendedNextStep: "Source returned HTTP 401/403/429. Retry after cooldown or check if IP is blocked." };
  }
  if (!ok) {
    return { calibrationStatus: `http_error_${httpStatus}`, recommendedNextStep: `Endpoint returned HTTP ${httpStatus}. Verify endpoint URL.` };
  }
  if (html?.captchaHints && html.captchaHints.length > 0) {
    return { calibrationStatus: "captcha_or_block", recommendedNextStep: "Endpoint returned CAPTCHA/bot-detection page. Browser session required." };
  }
  if (parsedJson) {
    return { calibrationStatus: "reachable_json", recommendedNextStep: "Endpoint responds with JSON. Update normalizer to match the actual field names." };
  }
  if (html?.looksLikeSoapOrXml) {
    return { calibrationStatus: "needs_browser_capture", recommendedNextStep: "Endpoint returns SOAP/XML. Use browser DevTools to capture the actual REST/JSON endpoint used by the search UI." };
  }
  if (html?.hasLoginForm || (html?.sessionOrAuthHints && html.sessionOrAuthHints.length > 0)) {
    return { calibrationStatus: "needs_browser_capture", recommendedNextStep: "Endpoint requires login/session. Use browser DevTools with an authenticated session to capture the real search request." };
  }
  if (html?.looksLikeShell) {
    return { calibrationStatus: "html_shell_response", recommendedNextStep: "Endpoint returns an HTML shell (likely SPA). Use browser DevTools Network tab to capture the actual XHR/fetch search endpoint and request body." };
  }
  if (html) {
    return { calibrationStatus: "needs_browser_capture", recommendedNextStep: "Endpoint returns non-JSON HTML. Use browser DevTools Network tab to find the real search API endpoint." };
  }
  return { calibrationStatus: "reachable_non_json", recommendedNextStep: "Endpoint responds but not with JSON. Investigate content type and response format." };
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

    let rawText = "";
    try { rawText = await response.text(); } catch { rawText = ""; }

    const captchaLike = rawText.toLowerCase().includes("captcha") || rawText.toLowerCase().includes("robot");

    let parsedBody: unknown = null;
    let responseShape: ResponseShapeSummary | null = null;
    let htmlAnalysis: HtmlAnalysis | null = null;
    let parsedJson = false;

    const looksLikeHtml = rawText.trimStart().startsWith("<") || contentType?.includes("html");
    const looksLikeJson = contentType?.includes("json") || rawText.trimStart().startsWith("{") || rawText.trimStart().startsWith("[");

    if (looksLikeJson) {
      try {
        parsedBody = JSON.parse(rawText);
        responseShape = buildResponseShapeSummary(parsedBody);
        parsedJson = true;
      } catch { /* not JSON */ }
    }

    if (!parsedJson && looksLikeHtml) {
      htmlAnalysis = analyzeHtmlResponse(rawText);
    } else if (!parsedJson && rawText.length > 0) {
      // Neither JSON nor HTML — still do a basic check
      htmlAnalysis = analyzeHtmlResponse(rawText);
    }

    const { calibrationStatus, recommendedNextStep } = deriveCalibrationStatus(
      httpStatus, response.ok, blocked, parsedJson, htmlAnalysis
    );

    return {
      source: sourceName, url, query,
      httpStatus, contentType, redirected, blocked,
      captchaLike, dnsError: false, fetchError: false, errorMessage: null,
      responseShape, htmlAnalysis,
      calibrationStatus, recommendedNextStep, timestamp
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isDns = msg.includes("ENOTFOUND") || msg.includes("getaddrinfo") || msg.includes("EAI_AGAIN");
    const isTimeout = msg.includes("AbortError") || msg.includes("timeout") || msg.includes("TimeoutError");

    const calibrationStatus = isDns ? "unavailable_in_environment" : isTimeout ? "timeout" : "fetch_error";
    const recommendedNextStep = isDns
      ? "DNS resolution failed. Endpoint is inaccessible in this environment. Test from a machine with public network access."
      : isTimeout
        ? "Request timed out. Endpoint may be slow or blocked. Try from a different network."
        : "Network-level fetch failure. Check network connectivity and firewall rules.";

    return {
      source: sourceName, url, query,
      httpStatus: null, contentType: null,
      redirected: false, blocked: false, captchaLike: false,
      dnsError: isDns, fetchError: true, errorMessage: msg,
      responseShape: null, htmlAnalysis: null,
      calibrationStatus, recommendedNextStep, timestamp
    };
  }
}

const YARGITAY_SEARCH_URL = "https://emsal.yargitay.gov.tr/BilgiBankasiIslem";
const DANISTAY_SEARCH_URL = "https://karararama.danistay.gov.tr/YargitayBilgiBankasiIstemciService";

function buildYargitayProbeBody(query: string) {
  return {
    data: {
      arananKelime: query, birimYrgKurulDaire: 0, birimYrgHGK: 0, birimYrgBGK: 0,
      basTarih: "", bitTarih: "", esasYil: "", esasSira: "", kararYil: "", kararSira: "",
      ilkDerece: 0, kayitSayisi: 3, baslangicKayit: 0
    }
  };
}

function buildDanistayProbeBody(query: string) {
  return {
    data: {
      arananKelime: query, birimDanistayDaire: 0, birimDanistayHGK: 0,
      birimDanistayBGK: 0, birimDanistayIDDK: 0,
      basTarih: "", bitTarih: "", esasYil: "", esasSira: "", kararYil: "", kararSira: "",
      kayitSayisi: 3, baslangicKayit: 0
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
    report = await probeSource("yargitay", YARGITAY_SEARCH_URL, buildYargitayProbeBody(query), {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json, text/html;q=0.9",
      Referer: "https://emsal.yargitay.gov.tr/",
      "User-Agent": "physician-legal-mcp/0.12 probe-cli"
    }, query);
  } else if (source === "danistay") {
    report = await probeSource("danistay", DANISTAY_SEARCH_URL, buildDanistayProbeBody(query), {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json, text/html;q=0.9",
      Referer: "https://karararama.danistay.gov.tr/",
      "User-Agent": "physician-legal-mcp/0.12 probe-cli"
    }, query);
  } else {
    report = {
      source, url: "", query,
      httpStatus: null, contentType: null, redirected: false, blocked: false,
      captchaLike: false, dnsError: false, fetchError: true,
      errorMessage: `Unknown source: ${source}`,
      responseShape: null, htmlAnalysis: null,
      calibrationStatus: "unknown_source",
      recommendedNextStep: `Unknown source "${source}". Valid values: yargitay, danistay.`,
      timestamp: new Date().toISOString()
    };
  }

  reports.push(report);

  if (saveFixture || saveRawFixture) {
    const fixturesDir = new URL("../fixtures/live-samples", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    await mkdir(fixturesDir, { recursive: true });

    const fixtureName = `${source}-probe-${Date.now()}.json`;
    const sanitized = {
      _note: "Probe shape fixture — no raw body content. Sanitized for git commit.",
      source: report.source,
      capturedAt: report.timestamp,
      calibrationStatus: report.calibrationStatus,
      httpStatus: report.httpStatus,
      contentType: report.contentType,
      responseShape: report.responseShape,
      htmlAnalysis: report.htmlAnalysis ? {
        title: report.htmlAnalysis.title,
        hasLoginForm: report.htmlAnalysis.hasLoginForm,
        hasSearchForm: report.htmlAnalysis.hasSearchForm,
        formActions: report.htmlAnalysis.formActions,
        scriptEndpointHints: report.htmlAnalysis.scriptEndpointHints,
        bodyLengthBytes: report.htmlAnalysis.bodyLengthBytes,
        looksLikeShell: report.htmlAnalysis.looksLikeShell,
        looksLikeSoapOrXml: report.htmlAnalysis.looksLikeSoapOrXml,
        captchaHints: report.htmlAnalysis.captchaHints,
        sessionOrAuthHints: report.htmlAnalysis.sessionOrAuthHints
      } : null,
      recommendedNextStep: report.recommendedNextStep,
      notes: "Captured by probe CLI. Raw body not saved. Update calibrationStatus and normalizedResultPreview once real fixture is captured."
    };
    await writeFile(join(fixturesDir, fixtureName), JSON.stringify(sanitized, null, 2), "utf-8");
  }
}

console.log(JSON.stringify({
  tool: "probe_precedent_sources",
  input: { query, sources, saveFixture, saveRawFixture },
  reports
}, null, 2));
