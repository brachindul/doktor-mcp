# Live Source Calibration

This document describes the calibration status of each court decision source and how to
advance a source from `synthetic_only` to `verified_live`.

## Calibration Status Values

| Status | Meaning |
|--------|---------|
| `verified_live` | Confirmed working with real endpoint in a network-capable environment |
| `fixture_verified` | Tested against a saved real fixture (raw body in `fixtures/raw/`) |
| `synthetic_only` | Only tested with synthetic (hand-crafted) data |
| `unavailable_in_environment` | DNS resolution fails in this environment |
| `fetch_error` | Network-level failure (not DNS); endpoint may be blocked by firewall |
| `html_shell_response` | HTTP 200 but non-JSON HTML shell (SPA); real API endpoint unknown |
| `needs_browser_capture` | Endpoint returns SOAP/XML or requires browser session; real JSON API must be discovered |
| `captcha_or_block` | CAPTCHA or bot-detection response |
| `reachable_json` | Endpoint returns JSON; field mapping may still need calibration |

## Current Status (v0.12, confirmed 2026-05-22)

| Source | Calibration Status | Endpoint | Notes |
|--------|--------------------|----------|-------|
| **Yargıtay** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` | Active unified Bedesten API. |
| **Danıştay** | `reachable_json` | `karararama.danistay.gov.tr/aramalist` | Active Aramalist API. |
| **AYM** | `synthetic_only` | N/A | Mock adapter only. No live endpoint. |

## How to Advance Calibration

### Step 1: Probe
```powershell
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay --save-fixture
npm run probe:precedents -- "hizmet kusuru tıbbi müdahale" -- --source danistay --save-fixture
```

This saves a sanitized shape fixture (no raw body) to `fixtures/live-samples/`.

### Step 2: Browser DevTools capture (for SOAP/HTML endpoints)

For Danıştay:
1. Open `https://karararama.danistay.gov.tr` in a browser.
2. Open DevTools → Network tab → Fetch/XHR.
3. Type a search query (e.g., `hizmet kusuru tıbbi müdahale`) and click Search.
4. Find the actual search request returning JSON decisions.
   - Look for request URL, method, headers, payload, response content-type, and response preview.
5. Save raw response body to `fixtures/raw/danistay-raw.json` (gitignored). Do not commit this file.
6. The raw body is saved ONLY in `fixtures/raw/`.

### Step 3: Update fixture
After capturing:
1. Update `fixtures/live-samples/danistay-synthetic.json`:
   - Set `_calibrationStatus` to `fixture_verified`
   - Update `_probeFindings` with real endpoint URL and field names
   - Update `data[]` with sanitized (IDs redacted) sample rows

### Step 4: Update calibrationStatus constant
In `src/sources/calibrationStatus.ts`, update:
```typescript
danistay: "fixture_verified"
```

## Raw Fixture Policy

- **Never commit `fixtures/raw/`** — it may contain real court decision data.
- `fixtures/raw/` is in `.gitignore`.
- Sanitize before committing: replace real IDs, redact personal references, keep only field names and shape.
- Sanitized fixtures in `fixtures/live-samples/` are safe to commit.

## Error Code Reference

When a live adapter fails to parse a response, `DecisionSourceTrace.error` contains:

| Code | Meaning |
|------|---------|
| `non_json_response:html_shell_response` | HTTP 200 + HTML SPA shell |
| `non_json_response:unexpected_html_response` | Login/large HTML requiring browser |
| `non_json_response:captcha_or_block` | CAPTCHA detected |
| `non_json_response:xml_soap_response` | SOAP/XML response |
| `non_json_response:empty_response` | Empty body |
| `response_read_failed` | Could not read response body at all |
| `fetch failed` | Network-level fetch failure |
