import type { ClassifiedMedicalLegalQuestion } from "../../contracts/legal.js";
import type { LegislationSourceAdapter } from "../types.js";
import { mockLegislationProvisions } from "../mockData.js";

export class MockLegislationAdapter implements LegislationSourceAdapter {
  async searchHealthLegislation(classification: ClassifiedMedicalLegalQuestion) {
    return mockLegislationProvisions.filter((provision) =>
      provision.dimensions.some((dimension) => classification.dimensions.includes(dimension))
    );
  }

  async getLegislationProvisions(documentIds: string[]) {
    return mockLegislationProvisions.filter((provision) => documentIds.includes(provision.documentId));
  }
}
