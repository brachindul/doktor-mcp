import { describe, expect, it } from "vitest";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { composeDoctorLegalInformationPack } from "../src/health/answerComposer.js";
import { filterReasonedPrecedents, selectVerifiedPrecedents } from "../src/health/precedentFilter.js";
import { classifyMedicalLegalQuestion } from "../src/health/questionClassifier.js";
import { mockCourtDecisions, mockLegislationProvisions } from "../src/sources/mockData.js";

describe("MVP legal information pack constraints", () => {
  it("does not show metadata_only decisions as verified precedents", () => {
    const filtered = filterReasonedPrecedents(mockCourtDecisions);
    const metadataEntry = filtered.find((entry) => entry.decision.id === "aym-metadata-only-health-data");
    const pack = composeDoctorLegalInformationPack(
      classifyMedicalLegalQuestion("Saglik verisi mahremiyeti"),
      [],
      selectVerifiedPrecedents(filtered)
    );

    expect(metadataEntry?.status).toBe("metadata_only");
    expect(pack.verifiedHighCourtPrecedents.map((entry) => entry.sourceDocumentId)).not.toContain(
      "aym-metadata-only-health-data"
    );
  });

  it("does not place procedural_only decisions in verified high court precedents", () => {
    const filtered = filterReasonedPrecedents(mockCourtDecisions);
    const proceduralEntry = filtered.find((entry) => entry.decision.id === "danistay-procedural-affirmance");
    const pack = composeDoctorLegalInformationPack(
      classifyMedicalLegalQuestion("Riza kaydi"),
      [],
      selectVerifiedPrecedents(filtered)
    );

    expect(proceduralEntry?.status).toBe("procedural_only");
    expect(pack.verifiedHighCourtPrecedents.map((entry) => entry.sourceDocumentId)).not.toContain(
      "danistay-procedural-affirmance"
    );
  });

  it("copies legislation quotes verbatim from the source provision text", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "Aydinlatilmis riza kaydi" });
    const sourceProvision = mockLegislationProvisions.find(
      (provision) => provision.documentId === "leg-patient-rights-24"
    );

    expect(pack.relevantLegislation[0]?.verbatimQuote).toBe(sourceProvision?.verbatimText);
  });

  it("does not invent provisions or precedents when no sources are supplied", () => {
    const pack = composeDoctorLegalInformationPack(
      classifyMedicalLegalQuestion("Kaynak bulunmayan belirsiz soru"),
      [],
      []
    );

    expect(pack.shortAnswer).toContain("bulunamadı");
    expect(pack.relevantLegislation).toEqual([]);
    expect(pack.verifiedHighCourtPrecedents).toEqual([]);
    expect(pack.sourceWarnings).toContain("Kaynak yokken madde veya karar üretilmedi.");
  });

  it("does not include risk level or immediate actions in the MVP response", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "Riza eksikligi iddiasi" });
    const json = JSON.stringify(pack).toLocaleLowerCase("tr-TR");

    expect(json).not.toContain("risk seviyesi");
    expect(json).not.toContain("derhal yapilacak");
    expect(json).not.toContain("kesin hukuki kanaat");
    expect(pack).not.toHaveProperty("riskLevel");
    expect(pack).not.toHaveProperty("immediateActions");
  });
});
