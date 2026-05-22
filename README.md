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

v0.3 wires the live official legislation adapter into optional MCP tool flows:

- adapter: `LiveOfficialLegislationAdapter`
- official source: T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi at `mevzuat.gov.tr`
- search capability: official `MevzuatDatatable` search request parser
- full-text capability: official `MevzuatMetin` document retrieval
- current extraction proof: PDF text extraction and article splitting for mapped legislation

The live smoke proof uses the official PDF form of `6698` article `6` for personal health
data questions. Patient-rights and informed-consent questions now use the official generated
PDF path for Hasta Haklari Yonetmeligi `4847`, including mapped articles `24` and `26`.
Initial health-law hints also cover medical intervention, privacy, and physician obligation
topics. When an official document does not arrive in an extractable format or a mapped
article cannot be extracted, the live adapter returns structured `unavailable` output instead
of creating a provision.

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
- live official legislation adapter for v0.2 source verification
- MCP `sourceMode` routing for live legislation in v0.3
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
