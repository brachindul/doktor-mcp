# Physician Legal MCP

`physician-legal-mcp` is a standalone TypeScript/Node.js MCP skeleton for source-grounded
legal information packs aimed at physicians. It does not tell a physician what to do and
does not provide a final legal opinion. It matches a question to official legislation text
and reasoned high court decision text available through source adapters.

The adapter boundaries are prepared for:

- `legislation`
- `yargitay`
- `danistay`
- `aym`

General internet articles, blogs, news, law firm marketing pages, and forums are not source
inputs for this project.

## Source Engine Port

v0.15.2 ports the local-yargi source-engine hardening needed by the live adapters:

- Bedesten requests use a shared `HttpClient` and `RateLimiter` path with bounded retry,
  `Retry-After` handling, exponential fallback backoff, jitter, and request telemetry.
- Live source failures stay structured and JSON-only. Source diagnostics can carry retry
  count, backoff time, status, and content type without writing logs into CLI JSON output.
- `src/sources/sourceRegistry.ts` exposes trimmed source capability, rate-limit, and cache
  policy metadata for legislation and precedent sources.
- Bedesten/Yargitay adapters keep metadata-only decisions out of verified precedent output;
  official legislation still returns structured unavailable results when official search,
  document retrieval, or article extraction cannot support a quote.

## Live Legislation Status

The live official legislation adapter is wired into optional MCP tool flows:

- adapter: `LiveOfficialLegislationAdapter`
- official source: T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi at `mevzuat.gov.tr`
- search capability: official `MevzuatDatatable` search request parser
- full-text capability: official `MevzuatMetin` document retrieval
- current extraction proof: PDF text extraction and article splitting for mapped legislation

v0.5 makes health legislation the first live mapping path. Patient-rights and
informed-consent questions use the official generated PDF path for Hasta Haklari
Yonetmeligi `4847`, including mapped articles `24` and `26`. Health-law mappings also
cover Tibbi Deontoloji Nizamnamesi, Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair
Kanun, and Saglik Hizmetleri Temel Kanunu. KVKK article `6` remains available for
personal-health-data and privacy questions as supporting general legislation after
health-specific sources.

When an official document does not arrive in an extractable format or a mapped article
cannot be extracted, the live adapter returns structured `unavailable` output instead of
creating a provision.

Live source failures use this contract:

```json
{
  "status": "unavailable",
  "source": "mevzuat.gov.tr",
  "errorCode": "provision_not_found",
  "message": "Official text was retrieved but the mapped article could not be extracted.",
  "retryable": false,
  "recommendedNextStep": "Inspect the official text parser before using this provision in an answer."
}
```

## MVP Scope

The skeleton includes:

- MCP server registration and tool handler scaffolding
- type contracts for official legislation evidence, court decision evidence, classification,
  precedent status, and the legal information pack
- mock legislation and high court adapters
- live official legislation adapter for official source verification
- MCP `sourceMode` routing for live legislation
- health-prioritized legislation mappings and source trace metadata
- health-law pipeline pieces:
  - question classifier
  - legislation mapper
  - precedent filter
  - answer composer
- local JSON smoke command
- Vitest coverage for the initial source-safety rules

The precedent filter currently exposes these statuses:

- `precedent_usable`: full text, legal reasoning, and event relevance are present
- `limited_value`: full text exists but relevance is weak
- `procedural_only`: no merits reasoning, procedural text, bare affirmance, or bare reversal
- `metadata_only`: citation metadata without full text
- `no_reasoning`: full text record without legal reasoning

Only `precedent_usable` records reach the verified precedent section in the composed pack.

## Response Contract

The structured pack is shaped around the requested physician-facing sections:

1. `shortAnswer`
2. `legalClassification`
   - `criminal`
   - `civilCompensation`
   - `disciplinaryAdministrative`
   - `patientRights`
   - `privacyKvkk`
   - `professionalEthics`
3. `relevantLegislation`
   - legislation name
   - article number
   - verbatim quote copied from the source provision
   - event connection
4. `verifiedHighCourtPrecedents`
   - court/chamber, date, merits/decision numbers
   - fact summary, legal assessment, outcome
   - similarity/difference note
5. `missingInformation`
6. `lawyerReviewPoints`

Every legislation entry carries a source document id and a verbatim source quote. Every
verified precedent entry must survive the reasoned-precedent filter.

## Intentionally Out Of Scope

The MVP does not include:

- live Yargitay, Danistay, or AYM high court clients
- risk level scoring
- immediate action instructions
- petition or defense drafting
- final legal conclusions
- statements such as "liability exists" or "liability does not exist"
- model-only legal propositions that are not confirmed by MCP source records

Rate limiting is reserved for live clients: the intended behavior is practical public-source
traffic with adaptive backoff after a real block or source error, not an aggressive throttle
before evidence of pressure.

## MCP Tools

- `classify_medical_legal_question`
- `search_health_legislation`
- `get_legislation_provisions`
- `search_health_precedents`
- `filter_reasoned_precedents`
- `prepare_doctor_legal_information_pack`

Legislation-facing MCP inputs accept optional `sourceMode`:

```json
{
  "question": "kişisel sağlık verisi mahremiyet",
  "sourceMode": "live"
}
```

`sourceMode` is `"mock"` by default, so v0.1/v0.2 mock behavior remains the default.
`search_health_legislation`, `get_legislation_provisions`, and
`prepare_doctor_legal_information_pack` can use `"live"`. A live information pack keeps
the same MVP shape and adds `sourceUnavailable` only when the official legislation source
cannot return a verified provision.

Mock mode uses local fixture provisions. Live mode uses official legislation text from
`mevzuat.gov.tr`; Yargitay, Danistay, and AYM precedent adapters remain mock in both modes.

## Health Legislation Priority

The live mapping layer groups physician questions into health-law topic clusters:

- informed consent / onam
- medical intervention
- patient rights
- patient privacy
- personal health data
- records, file, and epicrisis
- emergency intervention
- referral and consultation
- physician duty of care
- professional ethics

Each mapping carries the target legislation, target article numbers, search terms, a
selection reason, and a health-law priority. When more than one mapping matches, the
pack orders primary health legislation before supporting general legislation. For example,
a personal-health-data privacy question may return Hasta Haklari Yonetmeligi before KVKK;
KVKK is not used as a broad fallback for unrelated physician questions.

## Source Trace

`sourceTrace` audits live legislation output rather than supplying legal reasoning.
Each trace shows how a provision moved from a health-law mapping to an official document and
article extraction step:

- original `query`
- `matchedHealthMapping` and mapping candidates tried when no mapping matches
- `officialSearchRequest`, official search result count, and compact official results
- `selectedSearchResult` and `selectedResultReason`
- landing/detail URL and direct or generated PDF URL
- `contentType`, extraction method, extracted article numbers, and retrieval time

Live `search_health_legislation` includes the trace alongside selected provisions. Live
`get_legislation_provisions` carries trace on each returned provision. Live
`prepare_doctor_legal_information_pack` keeps trace both on relevant legislation entries
and the pack-level `sourceTrace` array, so the composed quote can be checked against the
same extracted provision.

An unavailable live pack also preserves audit context:

```json
{
  "sourceUnavailable": [
    {
      "status": "unavailable",
      "source": "mevzuat.gov.tr",
      "errorCode": "document_not_found",
      "sourceTrace": [
        {
          "query": "bilinmeyen konu",
          "matchedHealthMapping": null,
          "attemptedHealthMappings": ["mevzuat:7.5.4847", "mevzuat:1.5.6698"]
        }
      ]
    }
  ]
}
```

`matchedHealthMapping` and `selectedResultReason` show the topic cluster, health-law
priority, and whether the selected mapping is primary health legislation or supporting
general legislation. Trace fields explain source selection and extraction only. They do
not create legal propositions and never replace the verbatim official provision text.

## Provision Ranking

v0.6 adds deterministic live provision ranking after official article extraction. It
selects a compact set of source articles for the pack; it does not create article text,
legal advice, or legal conclusions.

Ranking signals include:

- physician query terms
- the matched health-law topic cluster
- mapping search terms
- article heading text when the extracted article starts with a usable heading
- keyword matches inside the extracted article text
- a mapped article-list bonus
- health-law priority and primary/supporting role ordering

Live trace shows `candidateArticleNumbers`, `rankedArticleNumbers`,
`rejectedArticleNumbers`, and `rankingMethod`. Each returned live provision also carries
its deterministic score, matched terms, ranking reasons, and whether it came from the
manual mapped article list. The live adapter limits a single legislation document to a
small ranked article set, currently at most three provisions. Extracted mapped articles
stay first; high-signal ranked fallback articles are considered only when the mapped
articles are absent from the extraction. Trace preserves both the selected and rejected
candidate trail.

KVKK remains `supporting_general` for personal-health-data and privacy questions. It does
not replace primary health legislation in ranking or pack ordering. Yargitay, Danistay,
and AYM adapters remain mock adapters.

## Selection Diagnostics

v0.7 adds `selectionDiagnostics` to live legislation MCP responses. It is the short audit
view for source selection: `sourceTrace` still contains the official request, document,
extraction, candidate, ranking, and unavailable detail, while diagnostics summarize what
was selected without requiring a full trace read.

The compact diagnostic includes:

- query and `sourceMode`
- selected legislation and provision counts
- each selected legislation role, topic cluster, priority, article numbers, rejected
  article-number summary, and selection reason
- each selected provision score, matched terms, top ranking reasons, and mapped-article flag
- unavailable and warning counts

Example live summary:

```json
{
  "selectionDiagnostics": {
    "query": "kisisel saglik verisi mahremiyet",
    "sourceMode": "live",
    "selectedLegislationCount": 2,
    "selectedProvisionCount": 2,
    "selectedLegislations": [
      {
        "legislationName": "Hasta Haklari Yonetmeligi",
        "legislationRole": "health_primary",
        "topicCluster": "patient_privacy",
        "selectedArticleNumbers": ["21"]
      },
      {
        "legislationName": "Kisisel Verilerin Korunmasi Kanunu",
        "legislationRole": "supporting_general",
        "topicCluster": "personal_health_data",
        "selectedArticleNumbers": ["6"]
      }
    ],
    "unavailableCount": 0
  }
}
```

Diagnostics are audit metadata only. They do not replace official provision quotes, do not
create legal propositions, and keep KVKK in its supporting-general role. Yargitay,
Danistay, and AYM adapters remain mock adapters.

## Decision Source Trace (v0.8)

`DecisionSourceTrace` audits the decision pipeline for each court decision candidate.
It is the precedent-side analogue of `LegislationSourceTrace`. Each trace carries:

- original `query`
- `source` and `court` (yargitay / danistay / aym)
- `searchRequest` (null for mock adapters)
- `searchResultsCount` and `selectedResult`
- `documentId` / `sourceId`
- `fullTextAvailable` and `fullTextRetrievalMethod`
- `retrievedAt`
- `eligibilityStatus` — the precedent filter outcome
- `eligibilityReasons` — positive criteria that the decision met
- `exclusionReasons` — the specific reason(s) it was excluded, if any
- `error` if retrieval failed

Decision source traces are audit metadata only. They do not produce legal reasoning and
never add a court decision to the pack unless the decision passes all eligibility criteria.

## Reasoned-Decision Eligibility (v0.8)

`assessDecisionEligibility` (in `src/health/decisionEligibility.ts`) applies the
precedent filter rules and returns a structured `EligibilityResult` with status,
positive eligibility reasons, and exclusion reasons.

A decision is **excluded** from the verified-precedents section when any of the following
apply:

- `fullTextAvailable: false` — full decision text is not available (→ `metadata_only`)
- `legalReasoning` is empty or missing (→ `no_reasoning`)
- Decision text contains a bare procedural marker: `salt onama`, `salt bozma`, `usul karar`
  (→ `procedural_only`)
- Legal reasoning is only `onama` or `bozma` without substantive content
  (→ `procedural_only`)
- No `relevanceNote` connecting the decision to the health-law event (→ `limited_value`)

Only `precedent_usable` decisions enter the `verifiedHighCourtPrecedents` section of the
pack. `limited_value`, `procedural_only`, `no_reasoning`, and `metadata_only` decisions
are excluded.

## Precedent Diagnostics (v0.8)

`PrecedentSelectionDiagnostics` is the compact audit view for decision selection,
analogous to `LegislationSelectionDiagnostics` on the legislation side. It appears as
`precedentDiagnostics` on every `prepare_doctor_legal_information_pack` response and in
the `filter_reasoned_precedents` tool response.

The diagnostic includes:

- `query` — the original question
- `selectedPrecedentCount` / `excludedDecisionCount`
- `selectedPrecedents[]` — court, chamber, date, docket/decision numbers, status,
  matched health topics, and eligibility reasons
- `excludedDecisions[]` — court, date, status, and exclusion reasons

Diagnostics summarize selection and exclusion only. They do not provide legal
interpretation and do not add any decision to the pack.

## Live Yargıtay Adapter (v0.9)

v0.9 adds the first live court decision adapter: `LiveYargitayAdapter`
(`src/sources/yargitay/liveYargitayAdapter.ts`). Danıştay and AYM remain mock adapters.

**Source and endpoint:** Targets `https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments` with a filtering by `YARGITAYKARARI`.
JSON POST body containing the health law search term. Retries up to three times with
adaptive back-off for 429 and 5xx errors.

**`sourceMode: "live"` precedent behavior:**

- `search_health_precedents` uses the live Yargıtay adapter; Danıştay and AYM remain mock.
- `prepare_doctor_legal_information_pack` with `sourceMode: "live"` searches live Yargıtay
  decisions in addition to live legislation.
- Health law search terms are mapped from the classified question: `riza/rıza/onam` →
  `"aydınlatılmış rıza"`, `tibbi/müdahale` → `"tıbbi müdahale"`, etc.
- Only `precedent_usable` decisions enter `verifiedHighCourtPrecedents`. All others are
  logged in `precedentDiagnostics.excludedDecisions` with their exclusion reasons.

**`DecisionSourceTrace` live example:**

```json
{
  "query": "aydınlatılmış rıza",
  "source": "yargitay",
  "court": "yargitay",
  "searchRequest": {
    "url": "https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments",
    "phrase": "aydınlatılmış rıza",
    "pageSize": 5
  },
  "searchResultsCount": 12,
  "selectedResult": { "documentId": "yargitay:99001" },
  "selectedResultReason": "Health law term 'aydınlatılmış rıza' matched Yargıtay emsal search.",
  "fullTextAvailable": true,
  "fullTextRetrievalMethod": "html-text",
  "retrievedAt": "2026-05-22T10:00:00.000Z",
  "eligibilityStatus": "precedent_usable",
  "eligibilityReasons": [
    "Tam karar metni mevcut.",
    "Hukuki gerekçe alanı dolu.",
    "Sağlık hukuku olayıyla bağlantı kurulmuş.",
    "Emsal olarak kullanılabilir."
  ],
  "exclusionReasons": []
}
```

**Live source failure behavior:** If `bedesten.adalet.gov.tr` is unreachable or returns a
non-parseable response, the adapter returns a structured unavailable result:

```json
{
  "status": "unavailable",
  "source": "yargitay.gov.tr",
  "errorCode": "source_error",
  "message": "Yargıtay request failed: fetch failed",
  "retryable": true,
  "recommendedNextStep": "Retry after checking network access to bedesten.adalet.gov.tr.",
  "sourceTrace": [{ "query": "aydınlatılmış rıza", "searchRequest": { ... } }]
}
```

No decisions are invented. The pack continues to run with mock Danıştay and AYM results
and shows 0 selected precedents in `precedentDiagnostics` for the Yargıtay source.

Danıştay and AYM adapters remain mock adapters in v0.9.

## Multi-Source Live Precedent Pipeline (v0.10)

v0.10 adds the live Danıştay adapter, a centralized health law query expansion module,
per-source diagnostics (`sourceSummaries`), and a file-based result cache.

### Live Danıştay Adapter

`LiveDanistayAdapter` (`src/sources/danistay/liveDanistayAdapter.ts`) targets
`https://karararama.danistay.gov.tr/aramalist`. It follows the
same retry, HTML full-text extraction, and eligibility assessment pattern as the Yargıtay
adapter. `court` is set to `"danistay"` and document IDs are prefixed `danistay:`.

The adapter uses `pickHealthLawQuery` from the centralized query expansion module instead
of maintaining its own term map.

### `precedentSources` Parameter

`prepare_doctor_legal_information_pack` and `search_health_precedents` now accept an
optional `precedentSources` array to select which courts are queried in live mode:

```json
{
  "question": "aydınlatılmış rıza",
  "sourceMode": "live",
  "precedentSources": ["yargitay", "danistay"]
}
```

Valid values: `"yargitay"`, `"danistay"`, `"aym"`. Default when omitted is all three.
AYM remains a mock adapter in v0.10.

When one source is unavailable, the others continue. The pack is never blocked on a single
adapter failure.

### Health Law Query Expansion (v0.10)

`src/health/healthLawQueryExpansion.ts` provides deterministic term mapping shared by
both the Yargıtay and Danıştay adapters:

- `riza` / `onam` / `aydinlat` → `"aydınlatılmış rıza"`
- `komplikasyon` → `"komplikasyon tıbbi müdahale"`
- `malpraktis` → `"malpraktis hekim kusur"`
- `hekim` → `"hekimin özen yükümlülüğü"`
- `hasta` → `"hasta hakları"`
- `veri` / `mahrem` → `"sağlık verisi mahremiyet"`
- `kusur` → `"hizmet kusuru tıbbi müdahale"`
- `acil` → `"acil müdahale hekim yükümlülüğü"`

`pickHealthLawQuery` returns the highest-priority mapped term for a classified question.
`pickHealthLawQueries` returns up to N distinct terms for multi-term searches.

### `sourceSummaries` in `precedentDiagnostics` (v0.10)

`PrecedentSelectionDiagnostics` now includes `sourceSummaries[]` with a per-source
breakdown:

```json
{
  "precedentDiagnostics": {
    "query": "aydınlatılmış rıza",
    "selectedPrecedentCount": 1,
    "excludedDecisionCount": 2,
    "sourceSummaries": [
      {
        "source": "yargitay",
        "mode": "live",
        "searched": true,
        "searchResultsCount": 5,
        "candidateCount": 2,
        "selectedCount": 1,
        "excludedCount": 1,
        "unavailableCount": 0,
        "errorCodes": []
      },
      {
        "source": "danistay",
        "mode": "live",
        "searched": false,
        "searchResultsCount": null,
        "candidateCount": 0,
        "selectedCount": 0,
        "excludedCount": 0,
        "unavailableCount": 1,
        "errorCodes": ["source_error"]
      }
    ]
  }
}
```

`selectedPrecedents[]` and `excludedDecisions[]` entries also now include a `source` field
(same value as `court`) to identify which adapter produced each decision.

### File-Based Cache (v0.10)

`PrecedentCache` (`src/sources/precedentCache.ts`) caches live adapter results to
`.cache/precedents/` with a one-hour TTL. Cache files are keyed by source, query, and
page size. Cache write failures are non-fatal.

`smoke:precedents` supports three cache flags:

```powershell
# Use cache (default)
npm run smoke:precedents -- "aydınlatılmış rıza"

# Skip cache reads and writes
npm run smoke:precedents -- "aydınlatılmış rıza" --no-cache

# Force a fresh fetch and overwrite the cache entry
npm run smoke:precedents -- "aydınlatılmış rıza" --refresh
```

`.cache/` is in `.gitignore` and is never committed.

## Precedent Source Calibration (v0.12)

v0.12 introduces deep probe analysis and normalizer hardening. See `docs/LIVE_SOURCE_CALIBRATION.md`
for the full calibration workflow.

### Confirmed endpoint behavior (2026-05-22)

| Source | Status | Endpoint |
|--------|--------|----------|
| **Yargitay** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` - active integration via Bedesten proxy. |
| **Danistay** | `reachable_json` | `karararama.danistay.gov.tr/aramalist` - active integration. |
| **Bedesten** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` - active unified integration. |
| **AYM** | `synthetic_only` | No live endpoint. Mock adapter only. |

### Probe CLI

```powershell
# Deep probe with HTML/SOAP analysis and fixture save
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay --save-fixture
npm run probe:precedents -- "hizmet kusuru tıbbi müdahale" -- --source danistay --save-fixture
```

Probe output includes: HTTP status, content-type, HTML/SOAP analysis (title, form actions,
endpoint hints, body length, captcha/login detection), `calibrationStatus`, and `recommendedNextStep`.

### Non-JSON response classification

When a live adapter receives a non-JSON response, `DecisionSourceTrace.error` contains:

| Code | Meaning |
|------|---------|
| `non_json_response:html_shell_response` | HTTP 200 + small HTML SPA shell |
| `non_json_response:unexpected_html_response` | Login/large HTML |
| `non_json_response:xml_soap_response` | SOAP/XML service response |
| `non_json_response:captcha_or_block` | CAPTCHA detected |
| `non_json_response:empty_response` | Empty body |

### Raw fixture policy

- `fixtures/raw/` is gitignored — never commit raw response bodies.
- `fixtures/live-samples/` holds sanitized/synthetic fixtures — safe to commit.
- See `fixtures/live-samples/README.md` for the sanitized fixture format.

### Pack audit extended checks (v0.12)

`audit:pack` now also checks:

- Unavailable sources in `sourceSummaries` → warning with error codes
- `decisionSourceTrace.fullTextAvailable === false` on a verified precedent → error
- `decisionSourceTrace.eligibilityStatus !== "precedent_usable"` on a verified precedent → error

See `docs/PACK_AUDIT.md` for the full check reference.

## Development

```powershell
npm install
npm test
npm run build
npm run smoke -- "Aydinlatilmis riza kaydi eksikse hangi resmi kaynaklar eslesir?"
npm run smoke:legislation -- "kisisel saglik verisi mahremiyet"
npm run smoke:legislation -- "aydınlatılmış rıza"

# Smoke both Yargıtay and Danıştay (default)
npm run smoke:precedents -- "aydınlatılmış rıza"

# Smoke specific sources
npm run smoke:precedents -- "hizmet kusuru" --precedentSources yargitay,danistay

# Cache control
npm run smoke:precedents -- "aydınlatılmış rıza" --no-cache
npm run smoke:precedents -- "aydınlatılmış rıza" --refresh

npm run smoke:mcp -- "kişisel sağlık verisi mahremiyet" -- --sourceMode live
npm run smoke:mcp -- "hasta haklari tibbi mudahale" -- --sourceMode live
npm run smoke:mcp -- "riza belgesi" -- --sourceMode mock
npm run dev:mcp
```

`smoke:precedents` queries live Yargıtay and Danıştay adapters in parallel, caches results,
and prints JSON including per-source `results` with `sourceTraces` and `eligibilityStatus`
for each candidate decision. If a source is unreachable, its structured `unavailable` result
is printed alongside the other source's output. JSON parse-ability is always preserved.

`smoke:mcp` calls the full `prepare_doctor_legal_information_pack` handler. With
`sourceMode: "live"` it uses both live legislation and live Yargıtay + Danıştay adapters.
The optional `precedentSources` parameter selects which adapters are used. AYM remains a
mock adapter.

After `npm run build`, run the compiled stdio MCP server with:

```powershell
npm run mcp
```

## Physician Question Benchmark Suite (v0.16.0)

v0.16.0 introduces a comprehensive quality evaluation and regression-testing benchmark suite specifically focused on typical physician-centric legal questions. 

### Purpose
- **Quality Measurement**: Systematically evaluate the performance, legislation mapping, precedent count, and schema conformity of 15-20 target questions across 15 separate medical-legal categories.
- **Regression Prevention**: Enforce strict safety constraints, such as ensuring `Kisisel Verilerin Korunmasi Kanunu (KVKK)` is not present in non-privacy packs, ensuring physician-centric deontology codes take precedence over general patient-rights in refusal situations, and ensuring live mode contains no mock-precedents fallback.

### How to Run

Use the benchmark runner script to execute tests and view report outputs:

```powershell
# Run the complete benchmark in mock mode (default)
npm run benchmark:doctor-questions

# Run in live mode (queries live legislation and precedents)
npm run benchmark:doctor-questions -- --sourceMode live

# Limit the run to first N questions
npm run benchmark:doctor-questions -- --limit 5

# Specify a custom report directory (default is exports/doctor-benchmark)
npm run benchmark:doctor-questions -- --out exports/my-custom-report
```

> [!WARNING]
> Running the benchmark in `--sourceMode live` makes actual HTTP requests to Cumhurbaşkanlığı Mevzuat (`mevzuat.gov.tr`) and high court services (`bedesten.adalet.gov.tr` and `karararama.danistay.gov.tr`). Ensure you have stable internet and keep request volume sensible to avoid rate limiting (HTTP 429) or IP throttling by these servers.

### Benchmark Reports & Exports
All execution runs generate two files in the `exports/doctor-benchmark/` directory (which is git-ignored):
- `doctor-benchmark-report.json`: Fully structured and parseable JSON report capturing exact details, prioritization lists, counts, and assertions.
- `doctor-benchmark-report.md`: A human-friendly Markdown report containing summaries, breakdown tables, passing/failing statuses, and detailed question statistics.

