# Live Sample Fixtures

This directory contains sanitized fixture files for testing normalizers and documenting
calibration status of live court decision sources.

## Fixture Types

| Type | Description | Committed? |
|------|-------------|-----------|
| `*-synthetic.json` | Synthetic data matching expected API shape. No real data. | Yes |
| `*-probe-*.json` | Shape-only probe results. No raw body content. | Yes |
| `fixtures/raw/` | Raw response bodies from real endpoints. May contain real data. | **No** (gitignored) |

## Sanitized Fixture Format

Each committed fixture must include:

```json
{
  "_note": "Description of what this fixture represents",
  "source": "yargitay | danistay",
  "capturedAt": "ISO 8601 timestamp or 'synthetic'",
  "calibrationStatus": "synthetic_only | fixture_verified | verified_live | unavailable_in_environment | needs_browser_capture",
  "httpStatus": null,
  "contentType": null,
  "responseShape": { ... },
  "normalizedResultPreview": [ ... ],
  "notes": "Any additional context about this fixture"
}
```

## Calibration Status Values

| Status | Meaning |
|--------|---------|
| `verified_live` | Confirmed working with real endpoint in a network-capable environment |
| `fixture_verified` | Tested against a real response fixture (raw body saved separately) |
| `synthetic_only` | Only tested with synthetic data; real response format not yet observed |
| `unavailable_in_environment` | DNS/network blocked in this environment (e.g., CI sandbox) |
| `needs_browser_capture` | Endpoint requires a browser session to capture the real XHR request |
| `html_shell_response` | Endpoint returns HTML shell (SPA); real API endpoint not yet identified |
| `fetch_error` | Network-level failure not caused by DNS |
| `reachable_json` | Endpoint responds with JSON; normalizer field mapping may need updating |

## How to Capture a Real Fixture

1. Open the target court website in a browser.
2. Open DevTools → Network tab → Fetch/XHR.
3. Perform a search.
4. Find the actual XHR/fetch request that returns JSON decisions.
5. Copy: URL, request method, headers, request body, and response body.
6. Save raw response to `fixtures/raw/<source>-raw.json` (gitignored).
7. Run the ingest command to generate a sanitized fixture:
   ```
   npm run ingest:fixture -- --source <source> --raw fixtures/raw/<source>-raw.json --query "query"
   ```
8. The sanitized fixture will be written to `fixtures/live-samples/<source>-captured-<date>.json`.
9. The script will automatically parse the shape, discard PII and large texts, and update calibrationStatus.

## Current Status (v0.12, confirmed 2026-05-22)

| Source | Status | Notes |
|--------|--------|-------|
| Yargıtay | `fetch_error` | `emsal.yargitay.gov.tr/BilgiBankasiIslem` fails at network level in this sandbox (not DNS — fetch fails). Real response format unknown. Known JSON API from emsal UI. Test from unrestricted network. |
| Danıştay | `needs_browser_capture` | `karararama.danistay.gov.tr/YargitayBilgiBankasiIstemciService` returns HTTP 200 with SOAP/XML (39KB), title: "Adalet Bakanlığı Bilgi İşlem Genel Müdürlüğü". This is a SOAP service descriptor, not the real JSON search API. Real JSON endpoint must be captured via browser DevTools. |
| AYM | `synthetic_only` | No live endpoint. Mock adapter only. |
