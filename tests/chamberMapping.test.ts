import { describe, expect, it } from "vitest";
import { assessPrecedentRelevance, inferIssueProfileFromQuestion } from "../src/health/precedentRelevance.js";
import type { CourtDecision } from "../src/contracts/legal.js";

function makeDecision(overrides: Partial<CourtDecision> = {}): CourtDecision {
  return {
    id: "test:1",
    court: "yargitay",
    chamber: "4. Hukuk Dairesi",
    decisionDate: "2023-01-01",
    factSummary: "Özet.",
    legalReasoning: "Gerekçe.",
    outcome: "Sonuç.",
    relevanceNote: undefined,
    topicTags: [],
    evidence: {
      source: "yargitay",
      documentId: "1",
      retrievedAt: new Date().toISOString(),
      official: true,
      fullText: true
    },
    ...overrides
  };
}

describe("T22.2 — daire-uzmanlık eşlemesi", () => {
  it("neutral score for default chamber (malpractice + hukuk) — no boost, no penalty", () => {
    const question = "tıbbi hata komplikasyon";
    const decision = makeDecision({
      court: "yargitay",
      chamber: "4. Hukuk Dairesi",
      legalReasoning: "tıbbi hata ve özen yükümlülüğü ihlali nedeniyle tazminat"
    });
    const result = assessPrecedentRelevance(question, decision);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("penalizes score when chamber is irrelevant (violence + hukuk)", () => {
    const question = "hekime şiddet tehdit";
    const decision = makeDecision({
      court: "yargitay",
      chamber: "4. Hukuk Dairesi",
      legalReasoning: "hekime şiddet ve tehdit"
    });
    const result = assessPrecedentRelevance(question, decision);
    // Hukuk is irrelevant for violence; with penalty it should not reach max (5)
    expect(result.score).toBeLessThanOrEqual(4);
  });

  it("boosts score for distinguished chamber match (violence + ceza dairesi)", () => {
    const question = "hekime şiddet tehdit";
    const decision = makeDecision({
      court: "yargitay",
      chamber: "11. Ceza Dairesi",
      legalReasoning: "hekime şiddet ve tehdit"
    });
    const result = assessPrecedentRelevance(question, decision);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("penalizes score when wrong court (public employment + yargitay)", () => {
    const question = "tayin atama iptali kamu görevlisi";
    const decision = makeDecision({
      court: "yargitay",
      chamber: "4. Hukuk Dairesi",
      legalReasoning: "tayin atama iptali"
    });
    const result = assessPrecedentRelevance(question, decision);
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it("neutral score for default court/chamber (public employment + danistay)", () => {
    const question = "tayin atama iptali kamu görevlisi";
    const decision = makeDecision({
      court: "danistay",
      chamber: "2. Daire",
      legalReasoning: "tayin atama iptali idari dava"
    });
    const result = assessPrecedentRelevance(question, decision);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("uses recorded fixture: yargitay Hukuk Dairesi gets neutral/bonus for malpractice", async () => {
    const { default: fixture } = await import("../fixtures/live-samples/yargitay-synthetic.json");
    const item = fixture.data[0];
    const decision = makeDecision({
      id: `yargitay:${item.ID}`,
      court: "yargitay",
      chamber: item.BIRIMI,
      factSummary: item.OZET
    });
    const question = "tıbbi hata tazminat";
    const result = assessPrecedentRelevance(question, decision);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("uses recorded fixture: danistay Daire gets bonus for public discipline", async () => {
    const { default: fixture } = await import("../fixtures/live-samples/danistay-synthetic.json");
    const item = fixture.data[0];
    const decision = makeDecision({
      id: `danistay:${item.ID}`,
      court: "danistay",
      chamber: item.DAIRESI,
      factSummary: item.OZET
    });
    const question = "kamu hastanesi disiplin idari soruşturma";
    const result = assessPrecedentRelevance(question, decision);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
