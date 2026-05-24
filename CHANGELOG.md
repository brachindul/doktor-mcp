# Changelog

## [0.35.0] — 2026-05-24 — RG Lead SourceId Resolver

> Tag: `v0.35.0-rg-lead-sourceid-resolver`

### Summary

Muhafazakâr RG lead sourceId resolver for the 5 `needs_manual_review` health
legislation entries whose only discovery signal is a Resmi Gazete number. The
resolver generates RG-number-based and title-combined query variants, searches
mevzuat.gov.tr for candidate sourceId/PDF leads, and routes them through the
existing verifier. No unsafe active coverage activation: verified promotion
requires the same verifier approval as v0.34.0. RG-only lead alone never
becomes active coverage.

### Added

- **`src/healthLegislationRgResolver.ts`** — new module with:
  - `RgLeadResolutionStatus`, `RgLeadResolutionCandidate`,
    `RgLeadPerEntryResult`, `HealthLegislationRgResolutionResult` types
  - `filterRgOnlyLeads()` — filters inventory entries with `expectedRgNumber`
    but no confirmed `mevzuatSourceId`
  - `buildRgQueryVariants()` — generates 5 query variant types: RG number alone,
    RG + short title, RG + alias, full title, full title + RG
  - `resolveRgEntry()` — per-entry resolver: search, score, candidate extraction,
    verifier handoff
  - `buildRgResolutionReport()` — multi-entry report builder
  - gov.tr guard on all candidates; non-gov.tr results ignored
  - RG-only lead never promoted without verifier approval
- **`src/resolveHealthLegislationRgLeadsCli.ts`** — CLI entry point:
  `npm run resolve:health-legislation-rg-leads`
  - Writes structured report to `exports/health-legislation-rg-resolution/report.json`
- **27 test cases** in `tests/healthLegislationRgResolver.test.ts` covering:
  - `filterRgOnlyLeads` filtering logic
  - `resolveRgEntry` with no RG, empty search, non-gov.tr ignored
  - RG+title match candidate finding
  - Verifier handoff: verified, rejected, candidate-only
  - Real inventory fixtures for all 5 RG-only entries
  - Kişisel Sağlık Verileri and Acil Sağlık correct mock verification
  - Wrong document rejection
  - RG-only never becomes active coverage without verifier
  - No non-gov.tr sourceId leakage
  - JSON report parseable

### Changed

- `package.json`: version `0.34.0` → `0.35.0`
- `package-lock.json`: version `0.31.0` → `0.35.0`

### Design invariants

- **RG lead ≠ verified**: RG number alone is a discovery signal, not a sourceId.
- **Verifier gate**: every candidate must pass `verifyBySourceIdDirect()`.
- **gov.tr mandatory**: non-gov.tr search results are silently ignored.
- **No coverage change**: active coverage unchanged — all 5 entries remain
  `needs_manual_review` unless verifier confirms.
- **No local-yargi import**: patterns reimplemented independently.
- **No risk levels, urgent actions, or legal opinions**.

### Coverage unchanged

`coveredOfficialLegislationCount`: 11 (unchanged).
`verifiedOfficialSourceCount`: 11 (unchanged).
`unofficialLegislationSourceCount`: 0 (unchanged).

## [0.34.0] — 2026-05-24 — Official Source Lead Verification

> Tag: `v0.34.0-official-source-lead-verification`

### Summary

Bridge between v0.33 source discovery leads and the existing direct verifier.
Discovered leads (mevzuat.gov.tr sourceId, Resmi Gazete metadata) are now
routed through `verifyBySourceIdDirect()` automatically. Lead found ≠ verified
principle enforced: only entries passing title/alias/RG/marker/gov.tr checks
are marked promotable. This is a verification infrastructure release, not an
active coverage increase.

### Added

- **`verifyDiscoveredOfficialLeads()`** in `healthLegislationSourceDiscovery.ts`:
  async function that takes discovery report + inventory entries + adapter and
  routes each lead through the existing verifier.
  - SourceId leads → `verifyBySourceIdDirect()` with full entry metadata
  - RG-only leads → search mevzuat.gov.tr by RG number, then verify if found
  - No actionable leads → `needs_manual_review`
  - Returns `LeadVerificationReport` with `leadsAttempted`, `leadsVerified`,
    `leadsRejected`, `needsManualReviewCount`, `promotedToActiveCoverageCount`
- **`DiscoveredLeadVerificationResult`** and **`LeadVerificationReport`** types
- **`verify:discovered-health-legislation`** CLI in
  `verifyDiscoveredHealthLegislationCli.ts`:
  runs discovery → verification pipeline, writes report to
  `exports/health-legislation-source-discovery/verification-report.json`
- **16 test cases** in `healthLegislationLeadVerification.test.ts` covering:
  - SourceId lead → verified (title/marker match)
  - SourceId lead → rejected (fetch fail, title mismatch)
  - Known wrong match rejection
  - RG-only lead → search → verified
  - RG-only lead → no search results → needs_manual_review
  - Multiple entries aggregated counts
  - Özel Hastaneler correct/wrong PDF fixture
  - Non-gov.tr source rejection, no original entry mutation

### Changed

- `healthLegislationSourceDiscovery.ts`: v0.33 → v0.34 header; imports
  `verifyBySourceIdDirect` and `scoreTitleMatch` from verifier; exports
  `DiscoveredLeadVerificationResult`, `LeadVerificationReport`,
  `verifyDiscoveredOfficialLeads`
- `package.json`: `0.33.0` → `0.34.0`, new script
  `verify:discovered-health-legislation`

### Audit

- **No gov.tr dışı source acceptance**: non-gov.tr leads never reach verifier
- **No auto-promotion**: `promotedToActiveCoverageCount` reflects verifier
  results; no inventory/mapping file mutation from CLI
- **No output contract changes**: verified entries unchanged
- **No local-yargi import**
- **Coverage unchanged**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `unofficialLegislationSourceCount` = 0

### Lead Verification Results (Live)

| Entry | Lead | Verifier Result |
|-------|------|-----------------|
| ozel-hastaneler | mevzuat:7.5.29092 | `rejected_source_id_fetch_failed` |
| ayakta-teshis | RG 29058 | needs_manual_review |
| acil-saglik | RG 29332 | needs_manual_review |
| isyeri-hekimi | RG 29818 | needs_manual_review |
| kisisel-saglik-verileri | RG 30867 | needs_manual_review |
| saglik-bakanligi-disiplin | RG 25450 | needs_manual_review |

---

## [0.33.0] — 2026-05-24 — Manual Official Source Discovery

> Tag: `v0.33.0-manual-official-source-discovery`

### Summary

Source discovery module for remaining gap/candidate health regulation entries.
Collects and classifies available official source leads (mevzuat.gov.tr sourceId,
Resmi Gazete, Sağlık Bakanlığı page, candidate title match) into a structured
report. Does NOT auto-verify — verification is delegated to the existing
`healthLegislationAccessVerifier`. This is a discovery aid release, not an active
coverage increase release.

### Added

- **`healthLegislationSourceDiscovery.ts`** — core source discovery module:
  - `OfficialSourceLead` type with `entryKey`, `leadKind`, `sourceId`,
    `officialUrl`, `domain`, `title`, `rgDate`, `rgNumber`, `confidence`,
    `status`, `reasons`
  - `OfficialSourceLeadKind`: `mevzuat_source_id`, `mevzuat_pdf_url`,
    `resmi_gazete_url`, `saglik_gov_tr_page`, `candidate_title_match`
  - `OfficialSourceLeadStatus`: `candidate_lead`, `verified_by_existing_verifier`,
    `rejected`, `needs_manual_review`
  - `HealthLegislationSourceDiscoveryResult` and `SourceDiscoveryReport` types
  - `discoverEntrySources(entry)` — per-entry lead collection with four strategies:
    - Strategy A: mevzuat sourceId lead from `candidateLegacySourceId`
    - Strategy B: Resmi Gazete lead from `expectedRgDate`/`expectedRgNumber`
    - Strategy C: Sağlık Bakanlığı page lead from `candidateOfficialUrlLead`
    - Strategy D: Candidate title match from `aliases`/`searchTerms`
  - `buildSourceDiscoveryReport(entries)` — aggregates results into structured
    report with counts (entriesScanned, leadsFound, officialLeadsFound,
    nonOfficialLeadsIgnored, leadsSentToVerifier, needsManualReviewCount)
  - `filterDiscoveryCandidates(entries)` — filters to gap + candidate entries
- **`discoverHealthLegislationSourcesCli.ts`** — `discover:health-legislation-sources`
- **37 test cases** in `healthLegislationSourceDiscovery.test.ts` covering
  all four lead strategies, 6-entry contract verification, safety invariants

### Changed

- `package.json`: `0.32.0` → `0.33.0`, new script
  `discover:health-legislation-sources`

### Audit

- **No gov.tr dışı source acceptance**: non-gov.tr leads captured in
  `ignoredNonOfficialLeads`, never in active leads
- **No auto-verification**: `discoverEntrySources` does not set `verifiedLead`;
  leads marked `status: "candidate_lead"` until verifier confirms
- **No output contract changes**: verified entries unchanged
- **No local-yargi import**
- **Coverage unchanged**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `unofficialLegislationSourceCount` = 0

### Discovery Results

| Entry | SourceId Lead | RG Lead | Needs |
|-------|:---:|:---:|-------|
| ozel-hastaneler | medium (7.5.29092) | medium (29092) | PDF fetch confirmation |
| ayakta-teshis | — | medium (29058) | sourceId discovery |
| acil-saglik | — | medium (29332) | sourceId discovery |
| isyeri-hekimi | — | medium (29818) | sourceId discovery |
| kisisel-saglik-verileri | — | medium (30867) | sourceId discovery |
| saglik-bakanligi-disiplin | — | medium (25450) | sourceId discovery + title update check |

---

## [0.32.0] — 2026-05-24 — Remaining Health Regulations Direct Access

> Tag: `v0.32.0-remaining-health-regulations-direct-access`

### Summary

Direct sourceId-to-PDF fetch promoted from fallback (v0.31) to the primary path
when `candidateLegacySourceId` is set. The verifier now tries `verifyBySourceIdDirect`
before the search API, returning immediately on verified results and definitive
rejections (known wrong match, negative marker, title mismatch, empty document),
and falling through to search only on transient errors (timeout, fetch_failed).
Six remaining gap entries enriched with `markerTerms`, `negativeMarkerTerms`,
`knownWrongMatches`, RG metadata, and `candidateLegacySourceId` (where available).
A `knownWrongMatches` guard explicitly rejects 8 non-health legislation patterns
at both the sourceId prefix and title substring level. A `negativeMarkerTerms`
guard rejects documents containing terms indicative of wrong regulations.

### Added

- **Direct-first strategy**: `verifyInventoryEntry()` calls
  `verifyBySourceIdDirect()` BEFORE the search API loop when
  `candidateLegacySourceId` is set. Verified results and hard rejections return
  immediately; transient errors propagate diagnostics to search fallback.
- **`KNOWN_WRONG_MATCHES`** list (8 entries): Makine ve Kimya, Karayolları,
  Posta, KVKK, TSK Disiplin, SGK, Radyasyon Güvenliği, Devlet Memurları —
  matched by sourceId prefix (canonical) or title substring (for unknown
  sourceIds).
- **`checkKnownWrongMatch()`** — shared helper used in both direct-fetch and
  search-result paths.
- **`checkNegativeMarkers()`** — rejects document if any `negativeMarkerTerm`
  appears in fetched text (e.g., "tsk" for discipline regulation).
- **`MIN_MARKER_SCORE = 0.30`** threshold for direct-fetch content verification.
- **`CompositeMatchScore`** expanded with `markerScore`, `rgScore`, `typeScore`.
- **`computeCompositeScore()`** now computes `markerScore` from entry-level
  `markerTerms`.
- **Entry-level `markerTerms`**, `negativeMarkerTerms`, `knownWrongMatches`,
  `candidateOfficialUrlLead` fields in `HealthLegislationInventoryEntry`.
- Six verification status fields for diagnostics:
  `directSourceIdAttempted`, `directFetchOfficialUrl`, `markerScore`, `rgScore`,
  `typeScore`, `knownWrongMatchHit`, `knownWrongMatchReason`,
  `negativeMarkerHit`, `negativeMarkerTerm`, `finalDecision`.
- 22 new test cases: `checkKnownWrongMatch`, `checkNegativeMarkers`,
  direct-first strategy, `computeCompositeScore` markerScore, known wrong match
  filtering, expanded diagnostics.

### Changed

- `verifyBySourceIdDirect()`: uses entry-level `markerTerms`,
  `negativeMarkerTerms`, `knownWrongMatches`; emits expanded diagnostics
  (`directSourceIdAttempted`, `directFetchOfficialUrl`, `markerScore`, `rgScore`,
  `typeScore`, `knownWrongMatchHit`, `knownWrongMatchReason`,
  `wrongMatchReason`, `finalDecision`, `negativeMarkerHit`).
- `verifyInventoryEntry()`: Path C (direct fetch) tried BEFORE Path A/B (search
  API), not as fallback. Search results filtered through `checkKnownWrongMatch`.
  Expanded diagnostics merged into rejected and search-error paths.
- `healthLegislationInventory.ts`: 6 remaining gap entries enriched with
  `markerTerms`, `negativeMarkerTerms`, `knownWrongMatches`, RG date/number,
  `candidateOfficialUrlLead`; `ozel-hastaneler-yonetmeligi` gets
  `candidateLegacySourceId: "mevzuat:7.5.29092"`.
- `package.json`: `0.31.0` → `0.32.0`.

### Audit

- **No gov.tr dışı source**: all direct fetches target `mevzuat.gov.tr` URLs.
- **No output contract changes**: verified entries unchanged; all gap entries
  remain gaps.
- **No local-yargi import**.
- **Known wrong matches**: 8 hardcoded patterns, prefix + title match.
- **Negative markers**: multi-term substring match on full document text.
- **Coverage**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `uncoveredCoreCount` = 3.

### Known Gaps (unchanged)

Six entries remain unverified. The direct sourceId path now explicitly guards
against known wrong matches and enforces marker-based content verification for
any future sourceId discovery:
1. `ozel-hastaneler-yonetmeligi` (sourceId `mevzuat:7.5.29092` fetch failed)
2. `ayakta-teshis-ozel-saglik`
3. `acil-saglik-hizmetleri-yonetmeligi`
4. `isyeri-hekimi-yonetmeligi`
5. `kisisel-saglik-verileri-yonetmeligi`
6. `saglik-bakanligi-disiplin-yonetmeligi`

---

## [0.31.0] — 2026-05-24 — Direct Type-7 Legislation Source Access

> Tag: `v0.31.0-type7-direct-legislation-access`

### Summary

Direct sourceId-to-PDF fetch path for type-7 legislation (yönetmelik). When
mevzuat.gov.tr search API fails (timeout, no match, or error), the verifier now
falls back to fetching the official PDF directly via the known sourceId, extracts
the title from the first page, and validates it against the inventory entry.
`saglik-meslek-is-gorev-tanimlari` (sourceId `mevzuat:7.5.19696`) is the first
entry verified via this path and activated in the hint registry. All existing
rejection criteria (title/alias score < 0.50, marker overlap < 0.30, empty
document) are enforced.

### Added

- **`fetchOfficialDocument(sourceId)`** in `LiveOfficialLegislationAdapter` —
  parses `mevzuat:<type>.<arrangement>.<number>`, constructs
  `https://www.mevzuat.gov.tr/mevzuatmetin/<type>.<arrangement>.<number>.pdf`,
  fetches with 30s timeout, extracts title from PDF text
- **`verifyBySourceIdDirect()`** in `healthLegislationAccessVerifier.ts` — Path C
  fallback that runs when primary search (Path A/B) times out or fails
- **`extractDocTitle(pdfText)`** — reads first line of raw PDF text as document
  title
- **`computeMarkerOverlap(pdfText, markers)`** — computes ratio of content
  markers found in the document body
- **`extractRgFromDocText(pdfText)`** — extracts RG date and number from PDF
  text metadata lines
- Four new violation status types:
  - `verified_via_source_id_direct`
  - `rejected_source_id_timeout`
  - `rejected_source_id_title_mismatch`
  - `rejected_source_id_empty_document`
  - `rejected_source_id_fetch_failed`
- Seven new attempt fields for direct-fetch monitoring:
  `directFetchAttempted`, `directFetchTimedOut`, `directFetchStatus`,
  `directFetchTitle`, `directFetchRgDate`, `directFetchRgNumber`,
  `directFetchMarkerScore`, `directFetchTextLength`
- **`healthLegislationInventory.ts`**: `saglik-meslek-is-gorev-tanimlari` →
  `officialSourceStatus: "verified"`, `coverageStatus: "covered"`,
  `mevzuatSourceId: "mevzuat:7.5.19696"`,
  `officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf"`
- **`healthMappings.ts`**: active `HealthLegislationHint` for
  `professional_scope_of_practice` (primary, priority 5) and
  `disciplinary_administrative` (supporting, priority 50)
- 14 new test cases in `healthLegislationAccessVerifier.test.ts` for direct
  verification (success, timeout, title mismatch, empty doc, no sourceId,
  search-error fallback)

### Changed

- `verifyInventoryEntry()`: if search times out or returns no match / error,
  attempts `verifyBySourceIdDirect()` as Path C
- CLI report (`verifyHealthLegislationCli.ts`): shows directFetch fields in
  all result sections (verified, rejected, search-error)
- `package.json`: `0.30.0` → `0.31.0`

### Audit

- **Direct type-7 PDF fetch**: no source/output contract relaxation
- **gov.tr only**: all direct fetches target `mevzuat.gov.tr` URLs
- **No external vendor**: no local-yargi import
- **Coverage**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `uncoveredCoreCount` = 3

### Known Gaps (unchanged)

Six entries remain rejected by search (all return kanun results for yonetmelik
queries). Each could be manually verified via the same direct sourceId path if a
legacy sourceId is provided:
1. `ozel-hastaneler-yonetmeligi`
2. `ayakta-teshis-ozel-saglik`
3. `acil-saglik-hizmetleri-yonetmeligi`
4. `isyeri-hekimi-yonetmeligi`
5. `kisisel-saglik-verileri-yonetmeligi`
6. `saglik-bakanligi-disiplin-yonetmeligi`

## [0.30.0] — 2026-05-24 — Health Legislation Query Recall

> Tag: `v0.30.0-health-legislation-query-recall`

### Summary

Multi-variant query recall strategy for the 7 entries rejected in v0.29.0. Instead of relying
solely on raw `searchTerms`, each inventory entry now has a full query plan:
`exact_title → aliases → legacy_source_id_probe → rg_number → keyword_combo`. Scores are
composited from title F1, alias F1, legislation-type metadata, and optional sourceId probe bonus.
Two acceptance paths: Path A (finalScore ≥ 0.75) and Path B (sourceId probe match + title/alias ≥ 0.50).

### Added

- **`buildQueryPlan(entry)`** — generates a deduplicated, prioritised `HealthLegislationQueryPlan`
  with query variants in weight order (1.0 → 0.9 → 0.8 → 0.7 → 0.5)
- **`computeCompositeScore(entry, result, variant)`** — composite scoring:
  - `titleScore` (F1 word-overlap on official title)
  - `aliasScore` (max F1 across all aliases)
  - `metadataScore` (+0.05 when legislation type inferred from sourceId matches `expectedLegislationType`)
  - `sourceIdProbeBonus` (+0.25 when result.sourceId === candidateLegacySourceId)
  - `probePathEligible` — true when sourceId matches AND bestTitleOrAlias ≥ 0.50
  - `finalScore` = min(1.0, max(titleScore, aliasScore) + metadataScore)
- **New status**: `"verified_via_source_id_probe"` — Path B acceptance
- **New status**: `"rejected_wrong_document"` — legislation type mismatch rejection
- **New types**: `QueryVariantKind`, `HealthLegislationQueryVariant`, `QueryRecallStrategy`,
  `HealthLegislationQueryPlan`, `CompositeMatchScore`
- **New fields on `HealthLegislationVerificationAttempt`**: `attemptedQueries`, `bestQueryKind`,
  `titleScore`, `aliasScore`, `metadataScore`, `sourceIdProbeUsed`, `topCandidates`
- **New optional fields on `HealthLegislationInventoryEntry`**:
  `aliases?`, `expectedLegislationType?`, `expectedRgDate?`, `expectedRgNumber?`, `candidateLegacySourceId?`

### Updated

- **`src/healthLegislationInventory.ts`** — 7 rejected entries enriched with aliases + metadata:
  - `saglik-meslek-is-gorev-tanimlari`: 3 aliases, `expectedLegislationType="yonetmelik"`,
    `expectedRgDate="2014-05-22"`, `expectedRgNumber="29007"`, `candidateLegacySourceId="mevzuat:7.5.19696"`
  - `ozel-hastaneler-yonetmeligi`, `ayakta-teshis-ozel-saglik`, `acil-saglik-hizmetleri-yonetmeligi`,
    `isyeri-hekimi-yonetmeligi`, `kisisel-saglik-verileri-yonetmeligi`,
    `saglik-bakanligi-disiplin-yonetmeligi`: each given 2–3 aliases + `expectedLegislationType`

- **`src/healthLegislationAccessVerifier.ts`** — full rewrite for v0.30.0 multi-variant architecture

- **`src/verifyHealthLegislationCli.ts`** — enhanced reporting: per-entry `queryKind`, `titleScore`,
  `aliasScore`, `probeUsed`, query count, top candidate listing

- **`tests/healthLegislationAccessVerifier.test.ts`** — expanded from 38 to 73 tests:
  - `buildQueryPlan` — 10 tests (ordering, deduplication, strategy labels, probe/rg/alias inclusion)
  - `computeCompositeScore` — 7 tests (titleScore, aliasScore, metadataScore, probePathEligible)
  - `verifyInventoryEntry` — 4 new cases (rejected_wrong_document, alias-verified, probe-verified, probe-rejected-low-title)
  - `saglik-meslek-is-gorev-tanimlari` fixture — 6 dedicated tests
  - `buildAccessVerificationReport` — 1 new test (verified_via_source_id_probe counted correctly)
  - Integration guard — 1 new test (verified_via_source_id_probe officialUrl constraint)

### Constraints upheld

- No gov.tr-external source accepted as verified (Path A + Path B both apply gov.tr guard)
- No ambiguous match may activate (AMBIGUITY_MARGIN = 0.10 applies to both paths)
- No output contract change; no source sufficiency relaxation
- No new topic cluster added
- local-yargi: not imported, not vendored

---

## [0.29.0] — 2026-05-24 — Official Legislation Access Verifier

> Tag: `v0.29.0-official-legislation-access-verifier`

### Added

- **`src/healthLegislationAccessVerifier.ts`** — Live mevzuat.gov.tr access verifier:
  - `normalizeTitleForMatch(title)` — Turkish char→ASCII normalization for case-insensitive title comparison
  - `scoreTitleMatch(invTitle, searchResultTitle)` — F1 word-overlap score (0–1); threshold 0.75
  - `isGovTrUrl(url)` — rejects any non-`.gov.tr` source URL
  - `verifyInventoryEntry(entry, adapter)` — per-entry verification with accept/reject logic:
    - Accepts only if score ≥ 0.75 AND URL is on mevzuat.gov.tr AND no ambiguity (second-best within 0.10 margin)
    - Status: `verified | rejected_no_match | rejected_ambiguous | rejected_non_gov_tr | rejected_low_score | search_error`
  - `buildAccessVerificationReport(entries, adapter)` — aggregate report with 500ms inter-request delay
  - `LegislationSearchAdapter` interface — mockable in unit tests (no network in tests)

- **`src/verifyHealthLegislationCli.ts`** — CLI that runs verifier against all candidate+gap entries and writes JSON report to `exports/health-legislation-verification/report.json`

- **`tests/healthLegislationAccessVerifier.test.ts`** — 38 unit tests (no network):
  - `normalizeTitleForMatch` — Turkish char conversion, whitespace collapse
  - `titleWords` — stop word filtering, short-word exclusion
  - `scoreTitleMatch` — identical titles, suffix variation, unrelated titles, ambiguity discrimination
  - `isGovTrUrl` — accept mevzuat.gov.tr, reject non-gov.tr
  - `verifyInventoryEntry` — verified, no_match, low_score, ambiguous, non_gov_tr, search_error
  - `buildAccessVerificationReport` — aggregate counts and entry lists
  - Integration guards: non-gov.tr can never produce verified; verified always has `mevzuat:` prefix; verified officialUrl always on mevzuat.gov.tr

### Verified (5 new — sourceIds confirmed via live mevzuat.gov.tr search, score 1.000 each)

| Entry | sourceId | Official title |
|---|---|---|
| `aile-hekimligi-kanunu` | `mevzuat:1.5.5258` | AİLE HEKİMLİĞİ KANUNU |
| `is-sagligi-guvenligi-kanunu` | `mevzuat:1.5.6331` | İŞ SAĞLIĞI VE GÜVENLİĞİ KANUNU |
| `organ-doku-nakli-kanunu` | `mevzuat:1.5.2238` | ORGAN VE DOKU ALINMASI, SAKLANMASI, AŞILANMASI VE NAKLİ HAKKINDA KANUN |
| `uyeye-yardimci-tedavi-yonetmeligi` | `mevzuat:7.5.20085` | ÜREMEYE YARDIMCI TEDAVİ UYGULAMALARI VE MERKEZLERİ HAKKINDA YÖNETMELİK |
| `geleneksel-tamamlayici-tip-yonetmeligi` | `mevzuat:7.5.45117` | GELENEKSEL VE TAMAMLAYICI TIP UYGULAMALARI YÖNETMELİĞİ |

### Rejected (7 — remain candidate/gap, reason documented in verifier report)

| Entry | Status | Reject reason |
|---|---|---|
| `ozel-hastaneler-yonetmeligi` | gap | Low score (0.095) — search returned unrelated legislation |
| `ayakta-teshis-ozel-saglik` | gap | Low score (0.333) — search returned radiation services regulation |
| `saglik-meslek-is-gorev-tanimlari` | gap | Low score (0.100) — search returned debt restructuring law |
| `acil-saglik-hizmetleri-yonetmeligi` | candidate | Low score (0.286) — search returned Postal Services Law |
| `isyeri-hekimi-yonetmeligi` | candidate | Low score (0.214) — search returned social security law |
| `kisisel-saglik-verileri-yonetmeligi` | candidate | Low score (0.167) — search returned unrelated law |
| `saglik-bakanligi-disiplin-yonetmeligi` | candidate | Low score (0.111) — search returned police discipline law |

### Updated

- **`src/healthLegislationInventory.ts`** — 5 entries promoted from candidate to verified; `coverageStatus` set to `covered`; `mevzuatSourceId` and `officialUrl` added
- **`src/sources/legislation/healthMappings.ts`** — 7 new `HealthLegislationHint` entries for the 5 newly verified legislation (using existing topic clusters: `professional_scope_of_practice`, `informed_consent`, `medical_intervention`):
  - Aile Hekimliği Kanunu → `professional_scope_of_practice`
  - İSG Kanunu → `professional_scope_of_practice`
  - Organ Nakli Kanunu → `informed_consent`, `medical_intervention`
  - ÜYTE Yönetmeliği → `informed_consent`, `medical_intervention`
  - GETAT Yönetmeliği → `professional_scope_of_practice`

### Coverage changes (before → after)

| Metric | v0.28.0 | v0.29.0 |
|---|---|---|
| `verifiedOfficialSourceCount` | 5 | **10** |
| `coveredOfficialLegislationCount` | 5 | **10** |
| `coveredByActiveHintsCount` | 5 | **10** |
| `candidateOfficialSourceCount` | 9 | **4** |
| `gapCount` | 3 | 3 (unchanged) |
| `uncoveredCoreCount` | 4 | 4 (unchanged — new entries not core) |
| `unofficialLegislationSourceCount` | 0 | **0** |
| `topicClusterCount` | 16 | 16 (no new clusters) |

### Constraints upheld

- No gov.tr-external source accepted as verified
- No output contract / source sufficiency relaxation
- No new topic cluster added to `HealthLegislationHint` type
- local-yargi: not imported, not vendored

---

## [0.28.0] — 2026-05-24 — Official Health Legislation Inventory

> Tag: `v0.28.0-official-health-legislation-inventory`

### Added

- **`src/healthLegislationInventory.ts`** — Canonical physician-relevant Turkish health legislation inventory:
  - `HealthLegislationInventoryEntry` interface with `key`, `title`, `titleNormalized`, `category`, `relevanceLevel`, `officialSourceStatus`, `coverageStatus`, `mevzuatSourceId?`, `officialUrl?`, `relatedIssueIds`, `relatedTopicClusters`, `searchTerms`, `notes`
  - `HealthLegislationAccessStatus`: `verified | candidate | gap | deferred`
  - `HealthLegislationRelevanceLevel`: `core | supporting | specialized`
  - `HealthLegislationCategory`: 14 categories (`physician_practice`, `patient_rights`, `professional_ethics`, `data_privacy`, `private_health_facility`, `emergency_services`, `occupational_health`, `organ_tissue`, `reproductive_medicine`, `home_health`, `complementary_medicine`, `diagnostics`, `discipline`, `insurance`)
  - `HealthLegislationInventoryReport` interface
  - `HEALTH_LEGISLATION_INVENTORY` — 21-entry inventory:
    - **5 verified** (active in adapter registry): Hasta Hakları Yönetmeliği, Tıbbi Deontoloji Nizamnamesi, Tababet Kanunu, Sağlık Hizmetleri Temel Kanunu, KVKK
    - **3 gap** (known since v0.22.0; official ID unconfirmed): Özel Hastaneler Yönetmeliği, Ayakta Teşhis Yönetmeliği, Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği
    - **9 candidate** (sourceId research needed): Acil Sağlık, Aile Hekimliği Kanunu, İş Sağlığı ve Güvenliği Kanunu, İşyeri Hekimi Yönetmeliği, Kişisel Sağlık Verileri Yönetmeliği, Organ Nakli Kanunu, ÜYTE Yönetmeliği, GETAT Yönetmeliği, Disiplin Yönetmeliği
    - **4 deferred**: Ambulans, Yataklı Tedavi, Hekim Sigortası, Radyoloji
  - `VERIFIED_MEVZUAT_SOURCE_IDS` — read-only set of confirmed sourceIds
  - `buildInventoryReport()` — pure function producing coverage/gap summary
  - Design constraints enforced: no non-gov.tr URL may be `verified`; no `candidate`/`gap` entry activates in adapter registry

- **`src/benchmark/benchmarkRunner.ts`** additions:
  - `BenchmarkReport.officialLegislationCoverage` extended with v0.28.0 inventory fields (backward compatible — all v0.22.0 fields preserved):
    - `inventoryTotalCount`, `coreInventoryCount`, `verifiedOfficialSourceCount`, `candidateOfficialSourceCount`, `gapCount`, `deferredCount`, `coveredByActiveHintsCount`, `uncoveredCoreCount`, `inventoryByCategory`, `inventoryByAccessStatus`
  - `buildOfficialLegislationCoverage` now calls `buildInventoryReport()` and derives gap list from inventory instead of hardcoded constant
  - Markdown report gains **Official Health Legislation Inventory** section

- **`tests/healthLegislationInventory.test.ts`** — 27 unit tests:
  - All required fields present on every entry
  - All keys unique
  - Verified entries have mevzuatSourceId and mevzuat.gov.tr officialUrl
  - Non-verified entries have no officialUrl
  - Gap entries have no mevzuatSourceId
  - v0.22.0 known gaps present with gap status
  - No candidate/gap entry has coverageStatus=covered
  - VERIFIED_MEVZUAT_SOURCE_IDS membership correct
  - buildInventoryReport counts consistent
  - coverageWarnings correctness, no INTEGRITY ERROR

### No Breaking Changes

- All v0.22.0 `officialLegislationCoverage` fields retained with identical semantics
- No active adapter registry entries added (only verified entries may be active)
- No gov.tr-external URLs accepted as verified
- No output contract, router, or sufficiency rule changes

---

## [0.27.0] — 2026-05-24 — Cross-Source Provenance, Duplicate Merge, Adapter-Native ContentStatus

> Tag: `v0.27.0-cross-source-provenance`

### Added

- **`src/live/decisionProvenance.ts`** — New module for cross-source provenance and duplicate merge:
  - `deriveContentStatus(decision)` — derives `ContentStatus` from decision fields; respects already-set value
  - `isQuoteUsable(decision)` — true only when contentStatus is full_text/html_markdown AND eligibilityStatus is not ineligible
  - `buildDecisionKey(decision)` — stable dedup key; prefers `doc::<documentId>` when available, falls back to court-based composite key
  - `chooseStrongestContentStatus(statuses)` — picks strongest from a list (full_text > html_markdown > pdf_link_only > metadata_only > unavailable)
  - `mergeDuplicateDecisions(decisions)` — merges decisions sharing the same key; winner = strongest contentStatus; loser's provenance merged in
  - `buildProvenanceMetrics(decisions)` — aggregate metrics over a decision list (content status, fetch status, quote usability distributions)
  - `MergeResult`, `ProvenanceMetrics` interfaces exported

- **`src/contracts/legal.ts`** additions:
  - `FetchStatus` type — `"search_hit" | "full_text_fetched" | "metadata_only" | "pdf_link_only" | "unavailable" | "timeout" | "parse_error" | "source_unavailable"`
  - `DecisionSourceProvenance` interface — per-decision provenance record with `source`, `fetchStatus`, `contentStatus`, `quoteUsable`, `timedOut`, `retryCount`, `backoffMs`, `fetchedAt`
  - `CourtDecision.provenance?: DecisionSourceProvenance[]` — list of per-source provenance entries (merged when duplicates are resolved)
  - `CourtDecision.normalizedDecisionKey?: string` — stable dedup key as set by adapters

- **Adapter wiring** — all three live adapters now set `contentStatus`, `quoteUsable`, `normalizedDecisionKey`, and `provenance[0]` on each `CourtDecision`:
  - `src/sources/bedesten/liveBedestenAdapter.ts`
  - `src/sources/yargitay/liveYargitayAdapter.ts`
  - `src/sources/danistay/liveDanistayAdapter.ts`

- **`src/live/reliabilityGate.ts`** additions:
  - `ReliabilityGateInput.quoteUnusableInVerifiedCount` — new field
  - `LiveReliabilityGate.quoteUnusableInVerifiedCount` — new field
  - Hard failure: `QUOTE_UNUSABLE_VERIFIED` — triggers when any verified precedent has `quoteUsable=false`

- **`src/benchmark/benchmarkRunner.ts`** additions:
  - `VerifiedPrecedentAuditEntry.adapterNativeContentStatus: boolean` — true when live adapter set contentStatus
  - `BenchmarkReport.provenanceMetrics` — full provenance aggregate metrics block
  - `buildProvenanceMetricsFromResults` helper — derives provenance distribution from audit entries
  - `buildLiveReliabilityGateFromResults` now computes and passes `quoteUnusableInVerifiedCount`
  - Markdown report gains **Cross-Source Provenance Metrics** section

- **`tests/decisionProvenance.test.ts`** — 17 test cases covering all exported functions

### Changed

- `package.json` / `package-lock.json`: version bumped to `0.27.0`

## [0.26.0] — 2026-05-24 — Live Reliability Gate

> Tag: `v0.26.0-live-reliability-gate`

### Added

- **`src/live/reliabilityGate.ts`** — Pure utility module; no adapters, no network calls, no circular dependencies.
  - `ReliabilityGateInput` — flat struct accepted from benchmark runner (avoids circular import)
  - `SourceSufficiencyRecord` — per-query sufficiency record with `query`, `precedentCount`, `legislationCount`, `sufficient`
  - `LiveReliabilityGate` — output interface with all gate fields including `gatePassed`, `gateFailures`, `gateObservations`
  - `buildLiveReliabilityGate(input)` — evaluates hard failures and soft observations:
    - **Hard failures** (set `gatePassed = false`): `MOCK_FALLBACK`, `CONTRACT_FAIL`, `UNOFFICIAL_SOURCE`, `INELIGIBLE_PRECEDENT`
    - **Soft observations** (informational, gate still passes): `TIMEOUT`, `RATE_LIMIT`, `INSUFFICIENT_SUFFICIENCY`

- **`src/contracts/legal.ts`** additions:
  - `ContentStatus` type: `"full_text" | "html_markdown" | "pdf_link_only" | "metadata_only" | "unavailable"` (with JSDoc)
  - `CourtDecision.contentStatus?: ContentStatus` — describes content richness available for a decision
  - `CourtDecision.quoteUsable?: boolean` — whether the decision text may be quoted in output

- **`src/benchmark/benchmarkRunner.ts`** additions:
  - `VerifiedPrecedentAuditEntry` gains `contentStatus: ContentStatus | null` and `quoteUsable: boolean`
  - `buildVerifiedPrecedentAudit` derives `contentStatus` from `fullTextAvailable` + `reasoningDetected` and `quoteUsable` from `eligibilityStatus === "precedent_usable"`
  - `BenchmarkReport` gains `liveReliabilityGate: LiveReliabilityGate`
  - `buildLiveReliabilityGateFromResults` helper wires report data → `ReliabilityGateInput` → `buildLiveReliabilityGate`
  - Markdown report gains **Live Reliability Gate** section showing gate result, hard failures, and soft observations

- **`package.json`**: `benchmark:doctor-questions:live-smoke` script — runs live benchmark with `--limit 5` for quick pre-release validation

- **`tests/reliabilityGate.test.ts`** — 11 pure unit tests:
  - gate passes with clean input
  - each of the 4 hard failures individually trips `gatePassed = false`
  - multiple hard failures accumulate correctly
  - `TIMEOUT`, `RATE_LIMIT` observations do not trip gate
  - `INSUFFICIENT_SUFFICIENCY` observation counts insufficient records
  - scalar fields pass through correctly

### No Breaking Changes

- `CourtDecision.contentStatus` and `quoteUsable` are optional — existing adapters and tests unaffected
- `liveReliabilityGate` is additive to `BenchmarkReport`; existing consumers that don't read it are unaffected

---

## [0.25.0] — 2026-05-23 — Live Timeout / Retry Hardening

> Tag: `v0.25.0-live-timeout-retry-hardening`

### Added

- **`src/live/requestPolicy.ts`** — Pure utility module; no network calls, no external dependencies.
  - `LiveRequestErrorKind` union: `timeout | network | rateLimit | serverError | clientError | zeroResult | parseError | unknown`
  - `LiveRequestPolicy` interface: `timeoutMs`, `maxRetries`, `backoffBaseMs`, `backoffMaxMs`, `jitterFactor`
  - `SOURCE_POLICIES` — per-source tuned policies:
    - `mevzuat-search`: 8 s timeout, 2 retries
    - `mevzuat-pdf`: 30 s timeout, 1 retry
    - `bedesten-search`: 12 s timeout, 2 retries
    - `bedesten-fulltext`: 20 s timeout, 1 retry
    - `danistay-search`: 15 s timeout, 2 retries
  - `DEFAULT_POLICY`: 15 s, 2 retries (fallback for unknown source names)
  - `policyForSource(sourceName)` — lookup with DEFAULT_POLICY fallback
  - `classifyLiveError(error, httpStatus?)` — priority-ordered error classification
  - `classifyZeroResult()` — explicit zero-result classification
  - `shouldRetry(kind, attemptsUsed, maxRetries)` — retry only transient kinds (timeout/rateLimit/serverError/network); never retries zeroResult/clientError/parseError/unknown
  - `computeBackoffMs(attempt, policy, random?)` — jittered exponential: `min(base×2^attempt, maxMs) ±jitterFactor`; injectable `random` for deterministic tests
  - `withTimeout(fetchImpl, url, init, timeoutMs)` — wraps any fetch call with an AbortController deadline; AbortError on expiry → classified as `"timeout"` by `classifyLiveError`
  - `executeWithRetry<T>(options)` — policy-governed retry loop with injectable `sleep` and `random`; returns `RetryResult<T>` with `value`, `succeeded`, `retryCount`, `totalBackoffMs`, `lastErrorKind`, `timedOut`, `lastError`

- **`src/sources/legislation/liveOfficialLegislationAdapter.ts`** wired:
  - `fetchWithAdaptiveBackoff` now accepts a `sourceName` parameter and wraps each fetch attempt with `withTimeout(this.fetchImpl, url, init, policy.timeoutMs)`
  - `searchOfficialLegislation` uses `"mevzuat-search"` policy (8 s timeout)
  - `getDocument` uses `"mevzuat-pdf"` policy (30 s timeout)
  - Timeout errors produce a `"source_error"` unavailable result with an explicit "timed out after Xms" message

- **`src/core/httpClient.ts`** wired:
  - `HttpClientOptions.timeoutMs?: number` — defaults to `policyForSource("bedesten-search").timeoutMs` (12 s)
  - `HttpRequestTelemetry.timedOut: boolean` — set to `true` when an AbortError is caught from the fetch
  - `requestJson` wraps the fetch inside `rateLimiter.schedule(() => withTimeout(...))` — timeout starts when the slot is acquired and the fetch begins
  - All `lastTelemetry` assignments include `timedOut`

- **`BenchmarkReport.liveTimeoutMetrics`** aggregate section (v0.25.0):
  - `timeoutCount` — query telemetry entries where `timedOut === true`
  - `rateLimitCount` — entries where `retryAfterMs > 0` (429 Retry-After honoured)
  - `transientFailureCount` — entries where `retryCount > 0`
  - `totalRetries` — sum of `retryCount` across all telemetry
  - `totalBackoffMs` — sum of `backoffMs` across all telemetry
  - `timedOutSources` — unique sources that produced at least one timeout

- **`tests/requestPolicy.test.ts`** — 48 new pure-function tests:
  - `policyForSource`: all 5 named sources, default fallback
  - `classifyLiveError`: AbortError, DOMException AbortError, TypeError, plain Error + null httpStatus, HTTP 429/500/503/404/400, parse error message pattern, unknown
  - `classifyZeroResult`: always returns `"zeroResult"`
  - `shouldRetry`: all 8 error kinds × retriable/non-retriable; max retries boundary; reason string completeness
  - `computeBackoffMs`: base/doubling/clamping; never negative; jitter range; integer output
  - `withTimeout`: resolves on time; AbortError fires when deadline exceeded; propagates pre-deadline rejection; does not mutate original init
  - `executeWithRetry`: success path; non-retriable failure; retry-to-success; max-retries exhaustion; timedOut flag; totalBackoffMs accumulation; lastError null/set
  - Total test count: **467** (was 419)

### Changed

- `HttpRequestTelemetry` — added `timedOut: boolean`; all error classes updated to default to `timedOut: false`

### Constraints Observed

- local-yargi is NOT imported; patterns reimplemented independently.
- No new live source integrations.
- No physician-facing output contract changes.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft.
- `DoctorLegalInformationPack` output format not modified.
- Router issue class list not changed.
- `exports/` and `.cache/` remain untracked.

---

## [0.24.0] — 2026-05-23 — Source Sufficiency Gate

> Tag: `v0.24.0-source-sufficiency-gate`

### Added

- **`src/sourceSufficiency.ts`** — Deterministic source sufficiency evaluator.
  - No LLM calls; no external network; pure function.
  - Input: router result, relevantLegislation, verifiedPrecedents, contractPassed, unofficialSourceDetected, usedMockSourceInLiveMode, auditOk.
  - Output: `SourceSufficiencyResult` with level (`sufficient` / `partial` / `insufficient`), `missingAuthorityTypes`, `reasons`, issue IDs, counts, flags, and `canComposeResearchPack`.

- **`SourceSufficiencyLevel`** type: `"sufficient" | "partial" | "insufficient"`.

- **`MissingAuthorityType`** taxonomy (6 types):
  - `legislation` — no official legislation retrieved
  - `highCourtPrecedent` — no verified high-court decision
  - `fullTextReasoning` — precedents lack full-text gerekçe
  - `issueSpecificMatch` — retrieved sources do not thematically match routed issues
  - `officialSourceTrace` — no gov.tr sourceTrace on legislation, or unofficial/mock source
  - `verifiedPrecedentEligibility` — all precedents are metadata-only / procedural-only / no-reasoning

- **Sufficiency level logic**:
  - `sufficient`: legislation + quote + article number + gov.tr sourceTrace + verified precedent + full-text reasoning + no unofficial/mock source + contract passed + not unclear_or_mixed — all met.
  - `partial`: legislation present, no hard blocker, but one or more criteria missing (no precedent, weak full-text, failed contract, issue-specific mismatch).
  - `insufficient`: no legislation, OR unofficial source detected, OR mock fallback in live mode, OR all precedents ineligible.
  - `canComposeResearchPack`: true iff legislation is present and no hard blocker.

- **`BenchmarkItemResult`** new fields (v0.24.0):
  - `sourceSufficiencyLevel` — level for this question
  - `missingAuthorityTypes` — array of missing authority type IDs
  - `sourceSufficiencyReasonCount` — count of diagnostic reasons
  - `canComposeResearchPack` — boolean

- **`BenchmarkReport.sourceSufficiencyMetrics`** aggregate section:
  - `sourceSufficiencyDistribution` — `{sufficient, partial, insufficient}` counts
  - `insufficientSourceCount`
  - `partialSourceCount`
  - `sufficientSourceCount`
  - `missingAuthorityTypeDistribution` — frequency map by authority type
  - `cannotComposeResearchPackCount`

- **`tests/sourceSufficiency.test.ts`** — 29 new pure-function tests:
  - sufficient: all criteria met → level, fields, missing count
  - partial: legislation + no precedent; legislation + contract fail; mixed eligibility statuses
  - insufficient: no legislation; unofficial source; mock in live mode; all-metadata-only/procedural-only
  - unclear_or_mixed + no legislation → insufficient
  - canComposeResearchPack false/true conditions
  - Issue-specific legislation and precedent counting
  - missingAuthorityTypes no-duplicate invariant
  - Safety invariants: no forbidden phrases in reasons/warnings
  - Total test count: **419** (was 390)

### Mock Benchmark Diagnostics (v0.24.0)

In mock mode all 15 questions score **partial** (expected):
- Legislation is present → no "insufficient"
- Mock legislation carries no sourceTrace → `officialSourceTrace` missing
- No verified court decisions in mock pack → `highCourtPrecedent` missing
- `canComposeResearchPack: true` for all 15 (legislation exists, no hard blocker)

In live mode with properly retrieved sources, `sufficient` is expected for well-matched queries.

### Constraints Observed

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No local-yargi module or fork.
- No new live source integration.
- `DoctorLegalInformationPack` output format not modified.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft.
- Router issue class list not changed.
- `officialLegislationCoverage` metrics preserved (5 covered, 16 clusters, 3 gaps).
- `exports/` and `.cache/` remain untracked.

---

## [0.23.0] — 2026-05-23 — Medical Issue Router

> Tag: `v0.23.0-medical-issue-router`

### Added

- **`src/medicalIssueRouter.ts`** — Deterministic, keyword-driven medical issue router.
  - No LLM calls; no external network; pure function.
  - Covers **16 issue categories**: `informed_consent`, `medical_records`, `privacy_kvkk`, `emergency_care`, `referral_consultation`, `malpractice_complication`, `disciplinary_admin`, `patient_rights`, `criminal_liability`, `civil_compensation`, `private_health_facility`, `professional_scope_of_practice`, `workplace_employee_health`, `prescription_report`, `death_postmortem`, `unclear_or_mixed`.
  - Per-issue: normalised phrase matching (+3 each) + keyword matching (+1 each); confidence thresholds: high ≥ 5, medium ≥ 2, low ≥ 1.
  - Supports **multi-label routing** (a single question may map to several issue axes).
  - Output per route: `issueId`, `label`, `confidence`, `score`, `matchedTerms`, `reason`, `suggestedTopicClusters`, `suggestedCourtSearchTerms`.
  - Top-level output: `normalizedQuestion`, `routes[]`, `primaryIssueId`, `missingInfoHints`, `routerWarnings`.
  - Turkish diacritic normalization via shared `normalizeText` from `precedentRelevance.ts`.
  - Integrates with v0.22.0 topic clusters: `private_health_facility`, `professional_scope_of_practice` used in route output.
  - **Safety invariants enforced**: no risk level, no definitive legal opinion, no action instructions, no petition/defence draft in any output field.

- **`BenchmarkItemResult`** new fields (v0.23.0):
  - `routedIssueIds` — issue IDs matched for this question
  - `primaryIssueId` — top-scoring issue
  - `routerConfidence` — confidence of the primary route
  - `routerMissingInfoHintCount` — number of missing-info hints returned

- **`BenchmarkReport.routerMetrics`** aggregate section:
  - `routedIssueCoverage` — frequency map of each issue ID across all questions
  - `lowConfidenceRouteCount` — questions where primary confidence is "low"
  - `unclearOrMixedCount` — questions routed to `unclear_or_mixed`
  - `multiIssueQuestionCount` — questions matching more than one issue
  - `primaryIssueDistribution` — frequency map of primary issue IDs

- **`tests/medicalIssueRouter.test.ts`** — 37 new pure-function tests:
  - All 15 issue types with representative Turkish physician questions
  - Multi-issue questions (onam + epikriz, disiplin + tazminat)
  - Empty / whitespace / vague input → `unclear_or_mixed`
  - Output contract validation (fields, types, ordering)
  - Safety invariants (no forbidden content in any output field)
  - Topic cluster alignment with v0.22.0 clusters
  - Turkish diacritic normalization symmetry
  - Total test count: **390** (was 353)

### Constraints Observed

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No local-yargi module or fork.
- No new live source integration.
- Physician-facing output contract (`DoctorLegalInformationPack`) not modified.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft.
- Benchmark dataset not enlarged (router runs on existing 15 questions).
- `officialLegislationCoverage` metrics preserved (5 covered, 16 clusters, 3 gaps).
- `exports/` and `.cache/` remain untracked.

---

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
