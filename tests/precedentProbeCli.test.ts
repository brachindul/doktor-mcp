import { describe, it, expect } from "vitest";
import { buildResponseShapeSummary, probeSource } from "../src/precedentProbeCli.js";

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
