import type { ClassifiedMedicalLegalQuestion } from "../../contracts/legal.js";
import type { PrecedentSourceAdapter } from "../types.js";
import { mockCourtDecisions } from "../mockData.js";

export class MockDanistayAdapter implements PrecedentSourceAdapter {
  async searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion) {
    return mockCourtDecisions.filter(
      (decision) =>
        decision.court === "danistay" &&
        decision.topicTags.some((tag) => classification.searchTerms.includes(tag))
    );
  }
}
