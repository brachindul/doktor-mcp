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

**Source and endpoint:** Targets `https://emsal.yargitay.gov.tr/BilgiBankasiIslem` with a
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
    "url": "https://emsal.yargitay.gov.tr/BilgiBankasiIslem",
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

**Live source failure behavior:** If `emsal.yargitay.gov.tr` is unreachable or returns a
non-parseable response, the adapter returns a structured unavailable result:

```json
{
  "status": "unavailable",
  "source": "yargitay.gov.tr",
  "errorCode": "source_error",
  "message": "Yargıtay request failed: fetch failed",
  "retryable": true,
  "recommendedNextStep": "Retry after checking network access to emsal.yargitay.gov.tr.",
  "sourceTrace": [{ "query": "aydınlatılmış rıza", "searchRequest": { ... } }]
}
```

No decisions are invented. The pack continues to run with mock Danıştay and AYM results
and shows 0 selected precedents in `precedentDiagnostics` for the Yargıtay source.

Danıştay and AYM adapters remain mock adapters in v0.9.

## Development

```powershell
npm install
npm test
npm run build
npm run smoke -- "Aydinlatilmis riza kaydi eksikse hangi resmi kaynaklar eslesir?"
npm run smoke:legislation -- "kisisel saglik verisi mahremiyet"
npm run smoke:legislation -- "aydınlatılmış rıza"
npm run smoke:precedents -- "aydınlatılmış rıza" -- --sourceMode live
npm run smoke:mcp -- "kişisel sağlık verisi mahremiyet" -- --sourceMode live
npm run smoke:mcp -- "hasta haklari tibbi mudahale" -- --sourceMode live
npm run smoke:mcp -- "riza belgesi" -- --sourceMode mock
npm run dev:mcp
```

`smoke:precedents` calls `LiveYargitayAdapter.searchAndNormalize(query)` directly and
prints JSON including `sourceTraces` with `eligibilityStatus` for each candidate decision.
If the live source is unreachable, it prints the structured `unavailable` result with
`sourceTrace` showing what was attempted. JSON parse-ability is always preserved.

`smoke:mcp` calls the full `prepare_doctor_legal_information_pack` handler. With
`sourceMode: "live"` it uses both the live legislation and live Yargıtay adapters. Mock
legislation remains the default path. Danıştay and AYM remain mock adapters in all modes.

After `npm run build`, run the compiled stdio MCP server with:

```powershell
npm run mcp
```
