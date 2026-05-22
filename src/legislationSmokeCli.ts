import { composeDoctorLegalInformationPack } from "./health/answerComposer.js";
import { classifyMedicalLegalQuestion } from "./health/questionClassifier.js";
import { LiveOfficialLegislationAdapter } from "./sources/legislation/liveOfficialLegislationAdapter.js";

const query = process.argv.slice(2).join(" ") || "kisisel saglik verisi mahremiyet";
const adapter = new LiveOfficialLegislationAdapter();
const live = await adapter.getMappedHealthProvisions(query);

if (live.status === "unavailable") {
  console.log(JSON.stringify(live, null, 2));
  process.exitCode = live.retryable ? 2 : 1;
} else {
  const pack = composeDoctorLegalInformationPack(classifyMedicalLegalQuestion(query), live.provisions, []);
  console.log(JSON.stringify({
    status: live.status,
    source: live.source,
    query,
    provisions: live.provisions,
    quoteMatchesProvisionText: pack.relevantLegislation.every((entry, index) =>
      entry.verbatimQuote === live.provisions[index]?.verbatimText
    ),
    pack
  }, null, 2));
}
