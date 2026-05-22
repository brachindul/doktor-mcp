import { runBenchmark } from "./benchmarkRunner.js";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const sourceModeIndex = args.indexOf("--sourceMode");
  const sourceMode = sourceModeIndex !== -1 ? args[sourceModeIndex + 1] : "mock";

  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

  const outIndex = args.indexOf("--out");
  const outDir = outIndex !== -1 ? args[outIndex + 1] : "exports/doctor-benchmark";

  if (sourceMode !== "live" && sourceMode !== "mock") {
    console.error(`Invalid --sourceMode value: "${sourceMode}". Use "live" or "mock".`);
    process.exit(1);
  }

  console.log("====================================================");
  console.log(`Starting Physician Question Benchmark Suite (v0.16.0)`);
  console.log(`- Source Mode: ${sourceMode.toUpperCase()}`);
  console.log(`- Limit: ${limit ?? "All questions"}`);
  console.log(`- Output Directory: ${outDir}`);
  console.log("====================================================\n");

  try {
    const report = await runBenchmark({
      sourceMode: sourceMode as "live" | "mock",
      limit,
      outDir
    });

    console.log("\n====================================================");
    console.log("Benchmark Completed Successfully!");
    console.log(`- Total Questions: ${report.totalQuestions}`);
    console.log(`- Passed: ${report.passedCount}`);
    console.log(`- Failed: ${report.failedCount}`);
    console.log(`\nReports generated in:`);
    console.log(`- JSON: ${outDir}/doctor-benchmark-report.json`);
    console.log(`- Markdown: ${outDir}/doctor-benchmark-report.md`);
    console.log("====================================================");

    if (report.failedCount > 0) {
      console.log("\nFailed Questions Summary:");
      for (const res of report.results) {
        if (!res.passed) {
          console.log(`- [${res.id}] ${res.category}`);
          for (const reason of res.failureReasons) {
            console.log(`  * ${reason}`);
          }
        }
      }
      process.exit(1);
    } else {
      console.log("\nAll benchmark assertions passed cleanly! 🎉");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("Benchmark runner failed with critical error:", err);
    process.exit(1);
  }
}

main();
