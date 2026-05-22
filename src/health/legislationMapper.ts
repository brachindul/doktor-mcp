import type { ClassifiedMedicalLegalQuestion, LegislationProvision } from "../contracts/legal.js";
import type { LegislationSourceAdapter } from "../sources/types.js";

export class LegislationMapper {
  constructor(private readonly adapter: LegislationSourceAdapter) {}

  async mapQuestion(classification: ClassifiedMedicalLegalQuestion): Promise<LegislationProvision[]> {
    const provisions = await this.adapter.searchHealthLegislation(classification);
    return provisions.filter(
      (provision) => provision.evidence.official && provision.evidence.fullText && provision.verbatimText.length > 0
    );
  }
}
