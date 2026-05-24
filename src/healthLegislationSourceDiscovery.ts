/**
 * Official Health Legislation Source Discovery & Lead Verification (v0.34.0)
 *
 * v0.33: Collects and classifies official source leads for gap/candidate
 *   inventory entries. Does NOT auto-verify.
 *
 * v0.34: Discovered leads can be routed to the existing verifier via
 *   verifyDiscoveredOfficialLeads(). Each lead is tested against the live
 *   official document. Verified leads are marked as promotable; no non-gov.tr
 *   source is accepted. No active coverage change happens automatically.
 *
 * Discovery strategies:
 *   A. mevzuat.gov.tr sourceId lead — from inventory candidateLegacySourceId
 *   B. Resmi Gazete metadata lead — from expectedRgDate/expectedRgNumber
 *   C. Sağlık Bakanlığı page lead — from candidateOfficialUrlLead
 *   D. Candidate title match — from search aliases / known good matches
 *
 * Verification flow:
 *   1. For entries with mevzuat_source_id leads → verifyBySourceIdDirect()
 *   2. For entries with only RG leads → search mevzuat.gov.tr by RG number,
 *      then verifyBySourceIdDirect() if a candidate sourceId is found
 *   3. Entries with no actionable leads → needs_manual_review
 *
 * Design rules (v0.34.0):
 * - gov.tr dışı kaynaklar verified veya strong lead sayılmaz.
 * - Lead found ≠ verified. Active coverage requires verifier approval.
 * - No risk levels, urgent actions, or definitive legal opinions.
 * - local-yargi NOT imported.
 */

import type { HealthLegislationInventoryEntry } from "./healthLegislationInventory.js";
import type { LegislationSearchAdapter } from "./healthLegislationAccessVerifier.js";
import { verifyBySourceIdDirect, scoreTitleMatch } from "./healthLegislationAccessVerifier.js";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type OfficialSourceLeadKind =
  | "mevzuat_source_id"
  | "mevzuat_pdf_url"
  | "resmi_gazete_url"
  | "saglik_gov_tr_page"
  | "candidate_title_match";

export type OfficialSourceLeadStatus =
  | "candidate_lead"
  | "verified_by_existing_verifier"
  | "rejected"
  | "needs_manual_review";

export type OfficialSourceLeadConfidence = "high" | "medium" | "low";

export interface OfficialSourceLead {
  entryKey: string;
  leadKind: OfficialSourceLeadKind;
  sourceId?: string;
  officialUrl?: string;
  domain: string;
  title?: string;
  rgDate?: string;
  rgNumber?: string;
  confidence: OfficialSourceLeadConfidence;
  status: OfficialSourceLeadStatus;
  reasons: string[];
}

export interface HealthLegislationSourceDiscoveryResult {
  entryKey: string;
  entryTitle: string;
  leads: OfficialSourceLead[];
  verifiedLead?: OfficialSourceLead;
  recommendedNextAction: string;
  ignoredNonOfficialLeads: OfficialSourceLead[];
}

export interface SourceDiscoveryReport {
  entriesScanned: number;
  leadsFound: number;
  officialLeadsFound: number;
  nonOfficialLeadsIgnored: number;
  leadsSentToVerifier: number;
  verifierVerifiedCount: number;
  verifierRejectedCount: number;
  needsManualReviewCount: number;
  entries: HealthLegislationSourceDiscoveryResult[];
  generatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Resmi Gazete URL builder
// ──────────────────────────────────────────────────────────────

function buildResmiGazeteUrl(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return "";
  return `https://www.resmigazete.gov.tr/eskiler/${year}/${month}/${year}${month}${day}.htm`;
}

// ──────────────────────────────────────────────────────────────
// Lead collectors
// ──────────────────────────────────────────────────────────────

function collectMevzuatSourceIdLead(
  entry: HealthLegislationInventoryEntry
): OfficialSourceLead | null {
  if (!entry.candidateLegacySourceId) return null;

  const parts = entry.candidateLegacySourceId.replace("mevzuat:", "").split(".");
  const pdfUrl =
    `https://www.mevzuat.gov.tr/mevzuatmetin/${parts[0]}.${parts[1]}.${parts[2]}.pdf`;

  return {
    entryKey: entry.key,
    leadKind: "mevzuat_source_id",
    sourceId: entry.candidateLegacySourceId,
    officialUrl: pdfUrl,
    domain: "mevzuat.gov.tr",
    title: entry.title,
    rgDate: entry.expectedRgDate,
    rgNumber: entry.expectedRgNumber,
    confidence: entry.candidateOfficialUrlLead ? "medium" : "low",
    status: "candidate_lead",
    reasons: [
      `Candidate sourceId from inventory: ${entry.candidateLegacySourceId}`,
      entry.candidateOfficialUrlLead
        ? `Candidate PDF URL also available: ${entry.candidateOfficialUrlLead}`
        : "No confirmed PDF URL — needs verification"
    ]
  };
}

function collectResmiGazeteLead(
  entry: HealthLegislationInventoryEntry
): OfficialSourceLead | null {
  if (!entry.expectedRgDate && !entry.expectedRgNumber) return null;

  const date = entry.expectedRgDate ?? "";
  const number = entry.expectedRgNumber ?? "";
  const rgUrl = date ? buildResmiGazeteUrl(date) : "";

  const reasons: string[] = [];
  if (date) reasons.push(`Expected RG date: ${date}`);
  if (number) reasons.push(`Expected RG number: ${number}`);
  if (rgUrl) reasons.push(`Resmi Gazete URL: ${rgUrl}`);
  reasons.push("Resmi Gazete lead is supporting only — not sufficient for active coverage");

  return {
    entryKey: entry.key,
    leadKind: "resmi_gazete_url",
    officialUrl: rgUrl || undefined,
    domain: "resmigazete.gov.tr",
    title: entry.title,
    rgDate: date || undefined,
    rgNumber: number || undefined,
    confidence: date && number ? "medium" : "low",
    status: "candidate_lead",
    reasons
  };
}

function collectSaglikGovTrLead(
  entry: HealthLegislationInventoryEntry
): OfficialSourceLead | null {
  if (!entry.candidateOfficialUrlLead) return null;

  const url = entry.candidateOfficialUrlLead;
  const isGovTr = url.includes("saglik.gov.tr") || url.includes(".gov.tr");

  const lead: OfficialSourceLead = {
    entryKey: entry.key,
    leadKind: "saglik_gov_tr_page",
    officialUrl: url,
    domain: isGovTr ? "saglik.gov.tr" : new URL(url).hostname,
    title: entry.title,
    confidence: "low",
    status: "candidate_lead",
    reasons: [
      `Candidate URL lead: ${url}`,
      "Sağlık Bakanlığı page lead requires verifier cross-check for active coverage"
    ]
  };

  if (!isGovTr) {
    lead.confidence = "low";
    lead.status = "needs_manual_review";
    lead.reasons.push("WARNING: URL is not on a .gov.tr domain — will NOT be accepted as verified");
  }

  return lead;
}

function collectCandidateTitleMatchLead(
  entry: HealthLegislationInventoryEntry
): OfficialSourceLead | null {
  const aliases = entry.aliases ?? [];
  if (aliases.length === 0 && !entry.searchTerms.length) return null;

  return {
    entryKey: entry.key,
    leadKind: "candidate_title_match",
    domain: "mevzuat.gov.tr",
    title: entry.title,
    confidence: aliases.length >= 2 ? "medium" : "low",
    status: "candidate_lead",
    reasons: [
      "Known search aliases and terms available for mevzuat.gov.tr search",
      ...aliases.slice(0, 3).map((a) => `Alias: "${a}"`),
      ...entry.searchTerms.slice(0, 3).map((t) => `Search term: "${t}"`),
      "Title-based search lead — needs sourceId confirmation via verifier"
    ]
  };
}

// ──────────────────────────────────────────────────────────────
// Per-entry discovery
// ──────────────────────────────────────────────────────────────

function buildRecommendedNextAction(
  entry: HealthLegislationInventoryEntry,
  sourceIdLead: OfficialSourceLead | null
): string {
  if (sourceIdLead && sourceIdLead.confidence === "high") {
    return `High-confidence sourceId lead available (${sourceIdLead.sourceId}). Run verify:health-legislation to confirm.`;
  }
  if (sourceIdLead) {
    return `Medium/low confidence sourceId lead (${sourceIdLead.sourceId}). Fetch PDF manually at ${sourceIdLead.officialUrl} to confirm title.`;
  }

  const missing: string[] = [];
  if (!entry.candidateLegacySourceId) missing.push("sourceId");
  if (!entry.expectedRgNumber) missing.push("RG number");

  if (missing.length > 0) {
    return `Missing: ${missing.join(", ")}. Manual mevzuat.gov.tr search needed using entry title or RG metadata.`;
  }

  return "Manual mevzuat.gov.tr search needed to discover correct sourceId.";
}

/**
 * Discover official source leads for a single inventory entry.
 * Collects all available leads but does NOT auto-verify.
 */
export function discoverEntrySources(
  entry: HealthLegislationInventoryEntry
): HealthLegislationSourceDiscoveryResult {
  const leads: OfficialSourceLead[] = [];
  const ignoredNonOfficialLeads: OfficialSourceLead[] = [];

  // Strategy A: mevzuat sourceId lead
  const sourceIdLead = collectMevzuatSourceIdLead(entry);
  if (sourceIdLead) {
    leads.push(sourceIdLead);
  }

  // Strategy B: Resmi Gazete lead
  const rgLead = collectResmiGazeteLead(entry);
  if (rgLead) {
    leads.push(rgLead);
  }

  // Strategy C: Sağlık Bakanlığı page lead
  const saglikLead = collectSaglikGovTrLead(entry);
  if (saglikLead) {
    if (saglikLead.domain.includes("gov.tr")) {
      leads.push(saglikLead);
    } else {
      ignoredNonOfficialLeads.push(saglikLead);
    }
  }

  // Strategy D: Candidate title match
  const titleLead = collectCandidateTitleMatchLead(entry);
  if (titleLead) {
    leads.push(titleLead);
  }

  const recommendedNextAction = buildRecommendedNextAction(entry, sourceIdLead);

  return {
    entryKey: entry.key,
    entryTitle: entry.title,
    leads,
    recommendedNextAction,
    ignoredNonOfficialLeads
  };
}

// ──────────────────────────────────────────────────────────────
// Report builder
// ──────────────────────────────────────────────────────────────

/**
 * Discover official source leads for multiple inventory entries.
 * Returns a structured report with lead classification and
 * recommended next actions.
 */
export function buildSourceDiscoveryReport(
  entries: HealthLegislationInventoryEntry[]
): SourceDiscoveryReport {
  const results = entries.map(discoverEntrySources);

  let totalLeads = 0;
  let officialLeads = 0;
  let nonOfficialIgnored = 0;

  for (const r of results) {
    totalLeads += r.leads.length;
    officialLeads += r.leads.filter((l) => l.domain.endsWith(".gov.tr")).length;
    nonOfficialIgnored += r.ignoredNonOfficialLeads.length;
  }

  const needsManualReview = results.filter(
    (r) => r.leads.length === 0 || r.leads.every((l) => l.confidence === "low")
  ).length;

  return {
    entriesScanned: entries.length,
    leadsFound: totalLeads,
    officialLeadsFound: officialLeads,
    nonOfficialLeadsIgnored: nonOfficialIgnored,
    leadsSentToVerifier: results.filter((r) =>
      r.leads.some((l) => l.leadKind === "mevzuat_source_id")
    ).length,
    verifierVerifiedCount: 0,
    verifierRejectedCount: 0,
    needsManualReviewCount: needsManualReview,
    entries: results,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Filter inventory entries that are gap or candidate (not yet verified).
 */
export function filterDiscoveryCandidates(
  entries: HealthLegislationInventoryEntry[]
): HealthLegislationInventoryEntry[] {
  return entries.filter(
    (e) =>
      e.coverageStatus === "gap" ||
      e.coverageStatus === "candidate"
  );
}

// ──────────────────────────────────────────────────────────────
// Lead verification bridge (v0.34.0)
// ──────────────────────────────────────────────────────────────

export interface DiscoveredLeadVerificationResult {
  entryKey: string;
  leadKind: OfficialSourceLeadKind | "rg_search_discovery";
  sourceId?: string;
  officialUrl?: string;
  rgNumber?: string;
  verificationStatus: "verified" | "not_verified" | "needs_manual_review" | "unverifiable";
  verifierStatus?: string;
  titleScore?: number;
  markerScore?: number;
  rgScore?: number;
  rejectReason?: string;
  promotedToActiveCoverage: boolean;
}

export interface LeadVerificationReport {
  leadsAttempted: number;
  leadsVerified: number;
  leadsRejected: number;
  needsManualReviewCount: number;
  promotedToActiveCoverageCount: number;
  results: DiscoveredLeadVerificationResult[];
  generatedAt: string;
}

/**
 * Verify discovered official source leads by routing them through the existing
 * direct sourceId verifier.
 *
 * Flow:
 * 1. mevzuat_source_id leads → verifyBySourceIdDirect() on the inventory entry
 * 2. RG-only leads → search mevzuat.gov.tr by RG number, then verify if found
 * 3. No actionable leads → needs_manual_review
 *
 * Lead found ≠ verified. Only entries that pass the existing verifier criteria
 * (title/alias score, marker overlap, gov.tr source, no known wrong match)
 * are marked as verified.
 */
export async function verifyDiscoveredOfficialLeads(
  discoveryReport: SourceDiscoveryReport,
  entries: HealthLegislationInventoryEntry[],
  adapter: LegislationSearchAdapter
): Promise<LeadVerificationReport> {
  const results: DiscoveredLeadVerificationResult[] = [];
  let verified = 0;
  let rejected = 0;
  let needsReview = 0;

  for (const entryResult of discoveryReport.entries) {
    const entry = entries.find((e) => e.key === entryResult.entryKey);
    if (!entry) {
      results.push({
        entryKey: entryResult.entryKey,
        leadKind: "candidate_title_match",
        verificationStatus: "needs_manual_review",
        promotedToActiveCoverage: false,
        rejectReason: "Entry not found in inventory"
      });
      needsReview++;
      continue;
    }

    // Strategy A: mevzuat_source_id lead → direct verification
    const sourceIdLead = entryResult.leads.find(
      (l) => l.leadKind === "mevzuat_source_id"
    );

    if (sourceIdLead && sourceIdLead.sourceId) {
      // Create a scoped copy with the discovered sourceId
      const scopedEntry: HealthLegislationInventoryEntry = {
        ...entry,
        candidateLegacySourceId: sourceIdLead.sourceId,
        officialSourceStatus: "candidate"
      };

      const verifierResult = await verifyBySourceIdDirect(scopedEntry, adapter);

      if (verifierResult && verifierResult.status === "verified_via_source_id_direct") {
        verified++;
        results.push({
          entryKey: entry.key,
          leadKind: "mevzuat_source_id",
          sourceId: sourceIdLead.sourceId,
          officialUrl: sourceIdLead.officialUrl,
          verificationStatus: "verified",
          verifierStatus: verifierResult.status,
          titleScore: verifierResult.titleScore,
          markerScore: verifierResult.markerScore,
          rgScore: verifierResult.rgScore,
          promotedToActiveCoverage: true,
          rejectReason: undefined
        });
        continue;
      }

      if (verifierResult && verifierResult.status !== "verified_via_source_id_direct") {
        rejected++;
        results.push({
          entryKey: entry.key,
          leadKind: "mevzuat_source_id",
          sourceId: sourceIdLead.sourceId,
          officialUrl: sourceIdLead.officialUrl,
          verificationStatus: "not_verified",
          verifierStatus: verifierResult.status,
          titleScore: verifierResult.titleScore,
          markerScore: verifierResult.markerScore,
          rgScore: verifierResult.rgScore,
          promotedToActiveCoverage: false,
          rejectReason: verifierResult.rejectReason ?? `Verifier rejected: ${verifierResult.status}`
        });
        continue;
      }

      // verifyBySourceIdDirect returned null (no fetchOfficialDocument)
      rejected++;
      results.push({
        entryKey: entry.key,
        leadKind: "mevzuat_source_id",
        sourceId: sourceIdLead.sourceId,
        verificationStatus: "unverifiable",
        promotedToActiveCoverage: false,
        rejectReason: "Adapter missing fetchOfficialDocument"
      });
      continue;
    }

    // Strategy B: RG-only lead → search by RG number, then try verification
    const rgLead = entryResult.leads.find(
      (l) => l.leadKind === "resmi_gazete_url" && l.rgNumber
    );

    if (rgLead && rgLead.rgNumber && adapter.searchOfficialLegislation) {
      const rgQuery = rgLead.rgNumber;
      const searchResults = await adapter.searchOfficialLegislation(rgQuery);

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        // Find the best match by title similarity
        const bestResult = searchResults
          .map((r) => ({
            result: r,
            score: scoreTitleMatch(entry.title, r.title)
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (bestResult && bestResult.score >= 0.40) {
          const discoveredSourceId = bestResult.result.sourceId;
          const scopedEntry: HealthLegislationInventoryEntry = {
            ...entry,
            candidateLegacySourceId: discoveredSourceId,
            officialSourceStatus: "candidate"
          };

          const verifierResult = await verifyBySourceIdDirect(scopedEntry, adapter);

          if (verifierResult && verifierResult.status === "verified_via_source_id_direct") {
            verified++;
            results.push({
              entryKey: entry.key,
              leadKind: "rg_search_discovery",
              sourceId: discoveredSourceId,
              officialUrl: bestResult.result.documentUrl,
              verificationStatus: "verified",
              verifierStatus: verifierResult.status,
              titleScore: verifierResult.titleScore,
              markerScore: verifierResult.markerScore,
              rgScore: verifierResult.rgScore,
              promotedToActiveCoverage: true,
              rejectReason: undefined
            });
            continue;
          }

          rejected++;
          results.push({
            entryKey: entry.key,
            leadKind: "rg_search_discovery",
            sourceId: discoveredSourceId,
            verificationStatus: "not_verified",
            verifierStatus: verifierResult?.status,
            titleScore: verifierResult?.titleScore,
            markerScore: verifierResult?.markerScore,
            promotedToActiveCoverage: false,
            rejectReason: verifierResult?.rejectReason ?? "Verifier rejected RG-discovered sourceId"
          });
          continue;
        }
      }

      // RG search found no good match
      needsReview++;
      results.push({
        entryKey: entry.key,
        leadKind: "resmi_gazete_url",
        rgNumber: rgLead.rgNumber,
        verificationStatus: "needs_manual_review",
        promotedToActiveCoverage: false,
        rejectReason: `RG number ${rgLead.rgNumber} search failed or no matching title found. Manual sourceId discovery needed.`
      });
      continue;
    }

    // No actionable lead
    needsReview++;
    results.push({
      entryKey: entry.key,
      leadKind: "candidate_title_match",
      verificationStatus: "needs_manual_review",
      promotedToActiveCoverage: false,
      rejectReason: "No sourceId or RG lead available for automatic verification."
    });
  }

  const totalAttempted = results.filter(
    (r) => r.verificationStatus === "verified" || r.verificationStatus === "not_verified"
  ).length;

  return {
    leadsAttempted: totalAttempted,
    leadsVerified: verified,
    leadsRejected: rejected,
    needsManualReviewCount: needsReview,
    promotedToActiveCoverageCount: verified,
    results,
    generatedAt: new Date().toISOString()
  };
}
