import { defineConfig } from "vitest/config";

// CI-specific config: skip tests that require live network access
export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/benchmark.test.ts",
      "**/liveYargitayAdapter.test.ts",
      "**/t20CandidateVerification.test.ts",
      "**/multiSourcePrecedents.test.ts",
      "**/liveDanistayAdapter.test.ts",
      "**/liveHealthPrimaryLegislation.test.ts",
      "**/legislationProvisionDedup.test.ts",
      "**/liveTimeBudgetLegislationPhase.test.ts",
      "**/extendedLiveVerification.test.ts",
      "**/snapshotMode.test.ts",
      "**/linkHealthChecker.test.ts",
      "**/precedentProbeCli.test.ts",
      "**/ingestFixtureCli.test.ts",
      "**/precedentFullTextCache.test.ts",
      "**/precedentCache.test.ts",
      "**/legislationCache.test.ts",
      "**/cacheWarmCli.test.ts",
      "**/liveAdapterFixture.test.ts",
      "**/liveLegislationAdapter.test.ts",
      "**/cloudflareFallback.test.ts",
      "**/articleCrossReferences.test.ts",
      "**/articleStatusDetection.test.ts",
      "**/articleParserSanitization.test.ts",
      "**/legislationDocCache.test.ts",
      "**/fixtureReplayLivePipeline.test.ts",
      "**/faz31_32_coveragePerformance.test.ts",
      "**/axisCoverageFixtureFed.test.ts",
      "**/aymProbe.test.ts",
      "**/realWorldLiveSmoke.test.ts",
      "**/multiSourcePrecedents.test.ts",
    ]
  }
});
