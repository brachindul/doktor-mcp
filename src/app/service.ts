import type { ClassifiedMedicalLegalQuestion, CourtDecision, PrepareInformationPackInput } from "../contracts/legal.js";
import { composeDoctorLegalInformationPack } from "../health/answerComposer.js";
import { LegislationMapper } from "../health/legislationMapper.js";
import { filterReasonedPrecedents, selectVerifiedPrecedents } from "../health/precedentFilter.js";
import { classifyMedicalLegalQuestion } from "../health/questionClassifier.js";
import { MockAymAdapter } from "../sources/aym/mockAymAdapter.js";
import { MockDanistayAdapter } from "../sources/danistay/mockDanistayAdapter.js";
import { MockLegislationAdapter } from "../sources/legislation/mockLegislationAdapter.js";
import type { PrecedentSourceAdapter } from "../sources/types.js";
import { MockYargitayAdapter } from "../sources/yargitay/mockYargitayAdapter.js";

export class PhysicianLegalInformationService {
  private readonly legislation = new MockLegislationAdapter();
  private readonly legislationMapper = new LegislationMapper(this.legislation);
  private readonly precedentAdapters: PrecedentSourceAdapter[] = [
    new MockYargitayAdapter(),
    new MockDanistayAdapter(),
    new MockAymAdapter()
  ];

  classify(question: string) {
    return classifyMedicalLegalQuestion(question);
  }

  async searchLegislation(classification: ClassifiedMedicalLegalQuestion) {
    return this.legislationMapper.mapQuestion(classification);
  }

  async getLegislationProvisions(documentIds: string[]) {
    return this.legislation.getLegislationProvisions(documentIds);
  }

  async searchPrecedents(classification: ClassifiedMedicalLegalQuestion): Promise<CourtDecision[]> {
    const results = await Promise.all(
      this.precedentAdapters.map((adapter) => adapter.searchHealthPrecedents(classification))
    );
    return results.flat();
  }

  filterPrecedents(decisions: CourtDecision[]) {
    return filterReasonedPrecedents(decisions);
  }

  async prepareInformationPack(input: PrepareInformationPackInput) {
    const classification = this.classify(input.question);
    const [provisions, decisions] = await Promise.all([
      this.searchLegislation(classification),
      this.searchPrecedents(classification)
    ]);
    const filtered = this.filterPrecedents(decisions);

    return composeDoctorLegalInformationPack(
      classification,
      provisions,
      selectVerifiedPrecedents(filtered)
    );
  }
}
