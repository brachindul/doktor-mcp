/**
 * Official Gazette Document Verifier (v0.36.0)
 *
 * Verifies Resmî Gazete documents for RG-only health legislation leads
 * (entries with expectedRgNumber but no confirmed mevzuat.gov.tr sourceId).
 *
 * This is a SEPARATE verification path from mevzuat.gov.tr sourceId verification.
 * Design rules:
 * - RG verified + confirmed mevzuat sourceId = eligible for active coverage.
 * - RG verified alone (no sourceId) = reported as rg_verified_no_sourceId, NOT promoted.
 * - gov.tr dışı kaynaklar verified kabul edilmez.
 * - No risk levels, urgent actions, or definitive legal opinions.
 * - local-yargi NOT imported.
 * - Hekim-facing output contract değiştirilmez.
 */

import type { HealthLegislationInventoryEntry } from "./healthLegislationInventory.js";
import { scoreTitleMatch } from "./healthLegislationAccessVerifier.js";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type RgDocumentVerificationStatus =
  | "rg_verified"
  | "rg_not_found"
  | "rg_wrong_document"
  | "rg_unavailable"
  | "rg_verification_error";

export interface RgDocumentVerificationResult {
  entryKey: string;
  entryTitle: string;
  expectedRgNumber: string;
  expectedRgDate?: string;
  rgUrl: string;
  status: RgDocumentVerificationStatus;
  titleScore: number;
  markerScore: number;
  fetchedTitle?: string;
  errorMessage?: string;
}

export interface RgDocumentVerificationReport {
  entriesScanned: number;
  rgEntriesProcessed: number;
  rgVerifiedCount: number;
  rgVerifiedNoSourceIdCount: number;
  rgNotFoundCount: number;
  rgWrongDocumentCount: number;
  rgUnavailableCount: number;
  rgErrorCount: number;
  entries: RgDocumentVerificationResult[];
  generatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Adapter interface
// ──────────────────────────────────────────────────────────────

export interface RgDocumentFetcher {
  fetchRgPage(url: string): Promise<{
    title: string;
    content: string;
    statusCode: number;
  } | null>;
}

// ──────────────────────────────────────────────────────────────
// RG URL builder
// ──────────────────────────────────────────────────────────────

export function buildRgUrl(date?: string, number?: string): string {
  if (date) {
    const [year, month, day] = date.split("-");
    if (year && month && day) {
      return `https://www.resmigazete.gov.tr/eskiler/${year}/${month}/${year}${month}${day}.htm`;
    }
  }
  if (number) {
    return `https://www.resmigazete.gov.tr/eskiler/${number}.htm`;
  }
  return "";
}

// ──────────────────────────────────────────────────────────────
// Entry filtering
// ──────────────────────────────────────────────────────────────

export function filterRgOnlyLeads(
  entries: HealthLegislationInventoryEntry[]
): HealthLegislationInventoryEntry[] {
  return entries.filter(
    (e) =>
      e.expectedRgNumber &&
      !e.mevzuatSourceId &&
      e.officialSourceStatus !== "verified" &&
      e.officialSourceStatus !== "deferred" &&
      e.coverageStatus !== "deferred"
  );
}

// ──────────────────────────────────────────────────────────────
// Title scoring
// ──────────────────────────────────────────────────────────────

function extractHtmlTitle(html: string): string {
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = /<h1[^>]*>([^<]*)<\/h1>/i.exec(html);
  if (h1Match) return h1Match[1].trim();
  return "";
}

/**
 * Count how many marker terms appear in the content.
 * Returns a score 0-1 (proportion of terms found).
 */
function computeMarkerScore(content: string, markerTerms: string[]): number {
  if (!markerTerms || markerTerms.length === 0) return 0;
  const contentLower = content.toLocaleLowerCase("tr-TR");
  let found = 0;
  for (const term of markerTerms) {
    const termLower = term.toLocaleLowerCase("tr-TR");
    if (contentLower.includes(termLower)) found++;
  }
  return found / markerTerms.length;
}

// ──────────────────────────────────────────────────────────────
// Verifier
// ──────────────────────────────────────────────────────────────

export async function verifyRgDocument(
  entry: HealthLegislationInventoryEntry,
  fetcher: RgDocumentFetcher
): Promise<RgDocumentVerificationResult> {
  const rgNumber = entry.expectedRgNumber ?? "";
  const rgDate = entry.expectedRgDate;
  const rgUrl = buildRgUrl(rgDate, rgNumber);

  const base = {
    entryKey: entry.key,
    entryTitle: entry.title,
    expectedRgNumber: rgNumber,
    expectedRgDate: rgDate,
    rgUrl
  };

  if (!rgUrl) {
    return {
      ...base,
      status: "rg_verification_error",
      titleScore: 0,
      markerScore: 0,
      errorMessage: "Could not construct RG URL — no date or RG number available."
    };
  }

  let page: NonNullable<Awaited<ReturnType<RgDocumentFetcher["fetchRgPage"]>>>;
  try {
    const result = await fetcher.fetchRgPage(rgUrl);
    if (!result) {
      return {
        ...base,
        status: "rg_unavailable",
        titleScore: 0,
        markerScore: 0,
        errorMessage: "RG page fetch returned null (network error or unavailable)."
      };
    }
    page = result;
  } catch (err) {
    return {
      ...base,
      status: "rg_verification_error",
      titleScore: 0,
      markerScore: 0,
      errorMessage: `RG page fetch threw: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  if (page.statusCode >= 400) {
    return {
      ...base,
      status: "rg_not_found",
      titleScore: 0,
      markerScore: 0,
      fetchedTitle: page.title,
      errorMessage: `RG page returned HTTP ${page.statusCode}.`
    };
  }

  const fetchedTitle = extractHtmlTitle(page.content) || page.title;
  const titleScore = scoreTitleMatch(entry.title, fetchedTitle);
  const markerScore = computeMarkerScore(page.content, entry.markerTerms ?? []);

  if (titleScore < 0.50) {
    return {
      ...base,
      status: "rg_wrong_document",
      titleScore,
      markerScore,
      fetchedTitle,
      errorMessage: `Title score ${titleScore.toFixed(3)} < 0.50 — content does not match expected title.`
    };
  }

  if (markerScore === 0 && (entry.markerTerms ?? []).length > 0) {
    return {
      ...base,
      status: "rg_wrong_document",
      titleScore,
      markerScore,
      fetchedTitle,
      errorMessage: "No marker terms found in RG document content."
    };
  }

  return {
    ...base,
    status: "rg_verified",
    titleScore,
    markerScore,
    fetchedTitle
  };
}

// ──────────────────────────────────────────────────────────────
// Report builder
// ──────────────────────────────────────────────────────────────

export async function buildRgDocumentVerificationReport(
  entries: HealthLegislationInventoryEntry[],
  fetcher: RgDocumentFetcher
): Promise<RgDocumentVerificationReport> {
  const rgEntries = filterRgOnlyLeads(entries);
  const results: RgDocumentVerificationResult[] = [];

  let rgVerifiedCount = 0;
  let rgVerifiedNoSourceIdCount = 0;
  let rgNotFoundCount = 0;
  let rgWrongDocumentCount = 0;
  let rgUnavailableCount = 0;
  let rgErrorCount = 0;

  for (const entry of rgEntries) {
    const result = await verifyRgDocument(entry, fetcher);
    results.push(result);

    switch (result.status) {
      case "rg_verified":
        rgVerifiedCount++;
        if (!entry.mevzuatSourceId) rgVerifiedNoSourceIdCount++;
        break;
      case "rg_not_found":
        rgNotFoundCount++;
        break;
      case "rg_wrong_document":
        rgWrongDocumentCount++;
        break;
      case "rg_unavailable":
        rgUnavailableCount++;
        break;
      case "rg_verification_error":
        rgErrorCount++;
        break;
    }
  }

  return {
    entriesScanned: entries.length,
    rgEntriesProcessed: rgEntries.length,
    rgVerifiedCount,
    rgVerifiedNoSourceIdCount,
    rgNotFoundCount,
    rgWrongDocumentCount,
    rgUnavailableCount,
    rgErrorCount,
    entries: results,
    generatedAt: new Date().toISOString()
  };
}
