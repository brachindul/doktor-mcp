import type {
  CourtDecision,
  DecisionSourceTrace,
  FilteredPrecedent,
  PrecedentSelectionDiagnostics,
  PrecedentStatus
} from "../contracts/legal.js";
import { assessDecisionEligibility } from "./decisionEligibility.js";

export function filterReasonedPrecedents(decisions: CourtDecision[]): FilteredPrecedent[] {
  return decisions.map((decision) => {
    const { status, eligibilityReasons, exclusionReasons } = assessDecisionEligibility(decision);
    const reason = exclusionReasons[0] ?? eligibilityReasons[eligibilityReasons.length - 1] ?? "";
    return { decision, status, reason };
  });
}

export function selectVerifiedPrecedents(filtered: FilteredPrecedent[]): CourtDecision[] {
  return filtered
    .filter((entry) => entry.status === "precedent_usable")
    .map((entry) => entry.decision);
}

export function buildDecisionSourceTraces(
  filtered: FilteredPrecedent[],
  query: string
): DecisionSourceTrace[] {
  return filtered.map((entry) => {
    const { decision } = entry;
    const { status, eligibilityReasons, exclusionReasons } = assessDecisionEligibility(decision);
    return {
      query,
      source: decision.court,
      court: decision.court,
      searchRequest: null,
      searchResultsCount: null,
      selectedResult: { documentId: decision.evidence.documentId },
      selectedResultReason: "Mock adapter — gerçek arama yapılmadı.",
      documentId: decision.evidence.documentId,
      sourceId: decision.evidence.sourceId,
      fullTextAvailable: decision.evidence.fullText,
      fullTextRetrievalMethod: decision.evidence.fullText ? "mock" : null,
      retrievedAt: decision.evidence.retrievedAt,
      eligibilityStatus: status,
      eligibilityReasons,
      exclusionReasons
    };
  });
}

export function buildPrecedentSelectionDiagnostics(
  filtered: FilteredPrecedent[],
  query: string
): PrecedentSelectionDiagnostics {
  const selected = filtered.filter((e) => e.status === "precedent_usable");
  const excluded = filtered.filter((e) => e.status !== "precedent_usable");

  return {
    query,
    selectedPrecedentCount: selected.length,
    excludedDecisionCount: excluded.length,
    selectedPrecedents: selected.map((e) => {
      const { eligibilityReasons } = assessDecisionEligibility(e.decision);
      return {
        court: e.decision.court,
        chamber: e.decision.chamber,
        date: e.decision.decisionDate,
        docketNo: e.decision.meritsNumber,
        decisionNo: e.decision.decisionNumber,
        status: e.status,
        matchedHealthTopics: e.decision.topicTags,
        eligibilityReasons
      };
    }),
    excludedDecisions: excluded.map((e) => {
      const { exclusionReasons } = assessDecisionEligibility(e.decision);
      return {
        court: e.decision.court,
        date: e.decision.decisionDate,
        status: e.status as Exclude<PrecedentStatus, "precedent_usable">,
        exclusionReasons
      };
    })
  };
}
