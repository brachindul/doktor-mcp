# Compatibility & Stability Policy

## Version 0.44.0 → 1.0 Transition

doktor-mcp is currently at **v0.44.0** (pre-1.0). The `responseVersion` field
(`"doctor-pack-response/v1"`) will be used to signal breaking changes.

## Stability Tiers

### 🔒 Stable (SemVer patch-level)
These fields are guaranteed stable. Changes are backward-compatible additions only:

| Field | Type | Since |
|-------|------|-------|
| `responseVersion` | `"doctor-pack-response/v1"` | v0.42.0 |
| `ok` | `boolean` | v0.42.0 |
| `status` | `"full_pack" \| "partial_pack" \| "no_pack_diagnostic"` | v0.42.0 |
| `summary.shortAnswer` | `string` | v0.42.0 |
| `summary.sourceSufficiency` | `"sufficient" \| "partial" \| "insufficient"` | v0.42.0 |
| `summary.verifiedLegislationCount` | `number` | v0.42.0 |
| `summary.verifiedPrecedentCount` | `number` | v0.42.0 |
| `summary.coverageGapCount` | `number` | v0.42.0 |
| `summary.timeoutOrRetrievalIssue` | `boolean` | v0.42.0 |
| `diagnostics.missingAuthorityTypes` | `string[]` | v0.42.0 |
| `diagnostics.coverageGaps` | `string[]` | v0.42.0 |
| `diagnostics.retrievalTimeouts` | `string[]` | v0.42.0 |
| `diagnostics.noPackReason` | `string?` | v0.42.0 |
| `diagnostics.gateObservations` | `string[]?` | v0.43.0 |

### 🧪 Experimental
These fields provide additional value but may change in minor releases:

| Field | Type | Status |
|-------|------|--------|
| `pack.relevantLegislation[].preliminaryAssessment` | object? | Experimental — structure may evolve; currently includes `summary` + `sentences[]` with `text`, `sourceRef`, `sourceLabel` |
| `pack.relevantLegislation[].inForce` | `boolean \| "unknown"` | Experimental — added v0.44.0 |
| `pack.relevantLegislation[].lastAmendedDate` | `string?` | Experimental — ISO date when available |
| `pack.relevantLegislation[].repealed` | `boolean?` | Experimental |
| `pack.precedentDiagnostics.dedupedCount` | `number?` | Experimental — added v0.44.0 |

### ⚠️ Internal / Diagnostic
These fields are for debugging. They may change without notice:

| Field | Notes |
|-------|-------|
| `pack.selectionDiagnostics` | Internal ranking diagnostics |
| `pack.precedentDiagnostics` (except `dedupedCount`) | Internal precedent selection data |
| `pack.sourceTrace` | Internal adapter trace data |
| `pack.sourceWarnings` | Warning messages — format not guaranteed |
| `diagnostics.gateObservations` | Observation strings — format not guaranteed |

## Deprecation Policy

1. **Announcement**: Deprecated fields are documented in `CHANGELOG.md` at least one
   minor version before removal.
2. **Grace period**: Minimum one minor version with both old and new fields available.
3. **Removal**: Deprecated fields are removed in the NEXT minor version after
   announcement with a `CHANGELOG.md` note.

## Breaking Changes

Breaking changes are signaled by bumping `responseVersion` (e.g., from
`"doctor-pack-response/v1"` to `"doctor-pack-response/v2"`). The MCP
`serverInfo.version` follows `package.json` version (currently 0.44.0).

A 1.0 release will:
- Freeze the stable tier
- Require a `responseVersion` bump for any breaking stable-tier change
- Follow strict SemVer (major.minor.patch)

## MCP Tool Compatibility

### Stable Tools
These tool names, input schemas, and output contracts are stable:
- `classify_medical_legal_question`
- `search_health_legislation`
- `get_legislation_provisions`
- `search_health_precedents`
- `filter_reasoned_precedents`
- `prepare_doctor_legal_information_pack`

### Experimental Parameters
These input parameters may change:
- `assessmentTone` — added v0.44.0, values: `"strict"` | `"grounded-advisory"` (default)

## Resource URIs

These MCP resource URIs are stable:
- `health-legislation://inventory`
- `doktor://calibration-status`

## Reporting Issues

Report compatibility issues or unexpected breaking changes via the project's
issue tracker.
