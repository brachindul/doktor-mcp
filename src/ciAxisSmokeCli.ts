#!/usr/bin/env tsx
/**
 * T27.4 — CI Axis Smoke Job
 *
 * Runs the recorded-fixture e2e test harness (network-free).
 * This is designed to be called from CI:
 *   npm run ci:axis-e2e
 *
 * Also supports LIVE=1 env var for optional live verification.
 */
import { execSync } from "node:child_process";

async function main() {
  console.log("=== CI Axis E2E Smoke ===");

  // Always run recorded fixture tests (network-free)
  console.log("\n[1/2] Running recorded fixture e2e tests...");
  execSync("npx vitest run tests/recordedFixtureE2E.test.ts tests/axisE2EPack.test.ts tests/gracefulDegradation.test.ts", {
    stdio: "inherit"
  });

  // Optional live verification
  if (process.env.LIVE === "1") {
    console.log("\n[2/2] LIVE=1 detected — running live smoke...");
    try {
      execSync("npx vitest run tests/goldenSetPublicPhysician.test.ts", {
        stdio: "inherit",
        timeout: 120_000
      });
    } catch {
      console.log("Live smoke failed (non-blocking) - check network/sources.");
      // Non-blocking — don't fail CI for live (per acceptance criteria)
    }
  } else {
    console.log("\n[2/2] LIVE not set — skipping live smoke (CI default: network-free).");
  }

  console.log("\n=== CI Axis E2E Smoke Complete ===");
}

main();
