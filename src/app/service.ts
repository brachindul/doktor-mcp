import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  LegislationSourceMode,
  PrepareInformationPackInput
} from "../contracts/legal.js";
import { composeDoctorLegalInformationPack } from "../health/answerComposer.js";
import { LegislationMapper } from "../health/legislationMapper.js";
import { filterReasonedPrecedents, selectVerifiedPrecedents } from "../health/precedentFilter.js";
import { classifyMedicalLegalQuestion } from "../health/questionClassifier.js";
import { MockAymAdapter } from "../sources/aym/mockAymAdapter.js";
import { MockDanistayAdapter } from "../sources/danistay/mockDanistayAdapter.js";
import { MockLegislationAdapter } from "../sources/legislation/mockLegislationAdapter.js";
import { LiveOfficialLegislationAdapter } from "../sources/legislation/liveOfficialLegislationAdapter.js";
import type { LiveLegislationResult } from "../sources/legislation/liveTypes.js";
import type { PrecedentSourceAdapter } from "../sources/types.js";
import { MockYargitayAdapter } from "../sources/yargitay/mockYargitayAdapter.js";

export interface PhysicianLegalInformationServiceOptions {
  mockLegislation?: MockLegislationAdapter;
  liveLegislation?: LiveOfficialLegislationAdapter;
}

export class PhysicianLegalInformationService {
  private readonly mockLegislation: MockLegislationAdapter;
  private readonly liveLegislation: LiveOfficialLegislationAdapter;
  private readonly legislationMapper: LegislationMapper;
  private readonly precedentAdapters: PrecedentSourceAdapter[] = [
    new MockYargitayAdapter(),
    new MockDanistayAdapter(),
    new MockAymAdapter()
  ];

  constructor(options: PhysicianLegalInformationServiceOptions = {}) {
    this.mockLegislation = options.mockLegislation ?? new MockLegislationAdapter();
    this.liveLegislation = options.liveLegislation ?? new LiveOfficialLegislationAdapter();
    this.legislationMapper = new LegislationMapper(this.mockLegislation);
  }

  classify(question: string) {
    return classifyMedicalLegalQuestion(question);
  }

  async searchLegislation(classification: ClassifiedMedicalLegalQuestion, sourceMode: LegislationSourceMode = "mock") {
    if (sourceMode === "live") return this.liveLegislation.getMappedHealthProvisions(classification.question);
    return this.legislationMapper.mapQuestion(classification);
  }

  async getLegislationProvisions(documentIds: string[], sourceMode: LegislationSourceMode = "mock") {
    if (sourceMode === "live") return this.liveLegislation.getLegislationProvisions(documentIds);
    return this.mockLegislation.getLegislationProvisions(documentIds);
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
    const [legislation, decisions] = await Promise.all([
      this.searchLegislation(classification, input.sourceMode),
      this.searchPrecedents(classification)
    ]);
    const filtered = this.filterPrecedents(decisions);
    const liveUnavailable = isLiveUnavailable(legislation) ? [legislation] : [];
    const provisions = isLiveResult(legislation)
      ? legislation.status === "ok" ? legislation.provisions : []
      : legislation;

    return composeDoctorLegalInformationPack(
      classification,
      provisions,
      selectVerifiedPrecedents(filtered),
      liveUnavailable
    );
  }
}

function isLiveResult(value: Awaited<ReturnType<PhysicianLegalInformationService["searchLegislation"]>>): value is LiveLegislationResult {
  return !Array.isArray(value);
}

function isLiveUnavailable(value: Awaited<ReturnType<PhysicianLegalInformationService["searchLegislation"]>>) {
  return isLiveResult(value) && value.status === "unavailable";
}
