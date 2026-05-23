import { runPerformanceBenchmark } from "./performanceBenchmarkRunner.js";

async function main() {
  const args = process.argv.slice(2);

  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

  const outIndex = args.indexOf("--out");
  const outDir = outIndex !== -1 ? args[outIndex + 1] : "exports/doctor-benchmark";

  const ttlIndex = args.indexOf("--cacheTtlMs");
  const cacheTtlMs = ttlIndex !== -1 ? parseInt(args[ttlIndex + 1], 10) : undefined;

  console.log("====================================================");
  console.log("Live Performance Benchmark — Cold vs Warm");
  console.log(`- Limit: ${limit ?? "All questions"}`);
  console.log(`- Output Directory: ${outDir}`);
  console.log(`- Cache TTL: ${cacheTtlMs ? `${cacheTtlMs}ms (custom)` : "2h (default)"}`);
  console.log("====================================================\n");

  try {
    await runPerformanceBenchmark({ outDir, limit, cacheTtlMs });
    process.exit(0);
  } catch (err) {
    console.error("Performance benchmark failed:", err);
    process.exit(1);
  }
}

main();
