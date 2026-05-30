/**
 * Precedent phase executor (extracted from service.ts — T0.4)
 *
 * Orchestrates precedent search across multiple sources (live or mock),
 * deduplicates decisions, collects per-query telemetry, and returns
 * combined results.
 */
import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  LegislationSourceMode,
  PrecedentSource,
  PrecedentSourceResult
} from "../contracts/legal.js";
import type { QueryAttemptTelemetry } from "../contracts/queryTelemetry.js";
import { filterReasonedPrecedents } from "../health/precedentFilter.js";
import { inferIssueProfileFromQuestion } from "../health/precedentRelevance.js";
import { rankedQueriesForSource } from "../health/queryRanking.js";
import type { IssueProfile } from "../health/precedentRelevance.js";
import type { PrecedentSourceAdapter } from "../sources/types.js";
import type { LiveYargitayAdapter } from "../sources/yargitay/liveYargitayAdapter.js";
import type { LiveDanistayAdapter } from "../sources/danistay/liveDanistayAdapter.js";
import type { LiveBedestenAdapter } from "../sources/bedesten/liveBedestenAdapter.js";

/** Maximum number of query attempts per source in live mode. */
const MAX_QUERIES_PER_SOURCE = 2;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PrecedentAdapters {
  liveYargitay: LiveYargitayAdapter;
  liveDanistay: LiveDanistayAdapter;
  liveBedesten: LiveBedestenAdapter;
  mockAdapters: PrecedentSourceAdapter[];
}

export interface SearchPrecedentsParams {
  classification: ClassifiedMedicalLegalQuestion;
  sourceMode: LegislationSourceMode;
  precedentSources?: PrecedentSource[];
  adapters: PrecedentAdapters;
}

// ─── Helpers (moved from service.ts) ────────────────────────────────────────

/**
 * Prioritize sources based on issue profile.
 * - disciplinary/administrative issues: danistay-first
 * - privacy/kvkk issues: yargitay-first (civil/criminal emphasis)
 * - default: yargitay-first
 */
export function prioritizeSourcesByIssue(
  issueProfile: string,
  sources: PrecedentSource[]
): PrecedentSource[] {
  const danistayFirst = ["disciplinary_administrative", "administrative_liability"];
  if (danistayFirst.some((issue) => issueProfile.includes(issue))) {
    return [...sources].sort((a, b) => {
      if (a === "danistay") return -1;
      if (b === "danistay") return 1;
      return 0;
    });
  }
  // Default: yargitay-first
  return [...sources].sort((a, b) => {
    if (a === "yargitay") return -1;
    if (b === "yargitay") return 1;
    return 0;
  });
}

// ─── Search executor ────────────────────────────────────────────────────────

export interface SearchPrecedentsResult {
  decisions: CourtDecision[];
  sourceResults: PrecedentSourceResult[];
  queryTelemetry: QueryAttemptTelemetry[];
}

/**
 * Search precedents across multiple sources, deduplicate, and collect telemetry.
 */
export async function searchPrecedents(
  params: SearchPrecedentsParams
): Promise<SearchPrecedentsResult> {
  const { classification, sourceMode, precedentSources, adapters } = params;

  if (sourceMode === "live") {
    const sources: PrecedentSource[] = precedentSources ?? ["yargitay", "danistay"];
    const sourceResults: PrecedentSourceResult[] = [];
    const allTelemetry: QueryAttemptTelemetry[] = [];
    const issueProfile = inferIssueProfileFromQuestion(classification.question);

    await Promise.all(sources.map(async (src) => {
      if (src === "aym") {
        sourceResults.push({
          source: "aym",
          mode: "disabled",
          decisions: [],
          searchResultsCount: null,
          unavailable: true,
          errorCodes: ["live_not_supported"]
        });
        return;
      }

      const rankedQueries = rankedQueriesForSource(
        issueProfile as IssueProfile,
        src,
        classification,
        MAX_QUERIES_PER_SOURCE
      );

      const seenIds = new Set<string>();
      const allDecisions: CourtDecision[] = [];
      let totalResultCount = 0;
      let sourceAvailable = true;
      const sourceErrorCodes: string[] = [];

      for (const rq of rankedQueries) {
        const startedAt = new Date().toISOString();
        const t0 = Date.now();
        let resultCount = 0;
        let candidateCount = 0;
        let usableCandidateCount = 0;
        let success = false;
        let isUnavailable = false;
        let errorCode: string | undefined;
        let decisions: CourtDecision[] = [];

        try {
          if (src === "yargitay") {
            const result = await adapters.liveYargitay.searchAndNormalize(rq.queryText);
            if (result.status === "ok") {
              decisions = result.decisions;
              resultCount = result.searchResultsCount;
              success = resultCount > 0;
            } else {
              isUnavailable = true;
              errorCode = result.errorCode;
              sourceAvailable = false;
              sourceErrorCodes.push(result.errorCode);
            }
          } else if (src === "danistay") {
            const result = await adapters.liveDanistay.searchAndNormalize(rq.queryText);
            if (result.status === "ok") {
              decisions = result.decisions;
              resultCount = result.searchResultsCount;
              success = resultCount > 0;
            } else {
              isUnavailable = true;
              errorCode = result.errorCode;
              sourceAvailable = false;
              sourceErrorCodes.push(result.errorCode);
            }
          } else if (src === "bedesten") {
            try {
              decisions = await adapters.liveBedesten.searchHealthPrecedents(classification);
              resultCount = decisions.length;
              success = resultCount > 0;
            } catch (_err) {
              isUnavailable = true;
              errorCode = "source_error";
              sourceAvailable = false;
              sourceErrorCodes.push("source_error");
            }
          }
        } catch {
          isUnavailable = true;
          errorCode = "source_error";
          sourceAvailable = false;
          sourceErrorCodes.push("source_error");
        }

        const durationMs = Date.now() - t0;

        // Read adapter-level request telemetry (cache hit/miss, retry counts)
        const adapterT = src === "yargitay"
          ? adapters.liveYargitay.lastRequestTelemetry
          : src === "danistay"
            ? adapters.liveDanistay.lastRequestTelemetry
            : null;

        // Deduplicate and assess candidates
        const newDecisions = decisions.filter((d) => !seenIds.has(d.id));
        for (const d of newDecisions) seenIds.add(d.id);
        allDecisions.push(...newDecisions);

        const filtered = filterReasonedPrecedents(newDecisions);
        candidateCount = filtered.length;
        usableCandidateCount = filtered.filter((e) => e.status === "precedent_usable").length;
        totalResultCount += resultCount;

        allTelemetry.push({
          source: src,
          issueProfile,
          queryText: rq.queryText,
          queryType: rq.queryType,
          queryRank: rq.rank,
          startedAt,
          durationMs,
          success,
          resultCount,
          candidateCount,
          usableCandidateCount,
          sourceUnavailable: isUnavailable,
          ...(errorCode ? { errorCode } : {}),
          // Cache & HTTP retry telemetry
          cacheHit: adapterT?.cacheHit ?? false,
          cacheMiss: adapterT?.cacheMiss ?? false,
          servedFromCache: adapterT?.servedFromCache ?? false,
          networkRequestMade: adapterT?.networkRequestMade ?? true,
          cacheAgeMs: adapterT?.cacheAgeMs ?? null,
          retryCount: adapterT?.retryCount ?? 0,
          backoffMs: adapterT?.backoffMs ?? 0,
          retryAfterMs: adapterT?.retryAfterMs ?? null,
          timedOut: adapterT?.timedOut ?? false
        });

        // Only try fallback query if first query returned 0 results (and source not unavailable)
        if (rq.rank === 1 && (resultCount > 0 || isUnavailable)) break;
      }

      sourceResults.push({
        source: src,
        mode: "live",
        decisions: allDecisions,
        searchResultsCount: totalResultCount,
        unavailable: !sourceAvailable,
        errorCodes: sourceErrorCodes
      });
    }));

    return {
      decisions: sourceResults.flatMap((sr) => sr.decisions),
      sourceResults,
      queryTelemetry: allTelemetry
    };
  }

  // Mock mode: no telemetry, standard behavior
  const results = await Promise.all(
    adapters.mockAdapters.map((adapter) => adapter.searchHealthPrecedents(classification))
  );
  const decisions = results.flat();
  const sourceResults: PrecedentSourceResult[] = [
    { source: "yargitay", mode: "mock", decisions: results[0] ?? [], searchResultsCount: (results[0] ?? []).length, unavailable: false, errorCodes: [] },
    { source: "danistay", mode: "mock", decisions: results[1] ?? [], searchResultsCount: (results[1] ?? []).length, unavailable: false, errorCodes: [] },
    { source: "aym", mode: "mock", decisions: results[2] ?? [], searchResultsCount: (results[2] ?? []).length, unavailable: false, errorCodes: [] }
  ];
  return { decisions, sourceResults, queryTelemetry: [] };
}
