import type { CourtDecision, FilteredPrecedent, PrecedentStatus } from "../contracts/legal.js";

const proceduralMarkers = ["salt onama", "usul", "salt bozma"];

function statusForDecision(decision: CourtDecision): { status: PrecedentStatus; reason: string } {
  if (!decision.evidence.fullText || !decision.fullText) {
    return { status: "metadata_only", reason: "Full decision text is unavailable." };
  }

  const reasoning = decision.legalReasoning?.trim();
  if (!reasoning) {
    return { status: "no_reasoning", reason: "Decision text has no legal reasoning field." };
  }

  const lowerText = `${decision.fullText} ${reasoning} ${decision.outcome ?? ""}`.toLocaleLowerCase("tr-TR");
  if (proceduralMarkers.some((marker) => lowerText.includes(marker))) {
    return { status: "procedural_only", reason: "Decision is procedural or a bare affirmance/reversal." };
  }

  if (!decision.relevanceNote?.trim()) {
    return { status: "limited_value", reason: "Reasoned full text exists but relevance is not established." };
  }

  return { status: "precedent_usable", reason: "Reasoned full text and event relevance are present." };
}

export function filterReasonedPrecedents(decisions: CourtDecision[]): FilteredPrecedent[] {
  return decisions.map((decision) => ({ decision, ...statusForDecision(decision) }));
}

export function selectVerifiedPrecedents(filtered: FilteredPrecedent[]): CourtDecision[] {
  return filtered
    .filter((entry) => entry.status === "precedent_usable")
    .map((entry) => entry.decision);
}
