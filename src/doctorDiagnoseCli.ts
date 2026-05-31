#!/usr/bin/env node
import { DoktorMcpInformationService } from "./app/service.js";

async function main() {
  const question = process.argv[2] || "hasta hakları nelerdir";
  const sourceMode = (process.argv.includes("--sourceMode") ? process.argv[process.argv.indexOf("--sourceMode") + 1] : "mock") as "mock" | "live";
  
  const service = new DoktorMcpInformationService();
  const pack = await service.prepareInformationPack({ question, sourceMode });
  
  console.log(JSON.stringify({
    question,
    sourceMode,
    classification: pack.legalClassification,
    legislationCount: pack.relevantLegislation.length,
    legislationOrder: pack.relevantLegislation.map((l: any) => l.legislationName),
    precedentCount: pack.verifiedHighCourtPrecedents.length,
    sourceWarnings: pack.sourceWarnings,
    missingInformation: pack.missingInformation,
  }, null, 2));
}
main();
