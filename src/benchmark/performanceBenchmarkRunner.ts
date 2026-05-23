/**
 * Performance benchmark runner.
 *
 * Runs the full doctor-questions benchmark suite twice:
 *   1. Cold run — shared cache starts empty (or is fresh). All queries hit the network.
 *   2. Warm run — immediately after cold run. Cache is populated; queries are served from cache.
 *
 * Produces cold vs warm comparison, slow-query diagnostics, and cache effectiveness metrics.
 * Does NOT emit final legal opinions, risk levels, or urgent action fields.
 */
import * as fs from "fs";
import * as path from "path";
import { PhysicianLegalInformationService } from "../app/service.js";
import { PrecedentCache } from "../sources/precedentCache.js";
import { doctorQuestions } from "./doctorQuestions.js";
import type { QueryAttemptTelemetry } from "../contracts/queryTelemetry.js";
import {
  buildPerformanceBenchmarkReport,
  generatePerformanceMarkdownReport
} from "./performanceMetrics.js";

export interface PerformanceBenchmarkOptions {
  /** Output directory for JSON + Markdown reports. */
  outDir: string;
  /** Limit questions for faster runs (default: all). */
  limit?: number;
  /** Cache TTL in ms. Defaults to 2h so warm run always hits within a benchmark session. */
  cacheTtlMs?: number;
  /** Cache directory. Defaults to .cache/precedents-perf. */
  cacheDir?: string;
}

async function runOnce(
  service: PhysicianLegalInformationService,
  questions: typeof doctorQuestions
): Promise<{ durationMs: number; startedAt: string; completedAt: string; telemetry: QueryAttemptTelemetry[] }> {
  const startMs = Date.now();
  const startedAt = new Date(startMs).toISOString();
  const allTelemetry: QueryAttemptTelemetry[] = [];

  for (const question of questions) {
    try {
      const pack = await service.prepareInformationPack({
        question: question.question,
        sourceMode: "live"
      });
      if (Array.isArray(pack.queryTelemetry)) {
        allTelemetry.push(...pack.queryTelemetry);
      }
    } catch {
      // Individual failures don't abort the benchmark
    }
  }

  const endMs = Date.now();
  return {
    durationMs: endMs - startMs,
    startedAt,
    completedAt: new Date(endMs).toISOString(),
    telemetry: allTelemetry
  };
}

export async function runPerformanceBenchmark(options: PerformanceBenchmarkOptions): Promise<void> {
  const { outDir, limit } = options;
  const cacheTtlMs = options.cacheTtlMs ?? 2 * 60 * 60 * 1000; // 2 hours
  const cacheDir = options.cacheDir ?? path.join(process.cwd(), ".cache", "precedents-perf");

  const questions = typeof limit === "number"
    ? doctorQuestions.slice(0, limit)
    : doctorQuestions;

  // Shared cache instance — cold run populates it, warm run reads from it
  const sharedCache = new PrecedentCache({ dir: cacheDir, ttlMs: cacheTtlMs });

  // ── Cold run ──────────────────────────────────────────────────────────────
  console.log("Starting cold run (cache is empty — all queries hit network)...");
  const coldService = new PhysicianLegalInformationService({ precedentCache: sharedCache });
  const cold = await runOnce(coldService, questions);
  console.log(`Cold run complete in ${cold.durationMs}ms. Telemetry: ${cold.telemetry.length} attempts.`);

  // ── Warm run ─────────────────────────────────────────────────────────────
  console.log("Starting warm run (cache should be warm from cold run)...");
  const warmService = new PhysicianLegalInformationService({ precedentCache: sharedCache });
  const warm = await runOnce(warmService, questions);
  console.log(`Warm run complete in ${warm.durationMs}ms. Telemetry: ${warm.telemetry.length} attempts.`);

  // ── Build report ─────────────────────────────────────────────────────────
  const report = buildPerformanceBenchmarkReport({
    timestamp: new Date().toISOString(),
    coldRunStartedAt: cold.startedAt,
    coldRunCompletedAt: cold.completedAt,
    warmRunStartedAt: warm.startedAt,
    warmRunCompletedAt: warm.completedAt,
    coldDurationMs: cold.durationMs,
    warmDurationMs: warm.durationMs,
    coldTelemetry: cold.telemetry,
    warmTelemetry: warm.telemetry
  });

  // ── Write reports ─────────────────────────────────────────────────────────
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "performance-benchmark-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outDir, "performance-benchmark-report.md"),
    generatePerformanceMarkdownReport(report),
    "utf8"
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n====================================================");
  console.log("Performance Benchmark Summary");
  console.log(`  Cold run:    ${cold.durationMs}ms  (${cold.telemetry.length} query attempts)`);
  console.log(`  Warm run:    ${warm.durationMs}ms  (${warm.telemetry.length} query attempts)`);
  const imp = report.improvementPercent;
  if (imp !== null) {
    const sign = imp >= 0 ? "+" : "";
    console.log(`  Improvement: ${sign}${imp}%`);
  }
  console.log(`  Cold p50/p95: ${report.cold.p50Ms ?? "N/A"}ms / ${report.cold.p95Ms ?? "N/A"}ms`);
  console.log(`  Warm p50/p95: ${report.warm.p50Ms ?? "N/A"}ms / ${report.warm.p95Ms ?? "N/A"}ms`);
  console.log(`  Warm cache hits: ${report.warm.cacheHitCount} / ${report.warm.queryAttempts}`);
  console.log(`  Retries: ${report.retryBackoffSummary.totalRetries}`);
  if (report.performanceWarnings.length > 0) {
    console.log(`  Warnings:`);
    for (const w of report.performanceWarnings) {
      console.log(`    ⚠️  ${w}`);
    }
  }
  console.log("====================================================");
  console.log(`\nReports written to ${outDir}/performance-benchmark-report.{json,md}`);
}
