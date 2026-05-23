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
  console.log("Starting Physician Question Benchmark Suite");
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
    console.log(`- Regression Passed: ${report.passedRegressionCount}`);
    console.log(`- Regression Failed: ${report.failedRegressionCount}`);
    console.log(`- Live Source Unavailable Metrics: ${report.liveSourceUnavailableCount}`);
    console.log(`- Questions With Legislation: ${report.questionsWithLegislation}`);
    console.log(`- Questions With Verified Precedents: ${report.questionsWithVerifiedPrecedents}`);
    console.log(`\nReports generated in:`);
    const baseName = sourceMode === "live" ? "live-benchmark-report" : "doctor-benchmark-report";
    console.log(`- JSON: ${outDir}/${baseName}.json`);
    console.log(`- Markdown: ${outDir}/${baseName}.md`);
    console.log("====================================================");

    if (report.failedRegressionCount > 0) {
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
      console.log("\nAll benchmark regression assertions passed cleanly.");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("Benchmark runner failed with critical error:", err);
    process.exit(1);
  }
}

main();
