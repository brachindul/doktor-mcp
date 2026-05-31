import { describe, it, expect, vi } from "vitest";
import { checkSourceUrls, collectSourceUrls } from "../src/health/linkHealthChecker.js";

// ─── collectSourceUrls ────────────────────────────────────────────────────────

describe("collectSourceUrls", () => {
  it("should collect URLs from legislation sourceTrace", () => {
    const pack = {
      relevantLegislation: [
        {
          legislationName: "Law A",
          sourceTrace: {
            landingUrl: "https://mevzuat.gov.tr/landing?id=1",
            detailUrl: "https://mevzuat.gov.tr/detail?id=1",
          },
        },
        {
          legislationName: "Law B",
          sourceTrace: {
            landingUrl: "https://mevzuat.gov.tr/landing?id=2",
          },
        },
      ],
      verifiedHighCourtPrecedents: [],
    };
    const urls = collectSourceUrls(pack);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    expect(urls).toContain("https://mevzuat.gov.tr/landing?id=1");
    expect(urls).toContain("https://mevzuat.gov.tr/landing?id=2");
  });

  it("should collect URLs from precedents", () => {
    const pack = {
      relevantLegislation: [],
      verifiedHighCourtPrecedents: [
        { sourceUrl: "https://mevzuat.adalet.gov.tr/ictihat/123" },
      ],
    };
    const urls = collectSourceUrls(pack);
    expect(urls).toHaveLength(1);
    expect(urls).toContain("https://mevzuat.adalet.gov.tr/ictihat/123");
  });

  it("should collect direct sourceUrl from legislation items if present", () => {
    const pack = {
      relevantLegislation: [
        { sourceUrl: "https://example.com/law/direct" },
      ],
      verifiedHighCourtPrecedents: [],
    };
    const urls = collectSourceUrls(pack);
    expect(urls).toContain("https://example.com/law/direct");
  });

  it("should deduplicate URLs", () => {
    const pack = {
      relevantLegislation: [
        {
          sourceTrace: {
            landingUrl: "https://example.com/same",
          },
        },
      ],
      verifiedHighCourtPrecedents: [
        { sourceUrl: "https://example.com/same" },
      ],
    };
    const urls = collectSourceUrls(pack);
    expect(urls).toHaveLength(1);
  });

  it("should handle empty pack", () => {
    const urls = collectSourceUrls({
      relevantLegislation: [],
      verifiedHighCourtPrecedents: [],
    });
    expect(urls).toHaveLength(0);
  });

  it("should handle missing fields gracefully", () => {
    const urls = collectSourceUrls({});
    expect(urls).toHaveLength(0);
  });

  it("should collect fullTextUrl and directPdfUrl from sourceTrace", () => {
    const pack = {
      relevantLegislation: [
        {
          sourceTrace: {
            fullTextUrl: "https://mevzuat.gov.tr/fulltext?id=1",
            directPdfUrl: "https://mevzuat.gov.tr/pdf?id=1",
          },
        },
      ],
      verifiedHighCourtPrecedents: [],
    };
    const urls = collectSourceUrls(pack);
    expect(urls).toContain("https://mevzuat.gov.tr/fulltext?id=1");
    expect(urls).toContain("https://mevzuat.gov.tr/pdf?id=1");
  });

  it("should collect URLs from officialSearchResults in sourceTrace", () => {
    const pack = {
      relevantLegislation: [
        {
          sourceTrace: {
            officialSearchResults: [
              { landingUrl: "https://mevzuat.gov.tr/search/1", documentUrl: "https://mevzuat.gov.tr/doc/1" },
            ],
          },
        },
      ],
      verifiedHighCourtPrecedents: [],
    };
    const urls = collectSourceUrls(pack);
    expect(urls).toContain("https://mevzuat.gov.tr/search/1");
    expect(urls).toContain("https://mevzuat.gov.tr/doc/1");
  });

  it("should collect URLs from top-level sourceTrace array", () => {
    const pack = {
      relevantLegislation: [],
      verifiedHighCourtPrecedents: [],
      sourceTrace: [
        {
          landingUrl: "https://mevzuat.gov.tr/top-level/1",
          fullTextUrl: "https://mevzuat.gov.tr/top-level/fulltext/1",
        },
      ],
    };
    const urls = collectSourceUrls(pack);
    expect(urls).toContain("https://mevzuat.gov.tr/top-level/1");
    expect(urls).toContain("https://mevzuat.gov.tr/top-level/fulltext/1");
  });
});

// ─── checkSourceUrls ──────────────────────────────────────────────────────────

describe("checkSourceUrls", () => {
  it("should report reachable URLs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    const summary = await checkSourceUrls(
      ["https://mevzuat.gov.tr/test"],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.reachableCount).toBe(1);
    expect(summary.unreachableCount).toBe(0);
    expect(summary.checkedCount).toBe(1);
    expect(summary.results[0].statusCode).toBe(200);
  });

  it("should report unreachable URLs for non-ok responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    const summary = await checkSourceUrls(
      ["https://adalet.gov.tr/missing"],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.reachableCount).toBe(0);
    expect(summary.unreachableCount).toBe(1);
    expect(summary.results[0].statusCode).toBe(404);
  });

  it("should report unreachable for 500 errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    const summary = await checkSourceUrls(
      ["https://anayasa.gov.tr/server-error"],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.unreachableCount).toBe(1);
    expect(summary.results[0].statusCode).toBe(500);
  });

  it("should skip URLs when budget is exhausted", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200 }), 2000))
    );
    const summary = await checkSourceUrls(
      ["https://mevzuat.gov.tr/slow", "https://adalet.gov.tr/skipped"],
      { fetch: mockFetch, totalBudgetMs: 100, perUrlTimeoutMs: 1000 }
    );
    expect(summary.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it("should handle network errors", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const summary = await checkSourceUrls(
      ["https://yargitay.gov.tr/error"],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.unreachableCount).toBe(1);
    expect(summary.results[0].error).toBe("Network error");
  });

  it("should handle AbortError from timeout", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException("The operation was aborted.", "AbortError")), 50);
      });
    });
    const summary = await checkSourceUrls(
      ["https://danistay.gov.tr/timeout"],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 10 }
    );
    expect(summary.unreachableCount).toBe(1);
  });

  it("should process multiple URLs and report correct counts", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockRejectedValueOnce(new Error("Connection refused"));
    const summary = await checkSourceUrls(
      [
        "https://mevzuat.gov.tr/ok",
        "https://adalet.gov.tr/forbidden",
        "https://anayasa.gov.tr/refused",
      ],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.reachableCount).toBe(1);
    expect(summary.unreachableCount).toBe(2);
    expect(summary.checkedCount).toBe(3);
    expect(summary.results).toHaveLength(3);
  });

  it("should return checkedAt as ISO string", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const summary = await checkSourceUrls(
      ["https://mevzuat.gov.tr/test"],
      { fetch: mockFetch, totalBudgetMs: 5000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.results[0].checkedAt).toBeTruthy();
    expect(new Date(summary.results[0].checkedAt).toISOString()).toBe(summary.results[0].checkedAt);
  });

  it("should record totalBudgetMs and elapsedMs in summary", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const summary = await checkSourceUrls(
      ["https://mevzuat.gov.tr/test"],
      { fetch: mockFetch, totalBudgetMs: 3000, perUrlTimeoutMs: 1000 }
    );
    expect(summary.totalBudgetMs).toBe(3000);
    expect(summary.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty URL list", async () => {
    const mockFetch = vi.fn();
    const summary = await checkSourceUrls([], {
      fetch: mockFetch,
      totalBudgetMs: 5000,
      perUrlTimeoutMs: 1000,
    });
    expect(summary.checkedCount).toBe(0);
    expect(summary.reachableCount).toBe(0);
    expect(summary.unreachableCount).toBe(0);
    expect(summary.skippedCount).toBe(0);
    expect(summary.results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should combine results from collectSourceUrls and checkSourceUrls", async () => {
    // Integration-style test: collect then check
    const pack = {
      relevantLegislation: [
        {
          sourceTrace: {
            landingUrl: "https://mevzuat.gov.tr/landing?id=1",
          },
        },
      ],
      verifiedHighCourtPrecedents: [
        { sourceUrl: "https://mevzuat.adalet.gov.tr/ictihat/123" },
      ],
    };

    const urls = collectSourceUrls(pack);
    expect(urls.length).toBe(2);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const summary = await checkSourceUrls(urls, {
      fetch: mockFetch,
      totalBudgetMs: 5000,
      perUrlTimeoutMs: 1000,
    });
    expect(summary.reachableCount).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
