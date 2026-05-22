# Physician Legal MCP

`physician-legal-mcp` is a standalone TypeScript/Node.js MCP skeleton for source-grounded
legal information packs aimed at physicians. It does not tell a physician what to do and
does not provide a final legal opinion. It matches a question to official legislation text
and reasoned high court decision text available through source adapters.

The first version uses mock adapters only. The adapter boundaries are prepared for:

- `legislation`
- `yargitay`
- `danistay`
- `aym`

General internet articles, blogs, news, law firm marketing pages, and forums are not source
inputs for this project.

## MVP Scope

The skeleton includes:

- MCP server registration and tool handler scaffolding
- type contracts for official legislation evidence, court decision evidence, classification,
  precedent status, and the legal information pack
- mock legislation and high court adapters
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

- live official source clients
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

## Development

```powershell
npm install
npm test
npm run build
npm run smoke -- "Aydinlatilmis riza kaydi eksikse hangi resmi kaynaklar eslesir?"
npm run dev:mcp
```

After `npm run build`, run the compiled stdio MCP server with:

```powershell
npm run mcp
```
