# Changelog

## [0.21.1] — 2026-05-23 — Release Housekeeping

> Tag: `v0.21.1-release-housekeeping`
> **No functional changes.** This is a repository hygiene release only.

### Changed

- `package.json` version: `0.21.0` → `0.21.1`
- `package-lock.json` version: `0.20.0` → `0.21.1` (lock file version was lagging two releases behind; corrected)

### Notes

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No new source integrations.
- No changes to physician-facing output contract behaviour.
- No benchmark dataset changes.
- `exports/` and `.cache/` remain untracked (confirmed in `.gitignore`).
- Tag `v0.21.0-physician-pack-contract-hardening` is retained on commit `da4b583` (last code commit of v0.21.0); this release's tag is on the v0.21.1 commit.

---

## [0.21.0] — 2026-05-23 — Physician Pack Contract Hardening

> Tag: `v0.21.0-physician-pack-contract-hardening` → commit `da4b583`
> (Two commits: initial `c648126` + audit patch `da4b583`; tag re-applied to final commit.)

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

### Audit Patch (commit `da4b583`)

- **`meritsAndDecisionNumber` check added** — the required esas/karar field in `VerifiedPrecedentEntry` is now validated: empty string, whitespace-only, or the fallback placeholder `"Kaynakta esas/karar no yok"` all cause `contractCheck.passed === false`.
- **Legislation sourceTrace URL scanning** — any non-null URL (`landingUrl`, `fullTextUrl`, `detailUrl`, `directPdfUrl`, `generatedPdfUrl`) in `relevantLegislation[i].sourceTrace` that does not match `*.gov.tr` is flagged as unofficial.
- **Mock-source regex broadened** — precedent `accessSource` detection is now case-insensitive `/mock/i`, catching `MOCK_FALLBACK`, `mock-fixture`, etc.
- 12 new tests added (328 total).

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
