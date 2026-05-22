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

## Development

```powershell
npm install
npm test
npm run build
npm run smoke -- "Aydinlatilmis riza kaydi eksikse hangi resmi kaynaklar eslesir?"
npm run smoke:legislation -- "kisisel saglik verisi mahremiyet"
npm run smoke:legislation -- "aydınlatılmış rıza"
npm run smoke:mcp -- "kişisel sağlık verisi mahremiyet" -- --sourceMode live
npm run dev:mcp
npm run smoke:mcp -- "hasta haklari tibbi mudahale" -- --sourceMode live
npm run smoke:mcp -- "acil mudahale hekim yukumlulugu" -- --sourceMode live
```

`smoke:legislation` prints JSON. On success it includes the extracted official provisions,
the composed pack, and `quoteMatchesProvisionText: true`. On live-source failure it prints
the structured `unavailable` result. Mock legislation remains the default MCP service path
for existing callers unless `sourceMode: "live"` is supplied. `smoke:mcp` calls the same
MCP handler flow as `prepare_doctor_legal_information_pack` and prints JSON. Yargitay,
Danistay, and AYM adapters are still mock adapters.

After `npm run build`, run the compiled stdio MCP server with:

```powershell
npm run mcp
```
