# Pack Audit

The pack audit tool validates a `DoctorLegalInformationPack` JSON for compliance with
MVP safety constraints before it is sent to lawyer review.

## Usage

```powershell
# Generate a pack (mock mode)
npx tsx -e "
import { DoktorMcpInformationService } from './src/app/service.js';
import { writeFile } from 'node:fs/promises';
const svc = new DoktorMcpInformationService();
const pack = await svc.prepareInformationPack({ question: 'aydınlatılmış rıza' });
await writeFile('fixtures/sample-pack.json', JSON.stringify(pack, null, 2));
"

# Audit the pack
npm run audit:pack -- fixtures/sample-pack.json
```

## Checks

### Errors (block lawyer review)

| Check | Description |
|-------|-------------|
| MVP-out-of-scope fields | `riskLevel`, `immediateActions`, `finalLegalOpinion`, `riskSeviyesi`, `derhalYapilacaklar`, `kesinHukukiKanaat`, `dilekseTaslagi` must not appear |
| Missing `sourceDocumentId` | Every `relevantLegislation` item must have a `sourceDocumentId` |
| Excluded status in selectedPrecedents | No entry in `precedentDiagnostics.selectedPrecedents` may have status `metadata_only`, `procedural_only`, or `no_reasoning` |
| `fullTextAvailable: false` on verified precedent | If a verified precedent has a `decisionSourceTrace`, it must have `fullTextAvailable: true` |
| Wrong `eligibilityStatus` on verified precedent | If a verified precedent has a `decisionSourceTrace`, its `eligibilityStatus` must be `precedent_usable` |

### Warnings (should be addressed before review)

| Warning | Description |
|---------|-------------|
| Missing `selectionDiagnostics` | Present only in live legislation mode |
| Missing `precedentDiagnostics` | Should always be present |
| Missing `sourceSummaries` | Should be inside `precedentDiagnostics` |
| Unavailable source in `sourceSummaries` | One or more court adapters failed; 0 live precedents from that source |
| `sourceWarnings` present | Pack-level source warnings exist |

## Output Format

```json
{
  "tool": "audit_pack",
  "file": "fixtures/sample-pack.json",
  "result": {
    "ok": true,
    "errors": [],
    "warnings": [
      "selectionDiagnostics is missing. Run in live sourceMode to populate it.",
      "Source \"yargitay\" is unavailable in precedentDiagnostics.sourceSummaries (errorCodes: [\"source_error\"])."
    ],
    "checkedCounts": {
      "legislationItems": 2,
      "legislationWithSourceTrace": 2,
      "precedents": 0,
      "excludedDecisions": 0,
      "sourceSummaries": 3,
      "unavailableSources": 2
    },
    "recommendedNextStep": "Pack has 2 warning(s) but no errors. Address warnings before lawyer review."
  }
}
```

- `ok: true` with warnings = ready for review (address warnings if possible)
- `ok: false` = must fix errors before sending to lawyer

## Safety Constraints

The audit enforces the permanent project constraints:

- No risk level scoring
- No immediate action instructions
- No final legal conclusions
- No petition or defense drafts
- No model-invented court decisions
- Only `precedent_usable` decisions in `verifiedHighCourtPrecedents`
- Full text required for all verified precedents

## CI Integration

The audit exits with code 0 when `ok: true`, and with code 1 when `ok: false`.
It is designed to be deterministic — same input always produces same output.

```powershell
npm run audit:pack -- fixtures/sample-pack.json
# Exit code 0 = ok, Exit code 1 = errors found
```
