import { describe, it, expect } from "vitest";
import { buildResponseShapeSummary, probeSource, analyzeHtmlResponse } from "../src/precedentProbeCli.js";

describe("buildResponseShapeSummary", () => {
  it("handles null body", () => {
    const shape = buildResponseShapeSummary(null);
    expect(shape.isJson).toBe(false);
    expect(shape.isArray).toBe(false);
    expect(shape.itemCount).toBeNull();
  });

  it("handles array body", () => {
    const body = [{ ID: "1", OZET: "test" }, { ID: "2", OZET: "test2" }];
    const shape = buildResponseShapeSummary(body);
    expect(shape.isJson).toBe(true);
    expect(shape.isArray).toBe(true);
    expect(shape.itemCount).toBe(2);
    expect(shape.sampleItemKeys).toContain("ID");
  });

  it("handles object with data field", () => {
    const body = { data: [{ ID: "1" }, { ID: "2" }], total: 2 };
    const shape = buildResponseShapeSummary(body);
    expect(shape.isJson).toBe(true);
    expect(shape.isArray).toBe(false);
    expect(shape.hasDataField).toBe(true);
    expect(shape.itemCount).toBe(2);
  });

  it("handles object with results field", () => {
    const body = { results: [{ ID: "1" }] };
    const shape = buildResponseShapeSummary(body);
    expect(shape.hasResultsField).toBe(true);
    expect(shape.itemCount).toBe(1);
  });

  it("handles object with no array fields", () => {
    const body = { status: "ok", message: "no results" };
    const shape = buildResponseShapeSummary(body);
    expect(shape.isJson).toBe(true);
    expect(shape.isArray).toBe(false);
    expect(shape.itemCount).toBeNull();
    expect(shape.topLevelKeys).toContain("status");
  });
});

describe("probeSource — DNS error scenario", () => {
  it("returns unavailable_in_environment on DNS failure", async () => {
    const mockFetch = async () => {
      throw new Error("getaddrinfo ENOTFOUND nonexistent.invalid.domain.xyz");
    };

    // Patch global fetch temporarily
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource(
        "yargitay",
        "https://nonexistent.invalid.domain.xyz/search",
        { data: {} },
        { "Content-Type": "application/json" },
        "test query"
      );

      expect(report.fetchError).toBe(true);
      expect(report.dnsError).toBe(true);
      expect(report.calibrationStatus).toBe("unavailable_in_environment");
      expect(report.httpStatus).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("probeSource — HTTP 429 scenario", () => {
  it("returns source_blocked on 429 response", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
      redirected: false,
      headers: {
        get: (name: string) => name === "content-type" ? "text/html" : null
      },
      text: async () => "<html>Too Many Requests</html>"
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource(
        "yargitay",
        "https://emsal.yargitay.gov.tr/BilgiBankasiIslem",
        { data: {} },
        { "Content-Type": "application/json" },
        "test query"
      );

      expect(report.httpStatus).toBe(429);
      expect(report.blocked).toBe(true);
      expect(report.calibrationStatus).toBe("source_blocked");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("probeSource — successful JSON response", () => {
  it("returns reachable_json with shape summary", async () => {
    const mockResponse = {
      data: [
        { ID: "1", OZET: "Test karar", KARAR_TARIHI: "2023-01-01" }
      ]
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      headers: {
        get: (name: string) => name === "content-type" ? "application/json; charset=utf-8" : null
      },
      text: async () => JSON.stringify(mockResponse)
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource(
        "yargitay",
        "https://emsal.yargitay.gov.tr/BilgiBankasiIslem",
        { data: {} },
        { "Content-Type": "application/json" },
        "test query"
      );

      expect(report.httpStatus).toBe(200);
      expect(report.blocked).toBe(false);
      expect(report.calibrationStatus).toBe("reachable_json");
      expect(report.responseShape?.isJson).toBe(true);
      expect(report.responseShape?.hasDataField).toBe(true);
      expect(report.responseShape?.itemCount).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("analyzeHtmlResponse", () => {
  it("detects HTML shell (SPA) response", () => {
    const html = "<html><head><title>Danıştay Arama</title></head><body><div id='app'></div></body></html>";
    const analysis = analyzeHtmlResponse(html);
    expect(analysis.title).toContain("Danıştay");
    expect(analysis.looksLikeShell).toBe(true);
    expect(analysis.looksLikeSoapOrXml).toBe(false);
  });

  it("detects captcha hints", () => {
    const html = "<html><body><p>Please solve the captcha to continue. We detected a robot.</p></body></html>";
    const analysis = analyzeHtmlResponse(html);
    expect(analysis.captchaHints).toContain("captcha");
    expect(analysis.captchaHints).toContain("robot");
  });

  it("detects login/session hints", () => {
    const html = "<html><body><form><input type='text' name='username'/><input type='password' name='sifre'/></form></body></html>";
    const analysis = analyzeHtmlResponse(html);
    expect(analysis.hasLoginForm).toBe(true);
    expect(analysis.sessionOrAuthHints).toContain("login-form");
  });

  it("detects SOAP/XML response", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><Response/></soap:Body></soap:Envelope>`;
    const analysis = analyzeHtmlResponse(xml);
    expect(analysis.looksLikeSoapOrXml).toBe(true);
  });

  it("extracts form actions", () => {
    const html = `<html><body><form action="/SearchService"><input type="hidden" name="viewstate" value="abc"/></form></body></html>`;
    const analysis = analyzeHtmlResponse(html);
    expect(analysis.formActions).toContain("/SearchService");
    expect(analysis.hiddenInputNames).toContain("viewstate");
  });

  it("extracts script endpoint hints", () => {
    const html = `<html><body><script>var url = '/api/BilgiService/Search';</script></body></html>`;
    const analysis = analyzeHtmlResponse(html);
    expect(analysis.scriptEndpointHints.some((h) => h.includes("BilgiService") || h.includes("Service"))).toBe(true);
  });

  it("returns bodyLengthBytes > 0 for non-empty content", () => {
    const html = "<html><body>content</body></html>";
    const analysis = analyzeHtmlResponse(html);
    expect(analysis.bodyLengthBytes).toBeGreaterThan(0);
  });
});

describe("probeSource — HTML shell response (Danıştay pattern)", () => {
  it("returns html_shell_response when HTTP 200 but HTML < 8KB", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      headers: { get: (name: string) => name === "content-type" ? "text/html; charset=utf-8" : null },
      text: async () => "<html><head><title>Danıştay Karar Arama</title></head><body><div id='app'></div></body></html>"
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource("danistay", "https://karararama.danistay.gov.tr/search", {}, {}, "query");
      expect(report.calibrationStatus).toBe("html_shell_response");
      expect(report.htmlAnalysis?.title).toContain("Danıştay");
      expect(report.htmlAnalysis?.looksLikeShell).toBe(true);
      expect(report.recommendedNextStep).toContain("browser");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns unexpected_html_response on login form response", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      headers: { get: () => "text/html" },
      text: async () => `<html><body><h1>Giriş Yapın</h1><form action="/login"><input type="password" name="sifre"/></form></body></html>`
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource("danistay", "https://karararama.danistay.gov.tr/", {}, {}, "query");
      expect(["unexpected_html_response", "html_shell_response"]).toContain(report.calibrationStatus);
      expect(report.htmlAnalysis?.hasLoginForm).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns unexpected_html_response on SOAP/XML response", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      headers: { get: () => "text/xml" },
      text: async () => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>`
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource("danistay", "https://karararama.danistay.gov.tr/service", {}, {}, "query");
      expect(report.calibrationStatus).toBe("unexpected_html_response");
      expect(report.htmlAnalysis?.looksLikeSoapOrXml).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("probeSource — recommendedNextStep", () => {
  it("provides DNS error next step", async () => {
    global.fetch = async () => { throw new Error("getaddrinfo ENOTFOUND test.invalid"); };
    const report = await probeSource("yargitay", "https://test.invalid/", {}, {}, "q");
    expect(report.recommendedNextStep).toContain("DNS");
    global.fetch = fetch;
  });

  it("provides source blocked next step on 403", async () => {
    global.fetch = async () => ({ ok: false, status: 403, redirected: false, headers: { get: () => null }, text: async () => "" }) as unknown as Response;
    const report = await probeSource("yargitay", "https://test.invalid/", {}, {}, "q");
    expect(report.calibrationStatus).toBe("source_blocked");
    expect(report.recommendedNextStep).toBeTruthy();
    global.fetch = fetch;
  });
});

describe("sanitized fixture shape", () => {
  it("ProbeSourceReport has no raw body content fields", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ data: [{ ID: "secret", PII: "sensitive data" }] })
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const report = await probeSource("yargitay", "https://test.url", {}, {}, "query");
      const reportStr = JSON.stringify(report);
      expect(reportStr).not.toContain("sensitive data");
      expect(reportStr).not.toContain("secret");
      // shape only contains metadata
      expect(report.responseShape?.itemCount).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
