import { describe, expect, it } from "vitest";
import { assessDecisionEligibility } from "../src/health/decisionEligibility.js";
import {
  buildPrecedentSelectionDiagnostics,
  filterReasonedPrecedents
} from "../src/health/precedentFilter.js";
import { DoktorMcpInformationService } from "../src/app/service.js";
import { mockCourtDecisions } from "../src/sources/mockData.js";
import type { CourtDecision } from "../src/contracts/legal.js";

function evidence(source: CourtDecision["court"], documentId: string, fullText: boolean) {
  return { source, documentId, retrievedAt: "2026-05-22T00:00:00.000Z", official: true as const, fullText };
}

const metadataOnlyDecision: CourtDecision = {
  id: "test-metadata",
  court: "aym",
  topicTags: ["saglik"],
  evidence: evidence("aym", "test-metadata", false)
};

const noReasoningDecision: CourtDecision = {
  id: "test-no-reasoning",
  court: "yargitay",
  topicTags: ["saglik"],
  fullText: "Olay ozeti var ama gerekce yok.",
  evidence: evidence("yargitay", "test-no-reasoning", true)
};

const proceduralDecision: CourtDecision = {
  id: "test-procedural",
  court: "danistay",
  topicTags: ["riza"],
  fullText: "Usul karari.",
  legalReasoning: "Salt onama.",
  outcome: "Onama.",
  evidence: evidence("danistay", "test-procedural", true)
};

const bareOnamaDecision: CourtDecision = {
  id: "test-bare-onama",
  court: "yargitay",
  topicTags: ["riza"],
  fullText: "Karar: onama.",
  legalReasoning: "onama",
  outcome: "onama",
  evidence: evidence("yargitay", "test-bare-onama", true)
};

const noFullTextDecision: CourtDecision = {
  id: "test-no-fulltext",
  court: "aym",
  topicTags: ["saglik"],
  legalReasoning: "Gerekce var ama tam metin yok.",
  evidence: evidence("aym", "test-no-fulltext", false)
};

const limitedValueDecision: CourtDecision = {
  id: "test-limited",
  court: "yargitay",
  topicTags: ["saglik"],
  fullText: "Gerekce ile tam metin var.",
  legalReasoning: "Gerekce iceren degerli karar.",
  outcome: "Bozma.",
  evidence: evidence("yargitay", "test-limited", true)
};

const usableDecision: CourtDecision = {
  id: "test-usable",
  court: "yargitay",
  chamber: "13. Hukuk Dairesi",
  decisionDate: "2024-01-15",
  meritsNumber: "2023/100",
  decisionNumber: "2024/200",
  factSummary: "Aydinlatilmis riza eksikligi iddiasi.",
  legalReasoning: "Hastanenin aydinlatma yukumlulugunu yerine getirmedigine dair gerekce.",
  outcome: "Tazminata hukmedildi.",
  relevanceNote: "Riza belgesi eksikligi olan saglik hukuku davalariyla dogrudan baglantilidır.",
  topicTags: ["riza", "aydinlatma", "saglik"],
  fullText: "Tam metin: olay, gerekce ve sonuc.",
  evidence: evidence("yargitay", "test-usable", true)
};

describe("assessDecisionEligibility", () => {
  it("returns metadata_only when fullText is unavailable", () => {
    const result = assessDecisionEligibility(metadataOnlyDecision);
    expect(result.status).toBe("metadata_only");
    expect(result.exclusionReasons).toContain("Tam karar metni mevcut değil.");
  });

  it("returns no_reasoning when legalReasoning is missing", () => {
    const result = assessDecisionEligibility(noReasoningDecision);
    expect(result.status).toBe("no_reasoning");
    expect(result.exclusionReasons).toContain("Hukuki gerekçe alanı boş.");
  });

  it("returns procedural_only for salt onama decision", () => {
    const result = assessDecisionEligibility(proceduralDecision);
    expect(result.status).toBe("procedural_only");
    expect(result.exclusionReasons[0]).toContain("salt onama");
  });

  it("returns procedural_only for bare onama verdict", () => {
    const result = assessDecisionEligibility(bareOnamaDecision);
    expect(result.status).toBe("procedural_only");
  });

  it("returns metadata_only when evidence.fullText is false even with legalReasoning", () => {
    const result = assessDecisionEligibility(noFullTextDecision);
    expect(result.status).toBe("metadata_only");
  });

  it("returns limited_value when relevanceNote is missing", () => {
    const result = assessDecisionEligibility(limitedValueDecision);
    expect(result.status).toBe("limited_value");
    expect(result.exclusionReasons).toContain("Sağlık hukuku olayıyla bağlantı kurulamamış.");
  });

  it("returns precedent_usable for reasoned health-law-connected decision", () => {
    const result = assessDecisionEligibility(usableDecision);
    expect(result.status).toBe("precedent_usable");
    expect(result.eligibilityReasons).toContain("Emsal olarak kullanılabilir.");
    expect(result.exclusionReasons).toHaveLength(0);
  });
});

describe("buildPrecedentSelectionDiagnostics", () => {
  it("produces diagnostics with correct counts from mock decisions", () => {
    const filtered = filterReasonedPrecedents(mockCourtDecisions);
    const diagnostics = buildPrecedentSelectionDiagnostics(filtered, "riza kaydi");

    expect(diagnostics.query).toBe("riza kaydi");
    expect(diagnostics.selectedPrecedentCount).toBeGreaterThanOrEqual(1);
    expect(diagnostics.excludedDecisionCount).toBeGreaterThanOrEqual(1);
  });

  it("puts metadata_only, procedural_only and no_reasoning decisions in excludedDecisions", () => {
    const filtered = filterReasonedPrecedents(mockCourtDecisions);
    const diagnostics = buildPrecedentSelectionDiagnostics(filtered, "test");
    const excludedStatuses = diagnostics.excludedDecisions.map((d) => d.status);

    expect(excludedStatuses).toContain("metadata_only");
    expect(excludedStatuses).toContain("procedural_only");
    expect(excludedStatuses).toContain("no_reasoning");
  });

  it("puts only precedent_usable decisions in selectedPrecedents", () => {
    const filtered = filterReasonedPrecedents(mockCourtDecisions);
    const diagnostics = buildPrecedentSelectionDiagnostics(filtered, "test");

    for (const entry of diagnostics.selectedPrecedents) {
      expect(entry.status).toBe("precedent_usable");
    }
  });

  it("excludedDecisions include exclusionReasons", () => {
    const filtered = filterReasonedPrecedents(mockCourtDecisions);
    const diagnostics = buildPrecedentSelectionDiagnostics(filtered, "test");

    for (const entry of diagnostics.excludedDecisions) {
      expect(entry.exclusionReasons.length).toBeGreaterThan(0);
    }
  });
});

describe("filter_reasoned_precedents tool integration", () => {
  it("prepare_doctor_legal_information_pack includes precedentDiagnostics", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "aydınlatılmış rıza kayıt eksikliği" });

    expect(pack).toHaveProperty("precedentDiagnostics");
    expect(pack.precedentDiagnostics).toHaveProperty("selectedPrecedentCount");
    expect(pack.precedentDiagnostics).toHaveProperty("excludedDecisionCount");
    expect(pack.precedentDiagnostics).toHaveProperty("selectedPrecedents");
    expect(pack.precedentDiagnostics).toHaveProperty("excludedDecisions");
  });

  it("verifiedHighCourtPrecedents contains only precedent_usable decisions", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "riza eksikligi" });
    const ids = pack.verifiedHighCourtPrecedents.map((p) => p.sourceDocumentId);

    expect(ids).not.toContain("aym-metadata-only-health-data");
    expect(ids).not.toContain("danistay-procedural-affirmance");
    expect(ids).not.toContain("yargitay-no-reasoning");
  });

  it("excluded decisions appear in precedentDiagnostics.excludedDecisions", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "saglik verisi" });
    const diagnostics = pack.precedentDiagnostics!;

    expect(diagnostics.excludedDecisions.length).toBeGreaterThan(0);
  });

  it("does not include risk level, immediate actions, or final legal opinion", async () => {
    const service = new DoktorMcpInformationService();
    const pack = await service.prepareInformationPack({ question: "riza eksikligi" });
    const json = JSON.stringify(pack).toLocaleLowerCase("tr-TR");

    expect(json).not.toContain("risk seviyesi");
    expect(json).not.toContain("derhal yapilacak");
    expect(json).not.toContain("kesin hukuki kanaat");
    expect(pack).not.toHaveProperty("riskLevel");
    expect(pack).not.toHaveProperty("immediateActions");
  });
});
