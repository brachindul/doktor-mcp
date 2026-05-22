# Live Source Calibration

This document describes the calibration status of each court decision source and how to update it.

## Calibration Status Values

| Status | Meaning |
|--------|---------|
| `verified_live` | Confirmed working with real endpoint in this environment |
| `fixture_verified` | Tested against a saved real fixture |
| `synthetic_only` | Only tested with synthetic (hand-crafted) data |
| `unavailable_in_environment` | DNS / network blocked in this environment |
| `needs_browser_capture` | Endpoint requires browser session to work |

## Current Status

| Source | Status | Notes |
|--------|--------|-------|
| yargitay | `synthetic_only` | `emsal.yargitay.gov.tr` — run probe to verify |
| danistay | `synthetic_only` | `karararama.danistay.gov.tr` — run probe to verify |
| aym | `synthetic_only` | Mock-only; no live endpoint integration yet |

## How to Probe

```bash
# Probe Yargıtay
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay

# Probe Danıştay
npm run probe:precedents -- "hizmet kusuru tıbbi müdahale" -- --source danistay

# Probe both
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay,danistay

# Save a shape fixture (no raw content)
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay --save-fixture
```

## Probe Output Fields

The probe CLI outputs a JSON report per source with these fields:

- `httpStatus` — HTTP status code or null if DNS/network error
- `contentType` — response Content-Type header
- `redirected` — whether the request was redirected
- `blocked` — true if 401/403/429
- `captchaLike` — detected CAPTCHA or bot-blocking response
- `dnsError` — DNS resolution failure
- `fetchError` — any fetch-level error
- `responseShape` — structural summary (no raw content):
  - `isJson` / `isArray`
  - `hasDataField`, `hasResultsField`, `hasKararlarField`, `hasItemsField`
  - `topLevelKeys`, `itemCount`, `sampleItemKeys`
- `calibrationStatus` — one of: `reachable_json`, `reachable_non_json`, `source_blocked`, `http_error_NNN`, `captcha_detected`, `unavailable_in_environment`, `timeout`, `fetch_error`

## Raw Fixtures

Raw response bodies can be saved to `fixtures/raw/` with `--save-raw-fixture`. This directory is gitignored. Only shape fixtures in `fixtures/live-samples/` are committed.
