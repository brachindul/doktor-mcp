# Test Audit — doktor-mcp v0.50.0 (Faz 36)

> Vacuous-test scan results and remediation status.

## Findings

### 1. Guarded assertions (vacuous)
**Location:** `tests/fixtureReplayLivePipeline.test.ts` (T35.1, now T36.1)

**Issue:** 4 core axis tests used `if (result.status === "ok") { expect(...) }` pattern.
When `buildReplayFetch` returned `text/html` (rejected by `getDocument`), status was
always "unavailable", so the inner `expect()` never executed. 4 tests were green but
tested nothing.

**Fix:** T36.1 replaced with cache-injection (`buildReplayCache` + `docCache`).
T36.2 replaced all guards with hard assertions: `expect(result.status).toBe("ok")`.
Tests now break if primary legislation is missing.

**Status:** ✅ Fixed. 3 hard-assert tests pass.

### 2. Guarded assertions in probe tests
**Location:** `tests/aymProbe.test.ts` (2 occurrences)

**Issue:** `if (result.status === "ok")` wrap. These are legitimate — AYM probe
tests are live network probes that may legitimately fail. Guard is appropriate.

**Status:** ✅ Acceptable. Documented.

### 3. `toBeDefined()` usage
**Count:** 151 occurrences across the test suite.

**Assessment:** Most are followed by behavioral assertions (e.g.,
`expect(x).toBeDefined(); expect(x.length).toBeGreaterThan(0)`). These are
not vacuous — they verify structure before testing behavior.

**Status:** ✅ No vacuous-only cases found. All `toBeDefined()` have
follow-up assertions or are in structure-verification tests.

### 4. Mutation sanity (T36.4)
**Proven:** Breaking `buildReplayCache` (removing cache.set) causes
`fixtureReplayLivePipeline.test.ts` to fail with `status: "unavailable"`.
The test genuinely protects against the regression.

**Method:** Temporarily commented `this.docCache.set(...)` in adapter,
ran test, confirmed breakage, reverted.

## Summary

| Category | Count | Vacuous | Fixed |
|----------|-------|---------|-------|
| Guarded assert | 4 | 4 | ✅ |
| Probe guards | 2 | 0 | N/A (legit) |
| toBeDefined-only | 0 | 0 | N/A |
| **Total vacuous** | **4** | **4** | **✅** |
