import { describe, it, expect, vi } from "vitest";
import { LiveOfficialLegislationAdapter } from "../src/sources/legislation/liveOfficialLegislationAdapter.js";

function okPdf(body = "dummy pdf"): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/pdf" }
  });
}

function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

function htmlPage(link: string): Response {
  return new Response(`<html><a href="${link}">PDF</a></html>`, {
    status: 200,
    headers: { "content-type": "text/html" }
  });
}

describe("cloudflare fallback", () => {
  it("should use browser-like headers for PDF requests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okPdf());
    const adapter = new LiveOfficialLegislationAdapter({ fetchImpl, wait: async () => {} });

    await adapter.fetchOfficialDocument("mevzuat:7.5.17232");

    const calls = fetchImpl.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, init] of calls) {
      const headers = init.headers as Record<string, string>;
      expect(headers).toBeDefined();
      expect(headers["User-Agent"]).toContain("Mozilla");
      expect(headers["Referer"]).toContain("mevzuat.gov.tr");
      expect(headers["Accept-Language"]).toBeDefined();
    }
  });

  it("should try landing page fallback when direct PDF fails", async () => {
    const fetchImpl = vi.fn()
      // First call: PDF fails with 403
      .mockResolvedValueOnce(forbidden())
      // Second call: landing page returns HTML with PDF link
      .mockResolvedValueOnce(htmlPage("/MevzuatMetin/7.5.17232.pdf"))
      // Third call: extracted PDF URL succeeds
      .mockResolvedValueOnce(okPdf("dummy pdf content"));

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      now: () => new Date("2026-05-30T00:00:00.000Z"),
      wait: async () => {}
    });

    const result = await adapter.fetchOfficialDocument("mevzuat:7.5.17232");

    if ("errorCode" in result) {
      expect(result.errorCode).not.toBe("source_blocked_cloudflare");
      return;
    }
    // Should eventually succeed via fallback
    expect(result.text).toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("should return source_blocked_cloudflare when all paths fail", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValue(forbidden());

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      now: () => new Date("2026-05-30T00:00:00.000Z"),
      wait: async () => {}
    });

    const result = await adapter.fetchOfficialDocument("mevzuat:7.5.17232");

    expect(result).toHaveProperty("errorCode", "source_blocked_cloudflare");
    expect(result).toHaveProperty("status", "unavailable");
  });

  it("should include correct headers in all requests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okPdf());
    const adapter = new LiveOfficialLegislationAdapter({ fetchImpl, wait: async () => {} });

    await adapter.fetchOfficialDocument("mevzuat:7.5.17232");

    for (const [, init] of fetchImpl.mock.calls) {
      const headers = init.headers as Record<string, string>;
      expect(headers["User-Agent"]).toContain("Mozilla/5.0");
      expect(headers["Referer"]).toContain("mevzuat.gov.tr");
      expect(headers["Accept-Language"]).toBe("tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7");
    }
  });
});
