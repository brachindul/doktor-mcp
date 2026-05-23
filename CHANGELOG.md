# Changelog

## [0.22.0] — 2026-05-23 — Official Health Legislation Coverage

> Tag: `v0.22.0-official-health-legislation-coverage`

### Added

- **Two new `topicCluster` union values** in `src/sources/legislation/liveTypes.ts`:
  - `"private_health_facility"` — özel sağlık kuruluşu yetkilendirme ve yükümlülük soruları
  - `"professional_scope_of_practice"` — hekimin uzmanlık sınırı ve yetkisi soruları

- **Four new `HealthLegislationHint` entries** in `src/sources/legislation/healthMappings.ts`:
  - `professional_scope_of_practice` ← Tababet Kanunu md. 1, 25 (`mevzuat:1.3.1219`, `health_primary`)
  - `professional_scope_of_practice` ← Sağlık Hizmetleri Temel Kanunu md. 3, 9 (`mevzuat:1.5.3359`, `supporting_general`)
  - `private_health_facility` ← Sağlık Hizmetleri Temel Kanunu md. 1, 3, 9 (`mevzuat:1.5.3359`, `health_primary`)
  - `private_health_facility` ← Tababet Kanunu md. 1 (`mevzuat:1.3.1219`, `supporting_general`)
  - Total hint entries: 20 → 24

- **Two new mock `LegislationProvision` entries** in `src/sources/mockData.ts`:
  - `leg-tababet-25` — Tababet Kanunu md. 25 (uzmanlık sınırı / professional scope)
  - `leg-healthservices-9` — Sağlık Hizmetleri Temel Kanunu md. 9 (sağlık personeli faaliyeti / facility oversight)

- **`officialLegislationCoverage` section** added to `BenchmarkReport` in `src/benchmark/benchmarkRunner.ts`:
  - `coveredOfficialLegislationCount` — unique sourceIds registered in `healthLegislationHints`
  - `coveredLegislationTitles` — unique legislation titles in registry
  - `knownUncoveredLegislation` — known health legislation not yet registered (mevzuat.gov.tr ID unconfirmed)
  - `missingKnownHealthLegislationCount`
  - `topicClustersRegistered` / `topicClusterCount` — now 16 clusters (was 14)
  - `unofficialLegislationSourceCount` — questions where `unofficialSourceDetected === true`
  - `coverageWarnings` — human-readable summary of gaps and unofficial detections

- **`tests/officialLegislationCoverage.test.ts`** — 27 new pure-function tests:
  - sourceId format validation for all hints
  - Required legislation presence checks
  - New topic cluster registration and source legitimacy
  - Mock provision completeness for new articles
  - Contract check enforcement: non-gov.tr URLs still flagged; gov.tr URLs accepted
  - Hint count sanity (≥ 24), no duplicate sourceId+topicCluster pairs
  - New topic cluster terms do not trigger unsafe-advice detection
  - Total test count: 353 (was 328)

### Coverage Gap Report (v0.22.0)

Legislation evaluated but **not added** due to unconfirmed mevzuat.gov.tr internal IDs:

| Legislation | Reason not added |
|---|---|
| Özel Hastaneler Yönetmeliği | Type-7 mevzuatNo dahili ID doğrulanamadı |
| Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik | Type-7 mevzuatNo dahili ID doğrulanamadı |
| Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği | Type-7 mevzuatNo dahili ID doğrulanamadı |

These are documented in `officialLegislationCoverage.knownUncoveredLegislation` in every benchmark report.

### Constraints Observed

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No local-yargi module or fork.
- No physician-facing output contract behaviour changes.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft generation.
- Benchmark dataset not unnecessarily enlarged (new hints use existing legislation sources).
- Unofficial source contract check not relaxed; `*.gov.tr` rule intact.
- No entries added without a confirmed official source URL.

---

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
