/**
 * Link health checker for source URLs in doktor packs.
 * Runs HEAD requests to verify URLs are still accessible.
 * Respects time budget — won't exceed remaining budget.
 *
 * Design principle: unreachable links get `linkStatus: "unreachable"` but
 * never block the pack. This is a best-effort diagnostic signal only.
 */

// ──────────────────────────────────────────────────────────────
// SSRF / URL allowlist
// ──────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = [
  "mevzuat.gov.tr", "resmigazete.gov.tr",
  "adalet.gov.tr", "anayasa.gov.tr",
  "danistay.gov.tr", "yargitay.gov.tr",
  "karararama.danistay.gov.tr", "kararlarbilgibankasi.anayasa.gov.tr",
  "bedesten.adalet.gov.tr"
];

export function isAllowedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith("." + h));
  } catch { return false; }
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface LinkHealthCheckResult {
  url: string;
  status: "reachable" | "unreachable" | "skipped";
  statusCode?: number;
  error?: string;
  checkedAt: string; // ISO date
}

export interface LinkHealthSummary {
  checkedCount: number;
  reachableCount: number;
  unreachableCount: number;
  skippedCount: number;
  results: LinkHealthCheckResult[];
  totalBudgetMs: number;
  elapsedMs: number;
}

// ──────────────────────────────────────────────────────────────
// URL collection from pack
// ──────────────────────────────────────────────────────────────

/**
 * Collect all source URLs from a doktor information pack.
 * Scans legislation (sourceTrace URLs) and precedents (sourceUrl).
 * Returns deduplicated list.
 */
export function collectSourceUrls(pack: any): string[] {
  const urls: string[] = [];

  // From legislation — check sourceTrace URL fields
  for (const prov of (pack.relevantLegislation ?? [])) {
    // Direct sourceUrl if present (may appear on some pack shapes)
    if (prov.sourceUrl && typeof prov.sourceUrl === "string") {
      urls.push(prov.sourceUrl);
    }

    // sourceTrace contains the actual URL fields for legislation
    const trace = prov.sourceTrace;
    if (trace && typeof trace === "object") {
      for (const field of ["landingUrl", "detailUrl", "fullTextUrl", "directPdfUrl", "generatedPdfUrl"]) {
        const val = trace[field];
        if (val && typeof val === "string") {
          urls.push(val);
        }
      }
      // officialSearchResults may contain landingUrls
      for (const sr of (trace.officialSearchResults ?? [])) {
        if (sr?.landingUrl && typeof sr.landingUrl === "string") urls.push(sr.landingUrl);
        if (sr?.documentUrl && typeof sr.documentUrl === "string") urls.push(sr.documentUrl);
      }
    }
  }

  // From precedents — sourceUrl on VerifiedPrecedentEntry
  for (const prec of (pack.verifiedHighCourtPrecedents ?? [])) {
    if (prec.sourceUrl && typeof prec.sourceUrl === "string") {
      urls.push(prec.sourceUrl);
    }
  }

  // From top-level sourceTrace array (if present)
  for (const trace of (pack.sourceTrace ?? [])) {
    if (trace && typeof trace === "object") {
      for (const field of ["landingUrl", "detailUrl", "fullTextUrl", "directPdfUrl", "generatedPdfUrl"]) {
        const val = trace[field];
        if (val && typeof val === "string") {
          urls.push(val);
        }
      }
    }
  }

  return [...new Set(urls)]; // deduplicate
}

// ──────────────────────────────────────────────────────────────
// Link health check
// ──────────────────────────────────────────────────────────────

/**
 * Check URLs for reachability within a time budget.
 * Uses HEAD requests (lightweight) with a short timeout per URL.
 */
export async function checkSourceUrls(
  urls: string[],
  options: {
    /** Total budget in ms for all checks */
    totalBudgetMs?: number;
    /** Timeout per individual check */
    perUrlTimeoutMs?: number;
    /** Signal for cancellation */
    signal?: AbortSignal;
    /** Fetch implementation (for testing) */
    fetch?: typeof globalThis.fetch;
  } = {}
): Promise<LinkHealthSummary> {
  const budget = options.totalBudgetMs ?? 5000;
  const timeout = options.perUrlTimeoutMs ?? 2000;
  const fetcher = options.fetch ?? globalThis.fetch;
  const startTime = Date.now();

  const results: LinkHealthCheckResult[] = [];

  for (const url of urls) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= budget) {
      // Skip remaining — budget exhausted
      results.push({ url, status: "skipped", checkedAt: new Date().toISOString() });
      continue;
    }

    // SSRF protection: skip URLs not on the allowlist
    if (!isAllowedUrl(url)) {
      results.push({ url, status: "skipped", checkedAt: new Date().toISOString() });
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeout, budget - elapsed));

    try {
      const response = await fetcher(url, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        results.push({
          url,
          status: "reachable",
          statusCode: response.status,
          checkedAt: new Date().toISOString(),
        });
      } else {
        results.push({
          url,
          status: "unreachable",
          statusCode: response.status,
          checkedAt: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      clearTimeout(timer);
      results.push({
        url,
        status: "unreachable",
        error: error?.message ?? String(error),
        checkedAt: new Date().toISOString(),
      });
    }
  }

  const summary: LinkHealthSummary = {
    checkedCount: results.filter((r) => r.status !== "skipped").length,
    reachableCount: results.filter((r) => r.status === "reachable").length,
    unreachableCount: results.filter((r) => r.status === "unreachable").length,
    skippedCount: results.filter((r) => r.status === "skipped").length,
    results,
    totalBudgetMs: budget,
    elapsedMs: Date.now() - startTime,
  };

  return summary;
}
