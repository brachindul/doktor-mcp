# Security Review — doktor-mcp v0.47.1 (Faz 26)

> Last updated: 2026-06-01
> Scope: SSRF, PII, output safety, dependency audit

## 1. SSRF (Server-Side Request Forgery)

### External Calls
- `LiveOfficialLegislationAdapter` → `mevzuat.gov.tr` (HTTPS only, official Turkish legislation portal)
- `LiveYargitayAdapter` → `yargitay.gov.tr` (HTTPS only)
- `LiveDanistayAdapter` → `danistay.gov.tr` (HTTPS only)
- `LiveBedestenAdapter` → `bedesten.adalet.gov.tr` (HTTPS only)

### Mitigations
- All URLs are hardcoded constants (`BEDESTEN_BASE_URL`, `YARGITAY_BASE_URL`, etc.) — no user-controlled URL injection.
- `HttpClient` uses fixed `baseUrl` with path append only; no open redirects.
- Cloudflare fallback uses browser-like headers for PDF requests.
- `requestPolicy.ts` enforces per-source timeouts (e.g., `legislation-direct` 25s, `bedesten-search` 10s).

### Status: ✅ Low risk — no user-controlled URLs, all hardcoded trusted endpoints.

---

## 2. PII (Personally Identifiable Information)

### Data in Pack
- `DoctorLegalInformationPack` structure: legislation provisions, verified precedents, legal classification.
- No personal data fields exist in any pack contract.
- `shortAnswer` is source-grounded, never contains patient-specific data.

### KVKK Coverage
- `privacy_kvkk` classification dimension applied only when questions mention privacy (KVKK 6698, personal data, patient privacy).
- Tests verify KVKK content does not leak into non-KVKK packs (`safetyInvariants.test.ts`).

### Logging
- No PII logged to console or files.
- Cache files (`.cache/`) store legislation queries and precedent responses — no user data.

### Status: ✅ Low risk — no PII collection, storage, or transmission.

---

## 3. Output Safety

### Hard-Blocked Phrases
Defined in `src/mcp/formatDoctorPackResponse.ts`:
- `kesin olarak sorumlusunuz`, `kesin beraat eder`, `kesin hukuki kanaat`
- `derhal şunu yapın`, `şu cezayı alırsınız`, `dilekçe taslağı`
- Plus 7 more categorical legal advice patterns

### Forbidden Fields
Defined in `src/benchmark/doctorQuestions.ts`:
- `riskLevel`, `immediateActions`, `finalLegalOpinion`, `riskSeviyesi`
- `derhalYapilacaklar`, `kesinHukukiKanaat`, `dilekseTaslagi`

### Tests
- `tests/forbiddenPhraseCalibration.test.ts` (13 tests) — unit-level phrase detection
- `tests/safetyInvariants.test.ts` (9 tests) — pack-level safety invariants
- `tests/adversarialSafety.test.ts` (17 tests) — adversarial pressure questions
- `tests/packContractAudit.test.ts` (57 tests) — contract field validation
- `tests/mvpSafety.test.ts` (5 tests) — MVP safety checks
- `tests/v1FinalChecklist.test.ts` (5 tests) — final checklist verification

### Disclaimer
- Every pack includes: `"Bu paket nihai hukuki kanaat değildir"`

### Status: ✅ Strong — multiple layers of phrase/field blocking with adversarial testing.

---

## 4. Dependency Audit

### Runtime Dependencies
- `@modelcontextprotocol/sdk` — MCP protocol implementation (MIT license)
- `zod` — Schema validation (MIT license)
- `commander` — CLI framework (MIT license)

### Dev Dependencies
- `vitest` — Test runner
- `typescript` — Type compiler
- `tsx` — TypeScript executor

### Notes
- No deprecated/abandoned packages.
- No packages with known critical CVEs at time of review.
- Regular `npm audit` recommended as CI step.

### Status: ✅ Low risk — small dependency surface, all maintained.

---

## 5. Summary

| Area | Risk | Status |
|------|------|--------|
| SSRF | Low | ✅ Hardcoded trusted endpoints |
| PII | Low | ✅ No PII collection |
| Output Safety | Low | ✅ Multi-layer blocking + disclaimer |
| Dependencies | Low | ✅ Small surface, maintained |
| **Overall** | **Low** | **✅ No critical findings** |

## 6. Recommendations

1. **CI**: Add `npm audit --audit-level=moderate` to CI pipeline.
2. **Rate Limiting**: Danıştay occasionally returns 429; implement exponential backoff (already partially done via `requestPolicy.ts`).
3. **Dependency Update**: Periodically update `@modelcontextprotocol/sdk` for protocol changes.
4. **Live Mode**: Consider adding mock response validation in live mode to catch unexpected response shapes.
