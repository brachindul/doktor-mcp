#!/usr/bin/env tsx
/**
 * T35.4 — Canlı eksen kapsama nightly raporu
 *
 * Runs 8 core axes through live adapter and reports:
 * - Which legislation arrived / didn't
 * - Flakiness rate (3 retries per axis)
 *
 * Usage: npm run report:axis-coverage
 * Output: exports/axis-coverage/axis-coverage-YYYY-MM-DD.json
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LiveOfficialLegislationAdapter } from "./sources/legislation/liveOfficialLegislationAdapter.js";

const AXIS_QUERIES: Record<string, string> = {
  disiplin: "disiplin soruşturması hekim hakları",
  malpraktis: "hekim hatası tıbbi malpraktis",
  tayin: "kamu hastanesi hekim tayin atama",
  gizlilik: "hasta bilgisi mahremiyet paylaşım",
  riza_onam: "aydınlatılmış onam hasta rızası",
  acil_mudahale: "acil müdahale hasta reddi",
  ek_odeme: "performans ek ödeme hekim",
  mecburi_hizmet: "mecburi hizmet yükümlülüğü"
};

const RETRIES = 3;

interface AxisCoverage {
  axis: string;
  query: string;
  retries: {
    ok: boolean;
    provisionCount: number;
    legislationNames: string[];
    errorMessage?: string;
  }[];
  flakinessRate: number; // % of retries that succeeded
  averageProvisionCount: number;
}

async function runAxis(axis: string, query: string): Promise<AxisCoverage> {
  const retries: AxisCoverage["retries"] = [];
  const adapter = new LiveOfficialLegislationAdapter();

  for (let i = 0; i < RETRIES; i++) {
    try {
      const result = await adapter.getMappedHealthProvisions(query);
      if (result.status === "ok" && result.provisions.length > 0) {
        retries.push({
          ok: true,
          provisionCount: result.provisions.length,
          legislationNames: result.provisions.map((p) => p.documentId ?? "unknown")
        });
      } else {
        retries.push({
          ok: false,
          provisionCount: 0,
          legislationNames: [],
          errorMessage: result.status === "unavailable" ? result.message : "no provisions"
        });
      }
    } catch (err) {
      retries.push({
        ok: false,
        provisionCount: 0,
        legislationNames: [],
        errorMessage: err instanceof Error ? err.message : String(err)
      });
    }
    // Small delay between retries
    await new Promise((r) => setTimeout(r, 500));
  }

  const okCount = retries.filter((r) => r.ok).length;
  const totalProvisions = retries.reduce((sum, r) => sum + r.provisionCount, 0);

  return {
    axis,
    query,
    retries,
    flakinessRate: Math.round((okCount / RETRIES) * 100),
    averageProvisionCount: Math.round((totalProvisions / RETRIES) * 10) / 10
  };
}

async function main() {
  const exportsDir = join(process.cwd(), "exports", "axis-coverage");
  if (!existsSync(exportsDir)) {
    mkdirSync(exportsDir, { recursive: true });
  }

  console.log("=== Axis Coverage Report (Live) ===\n");

  const results: AxisCoverage[] = [];
  for (const [axis, query] of Object.entries(AXIS_QUERIES)) {
    console.log(`Running ${axis}...`);
    const result = await runAxis(axis, query);
    results.push(result);
    console.log(`  ${result.flakinessRate}% stable, avg ${result.averageProvisionCount} provisions`);
  }

  // Summary
  const stableAxes = results.filter((r) => r.flakinessRate === 100).length;
  const unstableAxes = results.filter((r) => r.flakinessRate < 100).length;
  console.log(`\n=== Summary: ${stableAxes} stable, ${unstableAxes} unstable ===`);

  // Write report
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const reportPath = join(exportsDir, `axis-coverage-${dateStr}.json`);
  writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nReport written to ${reportPath}`);
}

main();
