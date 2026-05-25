import type { BenchmarkReport } from "./benchmark/benchmarkRunner.js";

export interface BetaReadinessReport {
  betaReadinessScore: number; // 0 to 100
  betaReadinessLevel: "ready" | "limited" | "not_ready";
  gatePassed: boolean;
  failures: string[];
  observations: string[];
  metrics: {
    totalQuestions: number;
    packGeneratedCount: number;
    packNotGeneratedCount: number;
    sourceSufficiencyDistribution: Record<string, number>;
    contractPassedCount: number;
    contractFailedCount: number;
    unsafeAdviceDetectedCount: number;
    unofficialSourceDetectedCount: number;
    missingLegislationFieldCount: number;
    missingPrecedentFieldCount: number;
    verifiedPrecedentCount: number;
    uniqueLegislationUsedCount: number;
    issueCoverageDistribution: Record<string, number>;
    lowConfidenceRouteCount: number;
    timeoutQuestionCount: number;
    cannotComposeResearchPackCount: number;
    averageLegislationPerPack: number;
    averageVerifiedPrecedentPerPack: number;
    timeoutQuestionIds: string[];
  };
}

export function evaluateBetaReadiness(report: BenchmarkReport): BetaReadinessReport {
  const totalQuestions = report.totalQuestions;

  // Count generated packs: items that didn't fail due to critical exception/timeout
  const packGeneratedCount = report.results.filter(
    (r) => !r.legislation.sourceUnavailable.some((e) => e.errorCode === "pack_generation_failed")
  ).length;
  const packNotGeneratedCount = totalQuestions - packGeneratedCount;

  // Gather source sufficiency distribution
  const sourceSufficiencyDistribution: Record<string, number> = {
    sufficient: 0,
    partial: 0,
    insufficient: 0
  };
  for (const r of report.results) {
    sourceSufficiencyDistribution[r.sourceSufficiencyLevel] =
      (sourceSufficiencyDistribution[r.sourceSufficiencyLevel] ?? 0) + 1;
  }

  const contractPassedCount = report.results.filter((r) => r.contractPassed).length;
  const contractFailedCount = report.results.filter(
    (r) => !r.contractPassed && !r.legislation.sourceUnavailable.some((e) => e.errorCode === "pack_generation_failed")
  ).length;

  const unsafeAdviceDetectedCount = report.results.filter((r) => r.unsafeAdviceDetected).length;
  const unofficialSourceDetectedCount = report.results.filter((r) => r.unofficialSourceDetected).length;

  const missingLegislationFieldCount = report.results.reduce(
    (sum, r) => sum + (r.missingLegislationFieldCount ?? 0),
    0
  );
  const missingPrecedentFieldCount = report.results.reduce(
    (sum, r) => sum + (r.missingPrecedentFieldCount ?? 0),
    0
  );

  const verifiedPrecedentCount = report.results.reduce(
    (sum, r) => sum + r.precedents.verifiedHighCourtPrecedentsCount,
    0
  );

  // Track unique legislation used
  const usedLegislation = new Set<string>();
  for (const r of report.results) {
    for (const leg of r.legislationOrder) {
      usedLegislation.add(leg);
    }
  }
  const uniqueLegislationUsedCount = usedLegislation.size;

  // Track issue coverage distribution
  const issueCoverageDistribution: Record<string, number> = {};
  for (const r of report.results) {
    for (const issueId of r.routedIssueIds) {
      issueCoverageDistribution[issueId] = (issueCoverageDistribution[issueId] ?? 0) + 1;
    }
  }

  const lowConfidenceRouteCount = report.results.filter((r) => r.routerConfidence === "low").length;

  // Identify timeout questions
  const timeoutQuestions = report.results.filter((r) =>
    r.legislation.sourceUnavailable.some(
      (e) => e.message.toLowerCase().includes("timed out") || e.message.toLowerCase().includes("timeout")
    )
  );
  const timeoutQuestionCount = timeoutQuestions.length;
  const timeoutQuestionIds = timeoutQuestions.map((r) => r.id);

  const cannotComposeResearchPackCount = report.results.filter((r) => !r.canComposeResearchPack).length;

  const averageLegislationPerPack =
    packGeneratedCount > 0
      ? parseFloat((report.results.reduce((sum, r) => sum + r.legislation.selectedCount, 0) / packGeneratedCount).toFixed(2))
      : 0;

  const averageVerifiedPrecedentPerPack =
    packGeneratedCount > 0
      ? parseFloat((report.results.reduce((sum, r) => sum + r.precedents.verifiedHighCourtPrecedentsCount, 0) / packGeneratedCount).toFixed(2))
      : 0;

  // Hard failure scanning
  const failures: string[] = [];
  
  if (unofficialSourceDetectedCount > 0) {
    failures.push(`Unofficial source detected in ${unofficialSourceDetectedCount} pack(s). non-gov.tr domains are strictly prohibited.`);
  }

  const liveMockFallbackCount = report.results.filter(
    (r) => r.sourceMode === "live" && r.usedMockSourceInLiveMode
  ).length;
  if (liveMockFallbackCount > 0) {
    failures.push(`Mock fallback leakage detected in live mode for ${liveMockFallbackCount} question(s).`);
  }

  if (contractFailedCount > 0) {
    failures.push(`Contract check failed for ${contractFailedCount} question(s). Mandatory fields or sections are missing.`);
  }

  if (unsafeAdviceDetectedCount > 0) {
    failures.push(`Unsafe advice (definitive opinion, risk levels, immediate actions, or template drafts) detected in ${unsafeAdviceDetectedCount} question(s).`);
  }

  // Precedent quoteUnusable leakage: any select verified precedent with quoteUsable === false
  let quoteUnusableLeakageCount = 0;
  for (const r of report.results) {
    const leak = r.precedents.verifiedPrecedentAudit?.some((e) => !e.quoteUsable && e.eligibilityStatus !== "precedent_excluded");
    if (leak) {
      quoteUnusableLeakageCount++;
    }
  }
  if (quoteUnusableLeakageCount > 0) {
    failures.push(`Precedent quoteUnusable leakage detected in ${quoteUnusableLeakageCount} question(s). Verified precedents must have usable reasoning quotes.`);
  }

  // Soft observations scanning
  const observations: string[] = [];

  const partialCount = sourceSufficiencyDistribution.partial ?? 0;
  const insufficientCount = sourceSufficiencyDistribution.insufficient ?? 0;
  if (partialCount > 0) {
    observations.push(`${partialCount} question(s) produced only partial source sufficiency.`);
  }
  if (insufficientCount > 0) {
    observations.push(`${insufficientCount} question(s) produced insufficient source sufficiency.`);
  }

  if (timeoutQuestionCount > 0) {
    observations.push(`${timeoutQuestionCount} question(s) encountered a retrieval timeout.`);
  }

  // Check for specific unverified coverage gaps surfaced in results
  const uniqueGaps = new Set<string>();
  for (const r of report.results) {
    for (const reason of r.audit?.errors ?? []) {
      if (reason.includes("coverage gap")) {
        uniqueGaps.add(reason);
      }
    }
    // Also parse reasons from the sufficiency check directly
    for (const reason of r.failureReasons ?? []) {
      if (reason.includes("coverage gap")) {
        uniqueGaps.add(reason);
      }
    }
    // Also check sufficiency reasons
    const rawResult = r as any;
    if (rawResult.reasons && Array.isArray(rawResult.reasons)) {
      for (const reason of rawResult.reasons) {
        if (reason.includes("coverage gap")) {
          uniqueGaps.add(reason);
        }
      }
    }
  }
  for (const gap of uniqueGaps) {
    observations.push(`Coverage gap identified: ${gap}`);
  }

  if (lowConfidenceRouteCount > 0) {
    observations.push(`${lowConfidenceRouteCount} question(s) routed with low router confidence.`);
  }

  // Calculate Beta Readiness Score
  // Base score is 100
  let score = 100;
  score -= timeoutQuestionCount * 10;
  score -= cannotComposeResearchPackCount * 10;
  score -= lowConfidenceRouteCount * 5;
  score -= (partialCount + insufficientCount) * 5;

  // Apply hard limits
  const gatePassed = failures.length === 0;
  let betaReadinessLevel: "ready" | "limited" | "not_ready";

  if (!gatePassed) {
    betaReadinessLevel = "not_ready";
    score = Math.min(score, 50); // cap score to max 50 on hard failure
  } else {
    score = Math.max(0, Math.min(100, score)); // clamp between 0 and 100
    betaReadinessLevel = score >= 85 ? "ready" : "limited";
  }

  return {
    betaReadinessScore: Math.round(score),
    betaReadinessLevel,
    gatePassed,
    failures,
    observations,
    metrics: {
      totalQuestions,
      packGeneratedCount,
      packNotGeneratedCount,
      sourceSufficiencyDistribution,
      contractPassedCount,
      contractFailedCount,
      unsafeAdviceDetectedCount,
      unofficialSourceDetectedCount,
      missingLegislationFieldCount,
      missingPrecedentFieldCount,
      verifiedPrecedentCount,
      uniqueLegislationUsedCount,
      issueCoverageDistribution,
      lowConfidenceRouteCount,
      timeoutQuestionCount,
      cannotComposeResearchPackCount,
      averageLegislationPerPack,
      averageVerifiedPrecedentPerPack,
      timeoutQuestionIds
    }
  };
}
