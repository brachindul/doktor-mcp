# Changelog

## [0.21.0] — 2026-05-23 — Physician Pack Contract Hardening

### Added

- **`ContractCheckResult`** interface in `src/packAudit.ts` with fields:
  - `passed` — true only when all contract invariants hold
  - `missingSections` — required top-level sections that are missing or empty (`shortAnswer`, `legalClassification`, `missingInformation`, `lawyerReviewPoints`)
  - `missingLegislationFields` — per-item array of missing required fields (`legislationName`, `articleNumber`, `verbatimQuote`, `connection`)
  - `missingPrecedentFields` — per-item array of fields that are missing or contain source-fallback placeholder strings (`courtAndChamber`, `date`, `factSummary`, `legalAssessment`, `outcome`, `similarityDifference`)
  - `unofficialSourceDetected` / `unofficialSourceDetails` — detects `accessSource === "mock"` in `decisionSourceTrace`
  - `unsafeAdviceDetected` / `unsafeAdvicePhrases` — scans all free-text fields for MVP-forbidden phrases (`kesin hukuki kanaat`, `dilekçe taslağı`, `savunma taslağı`, `risk seviyesi`, `derhal yapılacak`)

- **`contractCheck`** field added to `AuditResult`; all contract failures also bubble up to `errors[]` so `ok` is false when any contract check fails.

- **`BenchmarkItemResult`** new fields:
  - `contractPassed`, `missingSections`, `missingLegislationFieldCount`, `missingPrecedentFieldCount`, `unofficialSourceDetected`, `unsafeAdviceDetected`

- **`BenchmarkReport`** new aggregate fields:
  - `contractPassedCount`, `contractFailedCount`, `contractMissingSectionTotal`, `contractMissingLegislationFieldTotal`, `contractMissingPrecedentFieldTotal`, `contractUnofficialSourceCount`, `contractUnsafeAdviceCount`

- **`tests/packContractAudit.test.ts`** — 40 pure-function tests covering all contract check paths.

### Changed

- `AuditResult` shape is backward-compatible except for the addition of the `contractCheck` field.
- Test helpers in `packAudit.test.ts` and `benchmark.test.ts` updated to use valid contract-compliant pack shapes.

### Fixed

- `legalClassification`, `missingInformation`, and `lawyerReviewPoints` contract checks now correctly handle both `string` and `string[]` field variants as defined in `DoctorLegalInformationPack`.

---

## [0.20.0] — 2026-05-22 — Live Performance / Cache Baseline

- Cache telemetry (`cacheHit`, `cacheMiss`, `servedFromCache`, `networkRequestMade`, `cacheAgeMs`, `retryCount`, `backoffMs`, `retryAfterMs`, `timedOut`) added to `QueryAttemptTelemetry`.
- `PrecedentCache.getWithMeta()` returning `CacheLookupResult<T>`.
- `LiveYargitayAdapter` and `LiveDanistayAdapter` cache integration.
- `npm run benchmark:doctor-questions:performance`: cold → warm comparison, 96.32% improvement.

---

## [0.19.0] — 2026-05-21 — Source Query Ranking / Reliability Metrics

- `QueryAttemptTelemetry` per-query timing with `issueProfile`, `queryType`, `queryRank`.
- `SOURCE_AFFINITIES` table (12 issue profiles × 4 sources).
- `rankedQueriesForSource`: fallback only when rank-1 returns 0 results.
- `rerankByIssueRelevance`: stable sort of `precedent_usable` entries.
- `buildSourceReliabilityMetrics` / `buildIssueProfileReliabilityMetrics` with p50/p95.
