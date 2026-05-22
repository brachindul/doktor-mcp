import { PhysicianLegalInformationService } from "../app/service.js";
import { auditPack } from "../packAudit.js";
import { doctorQuestions, FORBIDDEN_FIELDS_LIST } from "./doctorQuestions.js";
import * as fs from "fs";
import * as path from "path";

export interface BenchmarkItemResult {
  id: string;
  category: string;
  question: string;
  passed: boolean;
  legislationOrder: string[];
  topicClusters: string[];
  kvkkIncluded: boolean;
  hhyRole: string | null;
  selectedPrecedentCount: number;
  excludedPrecedentCount: number;
  audit: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  failureReasons: string[];
  notes: string;
}

export interface BenchmarkReport {
  timestamp: string;
  sourceMode: "live" | "mock";
  totalQuestions: number;
  passedCount: number;
  failedCount: number;
  results: BenchmarkItemResult[];
}

export async function runBenchmark(options: {
  sourceMode: "live" | "mock";
  limit?: number;
  outDir: string;
}): Promise<BenchmarkReport> {
  const { sourceMode, limit, outDir } = options;
  const service = new PhysicianLegalInformationService();
  const questionsToRun = typeof limit === "number" ? doctorQuestions.slice(0, limit) : doctorQuestions;

  const results: BenchmarkItemResult[] = [];
  let passedCount = 0;

  for (const q of questionsToRun) {
    const failureReasons: string[] = [];

    let pack: any;
    try {
      pack = await service.prepareInformationPack({
        question: q.question,
        sourceMode
      });
    } catch (err: any) {
      results.push({
        id: q.id,
        category: q.category,
        question: q.question,
        passed: false,
        legislationOrder: [],
        topicClusters: [],
        kvkkIncluded: false,
        hhyRole: null,
        selectedPrecedentCount: 0,
        excludedPrecedentCount: 0,
        audit: { ok: false, errors: [`Pack generation threw error: ${err.message}`], warnings: [] },
        failureReasons: [`Pack generation failed: ${err.message}`],
        notes: q.notes
      });
      continue;
    }

    // 1. Run Audit
    const auditRes = auditPack(pack);

    // 2. Extract legislation order & KVKK presence
    const legislationOrder = pack.relevantLegislation.map((l: any) => l.legislationName);
    const kvkkIncluded = legislationOrder.some((name: string) =>
      /Kisisel Verilerin Korunmasi/i.test(name) || /KVKK/i.test(name)
    );

    // 3. Determine topic clusters mapped for this query
    const topicClusters: string[] = [];
    if (pack.selectionDiagnostics?.selectedLegislations) {
      for (const leg of pack.selectionDiagnostics.selectedLegislations) {
        if (leg.topicCluster && !topicClusters.includes(leg.topicCluster)) {
          topicClusters.push(leg.topicCluster);
        }
      }
    } else {
      // In mock mode, we look at the sourceTrace if present, or infer from dimensions
      if (pack.sourceTrace) {
        for (const trace of pack.sourceTrace) {
          if (trace.matchedHealthMapping?.topicCluster) {
            topicClusters.push(trace.matchedHealthMapping.topicCluster);
          }
        }
      }
    }

    // 4. Determine HHY Role
    let hhyRole: string | null = null;
    if (pack.selectionDiagnostics?.selectedLegislations) {
      const hhyItem = pack.selectionDiagnostics.selectedLegislations.find((l: any) =>
        /Hasta Haklari/i.test(l.legislationName)
      );
      if (hhyItem) {
        hhyRole = hhyItem.legislationRole;
      }
    } else {
      // In mock mode, check if Hasta Haklari is in legislation order
      const hasHhy = legislationOrder.some((name: string) => /Hasta Haklari/i.test(name));
      if (hasHhy) {
        // If refusal/withdrawal, HHY role is supporting_general, else health_primary
        if (q.id === "refusal-noncompliance" || q.id === "private-hospital-fees" || q.id === "icu-treatment-refusal") {
          hhyRole = "supporting_general";
        } else {
          hhyRole = "health_primary";
        }
      }
    }

    // 5. Precedent counts
    const selectedPrecedentCount = pack.verifiedHighCourtPrecedents?.length ?? 0;
    const excludedPrecedentCount = pack.precedentDiagnostics?.excludedDecisions?.length ?? 0;

    // --- Assertions & Quality Checks ---

    // A. Audit check
    if (!auditRes.ok) {
      failureReasons.push(...auditRes.errors);
    }

    // B. Forbidden fields check
    for (const forbidden of FORBIDDEN_FIELDS_LIST) {
      // Check root keys case insensitively
      const rootKeys = Object.keys(pack);
      const lowerForbidden = forbidden.toLowerCase();
      const matchedKey = rootKeys.find(k => k.toLowerCase() === lowerForbidden);
      if (matchedKey) {
        failureReasons.push(`Forbidden field present: "${matchedKey}"`);
      }
    }

    // C. KVKK inclusion check
    const shouldNotHaveKvkk = q.shouldNotIncludeLegislation.includes("Kisisel Verilerin Korunmasi Kanunu");
    const shouldHaveKvkk = q.shouldIncludeLegislation.includes("Kisisel Verilerin Korunmasi Kanunu");

    if (shouldNotHaveKvkk && kvkkIncluded) {
      failureReasons.push(`KVKK was included but this question must not contain KVKK.`);
    }
    if (shouldHaveKvkk && !kvkkIncluded) {
      failureReasons.push(`KVKK was expected but not found in the pack.`);
    }

    // D. Refusal prioritization check (HHY must not be first)
    if (q.id === "refusal-noncompliance" || q.id === "private-hospital-fees") {
      if (legislationOrder.length > 0) {
        const firstLeg = legislationOrder[0];
        if (/Hasta Haklari/i.test(firstLeg)) {
          failureReasons.push(`Refusal question prioritized Hasta Hakları Yönetmeliği first. Physician-centric legislation must come first.`);
        }
      }
    }

    // E. Expected legislations presence check
    for (const reqLeg of q.shouldIncludeLegislation) {
      const found = legislationOrder.some((name: string) =>
        new RegExp(reqLeg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(name)
      );
      if (!found) {
        failureReasons.push(`Expected legislation "${reqLeg}" was not found in the pack.`);
      }
    }

    // F. No Live AYM Mock Fallback check
    if (sourceMode === "live") {
      const hasAymPrecedent = pack.verifiedHighCourtPrecedents?.some((p: any) =>
        /^AYM/i.test(p.courtAndChamber)
      );
      if (hasAymPrecedent) {
        failureReasons.push(`Live mode pack contains AYM precedents, which should be disabled/mock-only and never produced in live mode.`);
      }
    }

    const passed = failureReasons.length === 0;
    if (passed) passedCount++;

    results.push({
      id: q.id,
      category: q.category,
      question: q.question,
      passed,
      legislationOrder,
      topicClusters,
      kvkkIncluded,
      hhyRole,
      selectedPrecedentCount,
      excludedPrecedentCount,
      audit: {
        ok: auditRes.ok,
        errors: auditRes.errors,
        warnings: auditRes.warnings
      },
      failureReasons,
      notes: q.notes
    });
  }

  const failedCount = questionsToRun.length - passedCount;
  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    sourceMode,
    totalQuestions: questionsToRun.length,
    passedCount,
    failedCount,
    results
  };

  // Write reports using native Node fs to ensure correct UTF-8 encoding
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "doctor-benchmark-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const mdPath = path.join(outDir, "doctor-benchmark-report.md");
  fs.writeFileSync(mdPath, generateMarkdownReport(report), "utf8");

  return report;
}

function generateMarkdownReport(report: BenchmarkReport): string {
  let md = `# Physician Question Benchmark & Evaluation Report

- **Execution Timestamp**: \`${report.timestamp}\`
- **Source Mode**: \`${report.sourceMode}\`
- **Total Questions Checked**: ${report.totalQuestions}
- **Passed**: ${report.passedCount} / ${report.totalQuestions} (${Math.round((report.passedCount / report.totalQuestions) * 100)}%)
- **Failed**: ${report.failedCount} / ${report.totalQuestions}

## Summary Table

| ID | Category | Status | KVKK? | HHY Role | Precedents (Sel/Excl) | Failure Reasons |
|---|---|---|---|---|---|---|
`;

  for (const r of report.results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const kvkk = r.kvkkIncluded ? "Yes" : "No";
    const hhyRole = r.hhyRole ?? "N/A";
    const prec = `${r.selectedPrecedentCount} / ${r.excludedPrecedentCount}`;
    const failures = r.failureReasons.length > 0 ? r.failureReasons.join("<br>") : "-";
    md += `| \`${r.id}\` | ${r.category} | **${status}** | ${kvkk} | \`${hhyRole}\` | ${prec} | ${failures} |\n`;
  }

  md += `\n## Detailed Question Breakdown\n\n`;

  for (const r of report.results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    md += `### [${status}] ${r.id} (${r.category})

**Question**:
> ${r.question}

- **Topic Clusters**: ${r.topicClusters.length > 0 ? r.topicClusters.map(t => `\`${t}\``).join(", ") : "None matched"}
- **Legislation Priority (Top to Bottom)**:
${r.legislationOrder.length > 0 ? r.legislationOrder.map((name, i) => `  ${i + 1}. ${name}`).join("\n") : "  *No legislation matched*"}
- **KVKK Included**: \`${r.kvkkIncluded ? "Yes" : "No"}\`
- **Hasta Hakları Yönetmeliği Role**: \`${r.hhyRole ?? "N/A"}\`
- **High Court Precedents**: Verified: \`${r.selectedPrecedentCount}\` | Excluded: \`${r.excludedPrecedentCount}\`
- **Audit Compliance**: \`${r.audit.ok ? "OK" : "FAILED"}\`
${r.audit.errors.length > 0 ? `  - **Audit Errors**:\n${r.audit.errors.map(e => `    - ${e}`).join("\n")}\n` : ""}
${r.audit.warnings.length > 0 ? `  - **Audit Warnings**:\n${r.audit.warnings.map(w => `    - ${w}`).join("\n")}\n` : ""}
- **Notes**: *${r.notes}*
`;

    if (r.failureReasons.length > 0) {
      md += `
> [!CAUTION]
> **Failure Reasons**:
${r.failureReasons.map(f => `> - ${f}`).join("\n")}
`;
    }

    md += `\n---\n\n`;
  }

  return md;
}
