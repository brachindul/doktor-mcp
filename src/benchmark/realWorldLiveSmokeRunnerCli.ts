import { runBenchmark } from "./benchmarkRunner.js";
import { realWorldPhysicianLiveSmokeQuestions } from "./realWorldPhysicianQuestions.js";
import { evaluateBetaReadiness } from "../physicianPackBetaGate.js";
import { generateMarkdownReport } from "./benchmarkRunner.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const sourceModeIndex = args.indexOf("--sourceMode");
  const sourceMode = sourceModeIndex !== -1 ? args[sourceModeIndex + 1] : "live";

  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

  const outDir = "exports/physician-real-world-live-smoke";

  if (sourceMode !== "live" && sourceMode !== "mock") {
    console.error(`Invalid --sourceMode value: "${sourceMode}". Use "live" or "mock".`);
    process.exit(1);
  }

  console.log("====================================================");
  console.log("Starting Real-World Physician Question Live Smoke Hardening Suite");
  console.log(`- Source Mode: ${sourceMode.toUpperCase()}`);
  console.log(`- Limit: ${limit ?? "All questions"}`);
  console.log(`- Output Directory: ${outDir}`);
  console.log("====================================================\n");

  try {
    const report = await runBenchmark({
      sourceMode: sourceMode as "live" | "mock",
      limit,
      outDir,
      questions: realWorldPhysicianLiveSmokeQuestions
    });

    console.log("\nEvaluating Beta Readiness Gate...");
    const betaReport = evaluateBetaReadiness(report);
    (report as any).betaGate = betaReport;

    // Save updated reports to exports/physician-real-world-live-smoke with specific filenames
    fs.mkdirSync(outDir, { recursive: true });
    
    // 1. JSON Report
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");

    // 2. Markdown Report with appended Beta Readiness section
    const originalMd = generateMarkdownReport(report);
    const betaSectionMd = `
## 🛡️ Beta Readiness Gate Report

**Readiness Level**: \`${betaReport.betaReadinessLevel.toUpperCase()}\`
**Readiness Score**: \`${betaReport.betaReadinessScore}/100\`
**Gate Status**: \`${betaReport.gatePassed ? "🟢 PASSED" : "🔴 FAILED"}\`

### 🚨 Hard Gate Failures (${betaReport.failures.length})
${betaReport.failures.length === 0 ? "*None*" : betaReport.failures.map(f => `- ❌ ${f}`).join("\n")}

### 🔍 Soft Observations (${betaReport.observations.length})
${betaReport.observations.length === 0 ? "*None*" : betaReport.observations.map(o => `- ⚠️ ${o}`).join("\n")}

### 📊 Key Beta Metrics
- **Total Questions**: ${betaReport.metrics.totalQuestions}
- **Packs Generated**: ${betaReport.metrics.packGeneratedCount} (Failed/Timeout: ${betaReport.metrics.packNotGeneratedCount})
- **Contract Passed/Failed**: ${betaReport.metrics.contractPassedCount} / ${betaReport.metrics.contractFailedCount}
- **Unsafe Advice Detected**: ${betaReport.metrics.unsafeAdviceDetectedCount}
- **Unofficial Sources Detected**: ${betaReport.metrics.unofficialSourceDetectedCount}
- **Timeout Questions**: ${betaReport.metrics.timeoutQuestionCount}
- **Timeout Question IDs**: ${betaReport.metrics.timeoutQuestionIds.length === 0 ? "None" : betaReport.metrics.timeoutQuestionIds.join(", ")}
- **Cannot Compose Research Pack Count**: ${betaReport.metrics.cannotComposeResearchPackCount}
- **Average Legislation per Pack**: ${betaReport.metrics.averageLegislationPerPack}
- **Average Verified Precedents per Pack**: ${betaReport.metrics.averageVerifiedPrecedentPerPack}
- **Unique Legislation Used**: ${betaReport.metrics.uniqueLegislationUsedCount}
- **Verified Precedent Count**: ${betaReport.metrics.verifiedPrecedentCount}
`;
    fs.writeFileSync(path.join(outDir, "report.md"), originalMd + "\n" + betaSectionMd, "utf8");

    console.log("\n====================================================");
    console.log("Real-World Live Smoke Benchmark Completed!");
    console.log(`- Total Questions: ${report.totalQuestions}`);
    console.log(`- Regression Passed: ${report.passedRegressionCount}`);
    console.log(`- Regression Failed: ${report.failedRegressionCount}`);
    console.log(`\nBeta Readiness Summary:`);
    console.log(`- Status: ${betaReport.gatePassed ? "🟢 PASSED" : "🔴 FAILED"}`);
    console.log(`- Score: ${betaReport.betaReadinessScore}/100`);
    console.log(`- Level: ${betaReport.betaReadinessLevel.toUpperCase()}`);
    console.log(`\nReports written to:`);
    console.log(`- JSON: ${outDir}/report.json`);
    console.log(`- Markdown: ${outDir}/report.md`);
    console.log("====================================================");

    if (betaReport.failures.length > 0) {
      console.log("\nBeta Gate Failures:");
      for (const fail of betaReport.failures) {
        console.log(`- ❌ ${fail}`);
      }
    }

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
    console.error("Real-World Live Smoke Benchmark runner failed with critical error:", err);
    process.exit(1);
  }
}

main();
