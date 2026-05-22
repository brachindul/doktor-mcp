# Pack Audit

The pack audit tool validates a `DoctorLegalInformationPack` JSON for compliance with MVP safety constraints.

## Usage

```bash
npm run audit:pack -- path/to/pack.json
```

Exit code 0 = pack is clean. Exit code 1 = errors found.

## What Is Checked

### Errors (block lawyer review)

1. Every `relevantLegislation` item must have a non-empty `sourceDocumentId`
2. No MVP-out-of-scope fields may be present:
   - `riskLevel`, `immediateActions`, `finalLegalOpinion`
   - `riskSeviyesi`, `derhalYapilacaklar`, `kesinHukukiKanaat`, `dilekseTaslagi`
3. No `selectedPrecedents` entry may have an excluded eligibility status:
   - `metadata_only`, `procedural_only`, `no_reasoning`

### Warnings (advisories, not blocking)

1. `selectionDiagnostics` missing — run in live sourceMode to populate
2. `precedentDiagnostics` missing — call `buildPrecedentSelectionDiagnostics` before packing
3. `precedentDiagnostics.sourceSummaries` missing or not an array
4. `sourceWarnings` present — review and address if possible

## Output Format

```json
{
  "tool": "audit_pack",
  "file": "path/to/pack.json",
  "result": {
    "ok": true,
    "errors": [],
    "warnings": [],
    "checkedCounts": {
      "legislationItems": 3,
      "legislationWithSourceTrace": 3,
      "precedents": 1,
      "excludedDecisions": 0,
      "sourceSummaries": 3
    },
    "recommendedNextStep": "Pack is clean. Ready for lawyer review."
  }
}
```

## Safety Constraints Reminder

- Model must not invent court decisions from its own knowledge
- No full text → no precedent
- No legal reasoning → no precedent
- Bare affirmance/reversal → excluded
- Metadata-only → excluded
- No health law connection → excluded
- No risk level, no immediate actions, no final legal opinion, no petition drafts
