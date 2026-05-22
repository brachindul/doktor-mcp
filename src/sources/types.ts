import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  LegislationProvision
} from "../contracts/legal.js";

export interface LegislationSourceAdapter {
  searchHealthLegislation(classification: ClassifiedMedicalLegalQuestion): Promise<LegislationProvision[]>;
  getLegislationProvisions(documentIds: string[]): Promise<LegislationProvision[]>;
}

export interface PrecedentSourceAdapter {
  searchHealthPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]>;
}
