/**
 * Live Reliability Gate (v0.26.0)
 *
 * Pure utility — accepts a flat `ReliabilityGateInput` struct so it has
 * no circular dependency on benchmarkRunner.ts or any adapter.
 *
 * Hard failures (gatePassed = false):
 *   1. mockFallbackDetected — live query silently fell back to mock data
 *   2. contractFailedCount > 0 — hard contract violation (invalid pack shape)
 *   3. contractUnofficialSourceCount > 0 — unofficial source used in output
 *   4. ineligibleUsedCount > 0 — metadata_only/procedural_only/no_reasoning decision in verified list
 *
 * Soft observations (gatePassed stays true, listed in gateObservations):
 *   - timeoutCount > 0
 *   - rateLimitCount > 0
 *   - insufficientCount > 0 (sufficiency < threshold in any query)
 */

export interface SourceSufficiencyRecord {
  query: string;
  precedentCount: number;
  legislationCount: number;
  sufficient: boolean;
}

export interface ReliabilityGateInput {
  totalLiveQuestions: number;
  livePassedCount: number;
  liveFailedCount: number;
  mockFallbackDetected: boolean;
  contractFailedCount: number;
  contractUnofficialSourceCount: number;
  ineligibleUsedCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  sourceUnavailableCount: number;
  transientFailureCount: number;
  totalRetries: number;
  totalBackoffMs: number;
  cacheHitCount: number;
  cacheMissCount: number;
  networkRequestMadeCount: number;
  verifiedPrecedentCount: number;
  sourceSufficiencyDistribution: SourceSufficiencyRecord[];
  /** Decisions where quoteUsable=false leaked into verifiedHighCourtPrecedents (v0.27.0). */
  quoteUnusableInVerifiedCount: number;
}

export interface LiveReliabilityGate {
  totalLiveQuestions: number;
  livePassedCount: number;
  liveFailedCount: number;
  mockFallbackDetected: boolean;
  timeoutCount: number;
  rateLimitCount: number;
  sourceUnavailableCount: number;
  transientFailureCount: number;
  totalRetries: number;
  totalBackoffMs: number;
  cacheHitCount: number;
  cacheMissCount: number;
  networkRequestMadeCount: number;
  verifiedPrecedentCount: number;
  sourceSufficiencyDistribution: SourceSufficiencyRecord[];
  /** Decisions where quoteUsable=false leaked into verifiedHighCourtPrecedents (v0.27.0). */
  quoteUnusableInVerifiedCount: number;
  gatePassed: boolean;
  gateFailures: string[];
  gateObservations: string[];
}

export function buildLiveReliabilityGate(input: ReliabilityGateInput): LiveReliabilityGate {
  const gateFailures: string[] = [];
  const gateObservations: string[] = [];

  // Hard failures
  if (input.mockFallbackDetected) {
    gateFailures.push("MOCK_FALLBACK: Live query fell back to mock data — source adapter is not using live mode.");
  }
  if (input.contractFailedCount > 0) {
    gateFailures.push(`CONTRACT_FAIL: ${input.contractFailedCount} query/queries produced an invalid information pack shape.`);
  }
  if (input.contractUnofficialSourceCount > 0) {
    gateFailures.push(`UNOFFICIAL_SOURCE: ${input.contractUnofficialSourceCount} query/queries included unofficial source evidence in output.`);
  }
  if (input.ineligibleUsedCount > 0) {
    gateFailures.push(`INELIGIBLE_PRECEDENT: ${input.ineligibleUsedCount} ineligible decision(s) (metadata_only / procedural_only / no_reasoning) appeared in verifiedHighCourtPrecedents.`);
  }
  if (input.quoteUnusableInVerifiedCount > 0) {
    gateFailures.push(`QUOTE_UNUSABLE_VERIFIED: ${input.quoteUnusableInVerifiedCount} decision(s) with quoteUsable=false appeared in verifiedHighCourtPrecedents.`);
  }

  // Soft observations
  if (input.timeoutCount > 0) {
    gateObservations.push(`TIMEOUT: ${input.timeoutCount} request(s) timed out across all queries.`);
  }
  if (input.rateLimitCount > 0) {
    gateObservations.push(`RATE_LIMIT: ${input.rateLimitCount} request(s) hit rate limiting (HTTP 429).`);
  }
  const insufficientCount = input.sourceSufficiencyDistribution.filter((r) => !r.sufficient).length;
  if (insufficientCount > 0) {
    gateObservations.push(`INSUFFICIENT_SUFFICIENCY: ${insufficientCount} of ${input.sourceSufficiencyDistribution.length} queries returned fewer verified precedents than expected.`);
  }

  return {
    totalLiveQuestions: input.totalLiveQuestions,
    livePassedCount: input.livePassedCount,
    liveFailedCount: input.liveFailedCount,
    mockFallbackDetected: input.mockFallbackDetected,
    timeoutCount: input.timeoutCount,
    rateLimitCount: input.rateLimitCount,
    sourceUnavailableCount: input.sourceUnavailableCount,
    transientFailureCount: input.transientFailureCount,
    totalRetries: input.totalRetries,
    totalBackoffMs: input.totalBackoffMs,
    cacheHitCount: input.cacheHitCount,
    cacheMissCount: input.cacheMissCount,
    networkRequestMadeCount: input.networkRequestMadeCount,
    verifiedPrecedentCount: input.verifiedPrecedentCount,
    sourceSufficiencyDistribution: input.sourceSufficiencyDistribution,
    quoteUnusableInVerifiedCount: input.quoteUnusableInVerifiedCount,
    gatePassed: gateFailures.length === 0,
    gateFailures,
    gateObservations
  };
}
