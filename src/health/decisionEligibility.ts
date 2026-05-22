import type { CourtDecision, PrecedentStatus } from "../contracts/legal.js";

const proceduralMarkers = ["salt onama", "usul", "salt bozma"];
const bareVerdictPattern = /^(onama|bozma)[.!]?$/;

export interface EligibilityResult {
  status: PrecedentStatus;
  eligibilityReasons: string[];
  exclusionReasons: string[];
}

export function assessDecisionEligibility(decision: CourtDecision): EligibilityResult {
  const eligibilityReasons: string[] = [];
  const exclusionReasons: string[] = [];

  if (!decision.evidence.fullText || !decision.fullText) {
    exclusionReasons.push("Tam karar metni mevcut değil.");
    return { status: "metadata_only", eligibilityReasons, exclusionReasons };
  }
  eligibilityReasons.push("Tam karar metni mevcut.");

  const reasoning = decision.legalReasoning?.trim();
  if (!reasoning) {
    exclusionReasons.push("Hukuki gerekçe alanı boş.");
    return { status: "no_reasoning", eligibilityReasons, exclusionReasons };
  }
  eligibilityReasons.push("Hukuki gerekçe alanı dolu.");

  const lowerText = `${decision.fullText} ${reasoning} ${decision.outcome ?? ""}`.toLocaleLowerCase("tr-TR");
  const lowerReasoning = reasoning.toLocaleLowerCase("tr-TR");

  if (
    proceduralMarkers.some((marker) => lowerText.includes(marker)) ||
    bareVerdictPattern.test(lowerReasoning)
  ) {
    exclusionReasons.push("Karar salt onama veya bozma ibaresi içeriyor; hukuki değerlendirme yok.");
    return { status: "procedural_only", eligibilityReasons, exclusionReasons };
  }

  if (!decision.relevanceNote?.trim()) {
    exclusionReasons.push("Sağlık hukuku olayıyla bağlantı kurulamamış.");
    return { status: "limited_value", eligibilityReasons, exclusionReasons };
  }

  eligibilityReasons.push("Sağlık hukuku olayıyla bağlantı kurulmuş.");
  eligibilityReasons.push("Emsal olarak kullanılabilir.");
  return { status: "precedent_usable", eligibilityReasons, exclusionReasons };
}

export function isUsable(status: PrecedentStatus): boolean {
  return status === "precedent_usable";
}

export function isExcluded(status: PrecedentStatus): boolean {
  return status !== "precedent_usable" && status !== "limited_value";
}
