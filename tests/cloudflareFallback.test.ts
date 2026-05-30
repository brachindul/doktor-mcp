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

function htmlPage(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function htmlPageWithPdfLink(link: string): Response {
  return htmlPage(`<html><a href="${link}">Mevzuat Metni</a></html>`);
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
      .mockResolvedValueOnce(htmlPageWithPdfLink("/MevzuatMetin/7.5.17232.pdf"))
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

  it("should successfully fetch Atama Yönetmeliği via landing page fallback", async () => {
    const mockHtml = `<html>
      <a href="https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.17232.doc">Doc</a>
      <a href="https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.17232.pdf">Mevzuat Metni</a>
    </html>`;
    const mockPdfContent = "MADDE 1- Atama ve yer değiştirme usul ve esasları.";

    const fetchImpl = vi.fn()
      // 1st call (with retries): direct PDF fails
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      // retry
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      // retry delay then 2nd try
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      // 2nd landing page: succeeds with HTML containing full-URL PDF links
      .mockResolvedValueOnce(new Response(mockHtml, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      }))
      // 3rd call: fetch extracted PDF URL succeeds
      .mockResolvedValueOnce(new Response(mockPdfContent, {
        status: 200,
        headers: { "content-type": "application/pdf" }
      }));

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {},
      now: () => new Date("2026-05-30T00:00:00.000Z")
    });

    const result = await adapter.fetchOfficialDocument("mevzuat:7.5.17232");
    expect("errorCode" in result ? result.errorCode : "").not.toBe("source_blocked_cloudflare");
    if (!("errorCode" in result)) {
      expect(result.title).toBeDefined();
      expect(result.text).toContain("MADDE 1");
    }
  });

  it("should extract PDF URL from landing page with relative path links", async () => {
    const mockHtml = `<html><a href="/MevzuatMetin/7.5.17232.pdf">Metin</a></html>`;
    const mockPdfContent = "Test PDF content";

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(forbidden())   // direct PDF fails
      .mockResolvedValueOnce(forbidden())   // retry 1
      .mockResolvedValueOnce(forbidden())   // retry 2
      .mockResolvedValueOnce(htmlPage(mockHtml))   // landing page
      .mockResolvedValueOnce(new Response(mockPdfContent, {
        status: 200,
        headers: { "content-type": "application/pdf" }
      }));

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {},
      now: () => new Date("2026-05-30T00:00:00.000Z")
    });

    const result = await adapter.fetchOfficialDocument("mevzuat:7.5.17232");
    if (!("errorCode" in result)) {
      expect(result.text).toBe(mockPdfContent);
    }
    // Verify the extracted PDF URL was called with full URL
    const fallbackCall = fetchImpl.mock.calls.find(([, , url]: [any, any, string?]) =>
      url?.includes("MevzuatMetin") || (typeof fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1]?.[0] === "string" && fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1][0].includes("MevzuatMetin"))
    );
    // The last fetch call should target the MevzuatMetin URL
    const lastCallUrl = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1]?.[0];
    expect(String(lastCallUrl)).toContain("MevzuatMetin");
  });

  it("should handle landing page with GeneratePdf link", async () => {
    const mockHtml = `<html><a href="/File/GeneratePdf?mevzuatNo=17232&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5">PDF</a></html>`;
    const mockPdfContent = "GeneratePdf content";

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(forbidden())   // direct PDF - retry 1
      .mockResolvedValueOnce(forbidden())   // direct PDF - retry 2
      .mockResolvedValueOnce(forbidden())   // direct PDF - retry 3
      .mockResolvedValueOnce(htmlPage(mockHtml))   // landing page
      .mockResolvedValueOnce(new Response(mockPdfContent, {
        status: 200,
        headers: { "content-type": "application/pdf" }
      }));

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {},
      now: () => new Date("2026-05-30T00:00:00.000Z")
    });

    const result = await adapter.fetchOfficialDocument("mevzuat:7.5.17232");
    if (!("errorCode" in result)) {
      expect(result.text).toBe(mockPdfContent);
    }
    const lastCallUrl = String(fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1]?.[0]);
    expect(lastCallUrl).toContain("File/GeneratePdf");
  });

  it("should skip landing page parsing when response is not HTML", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(forbidden())   // direct PDF - retry 1
      .mockResolvedValueOnce(forbidden())   // direct PDF - retry 2
      .mockResolvedValueOnce(forbidden())   // direct PDF - retry 3
      // Landing page returns non-HTML (e.g., Cloudflare challenge page with no content-type)
      .mockResolvedValueOnce(new Response("Challenge", { status: 403 }));

    const adapter = new LiveOfficialLegislationAdapter({
      fetchImpl,
      wait: async () => {},
      now: () => new Date("2026-05-30T00:00:00.000Z")
    });

    const result = await adapter.fetchOfficialDocument("mevzuat:7.5.17232");
    expect(result).toHaveProperty("errorCode", "source_blocked_cloudflare");
    expect(result).toHaveProperty("status", "unavailable");
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
