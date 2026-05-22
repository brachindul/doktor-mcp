import type {
  ClassifiedMedicalLegalQuestion,
  CourtDecision,
  LegislationSourceMode,
  LegislationProvision,
  PrepareInformationPackInput,
  PrecedentSource,
  PrecedentSourceResult
} from "../contracts/legal.js";
import { composeDoctorLegalInformationPack } from "../health/answerComposer.js";
import { LegislationMapper } from "../health/legislationMapper.js";
import {
  filterReasonedPrecedents,
  selectVerifiedPrecedents,
  buildPrecedentSelectionDiagnostics
} from "../health/precedentFilter.js";
import { classifyMedicalLegalQuestion } from "../health/questionClassifier.js";
import { MockAymAdapter } from "../sources/aym/mockAymAdapter.js";
import { MockDanistayAdapter } from "../sources/danistay/mockDanistayAdapter.js";
import { MockLegislationAdapter } from "../sources/legislation/mockLegislationAdapter.js";
import { LiveOfficialLegislationAdapter } from "../sources/legislation/liveOfficialLegislationAdapter.js";
import type { LiveLegislationResult } from "../sources/legislation/liveTypes.js";
import { buildLegislationSelectionDiagnostics } from "../sources/legislation/selectionDiagnostics.js";
import type { PrecedentSourceAdapter } from "../sources/types.js";
import { MockYargitayAdapter } from "../sources/yargitay/mockYargitayAdapter.js";
import { LiveYargitayAdapter } from "../sources/yargitay/liveYargitayAdapter.js";
import { LiveDanistayAdapter } from "../sources/danistay/liveDanistayAdapter.js";
import { LiveBedestenAdapter } from "../sources/bedesten/liveBedestenAdapter.js";

export interface PhysicianLegalInformationServiceOptions {
  mockLegislation?: MockLegislationAdapter;
  liveLegislation?: LiveOfficialLegislationAdapter;
  liveYargitay?: LiveYargitayAdapter;
  liveDanistay?: LiveDanistayAdapter;
  liveBedesten?: LiveBedestenAdapter;
}

export class PhysicianLegalInformationService {
  private readonly mockLegislation: MockLegislationAdapter;
  private readonly liveLegislation: LiveOfficialLegislationAdapter;
  private readonly liveYargitay: LiveYargitayAdapter;
  private readonly liveDanistay: LiveDanistayAdapter;
  private readonly liveBedesten: LiveBedestenAdapter;
  private readonly legislationMapper: LegislationMapper;
  private readonly mockPrecedentAdapters: PrecedentSourceAdapter[] = [
    new MockYargitayAdapter(),
    new MockDanistayAdapter(),
    new MockAymAdapter()
  ];

  constructor(options: PhysicianLegalInformationServiceOptions = {}) {
    this.mockLegislation = options.mockLegislation ?? new MockLegislationAdapter();
    this.liveLegislation = options.liveLegislation ?? new LiveOfficialLegislationAdapter();
    this.liveYargitay = options.liveYargitay ?? new LiveYargitayAdapter();
    this.liveDanistay = options.liveDanistay ?? new LiveDanistayAdapter();
    this.liveBedesten = options.liveBedesten ?? new LiveBedestenAdapter();
    this.legislationMapper = new LegislationMapper(this.mockLegislation);
  }

  classify(question: string) {
    return classifyMedicalLegalQuestion(question);
  }

  async searchLegislation(classification: ClassifiedMedicalLegalQuestion, sourceMode: LegislationSourceMode = "mock") {
    if (sourceMode === "live") {
      const result = await this.liveLegislation.getMappedHealthProvisions(classification.question);
      if (result.status === "ok") {
        return {
          ...result,
          selectionDiagnostics: result.selectionDiagnostics ?? buildLegislationSelectionDiagnostics({
            query: classification.question,
            sourceMode,
            provisions: result.provisions
          })
        };
      }

      return {
        ...result,
        selectionDiagnostics: result.selectionDiagnostics ?? buildLegislationSelectionDiagnostics({
          query: classification.question,
          sourceMode,
          provisions: [],
          sourceUnavailable: [result]
        })
      };
    }
    return this.legislationMapper.mapQuestion(classification);
  }

  async getLegislationProvisions(documentIds: string[], sourceMode: LegislationSourceMode = "mock") {
    if (sourceMode === "live") {
      const provisions = await this.liveLegislation.getLegislationProvisions(documentIds);
      return {
        sourceMode,
        provisions,
        selectionDiagnostics: buildLegislationSelectionDiagnostics({
          query: queryFromProvisions(provisions, documentIds),
          sourceMode,
          provisions
        })
      };
    }
    return this.mockLegislation.getLegislationProvisions(documentIds);
  }

  async searchPrecedents(
    classification: ClassifiedMedicalLegalQuestion,
    sourceMode: LegislationSourceMode = "mock",
    precedentSources?: PrecedentSource[]
  ): Promise<{ decisions: CourtDecision[]; sourceResults: PrecedentSourceResult[] }> {
    if (sourceMode === "live") {
      const sources: PrecedentSource[] = precedentSources ?? ["yargitay", "danistay"];
      const sourceResults: PrecedentSourceResult[] = [];

      await Promise.all(sources.map(async (src) => {
        if (src === "yargitay") {
          try {
            const decisions = await this.liveYargitay.searchHealthPrecedents(classification);
            sourceResults.push({ source: "yargitay", mode: "live", decisions, searchResultsCount: decisions.length, unavailable: false, errorCodes: [] });
          } catch {
            sourceResults.push({ source: "yargitay", mode: "live", decisions: [], searchResultsCount: null, unavailable: true, errorCodes: ["source_error"] });
          }
        } else if (src === "danistay") {
          try {
            const decisions = await this.liveDanistay.searchHealthPrecedents(classification);
            sourceResults.push({ source: "danistay", mode: "live", decisions, searchResultsCount: decisions.length, unavailable: false, errorCodes: [] });
          } catch {
            sourceResults.push({ source: "danistay", mode: "live", decisions: [], searchResultsCount: null, unavailable: true, errorCodes: ["source_error"] });
          }
        } else if (src === "bedesten") {
          try {
            const decisions = await this.liveBedesten.searchHealthPrecedents(classification);
            sourceResults.push({ source: "bedesten", mode: "live", decisions, searchResultsCount: decisions.length, unavailable: false, errorCodes: [] });
          } catch {
            sourceResults.push({ source: "bedesten", mode: "live", decisions: [], searchResultsCount: null, unavailable: true, errorCodes: ["source_error"] });
          }
        } else if (src === "aym") {
          sourceResults.push({
            source: "aym",
            mode: "disabled",
            decisions: [],
            searchResultsCount: null,
            unavailable: true,
            errorCodes: ["live_not_supported"]
          });
        }
      }));

      return { decisions: sourceResults.flatMap((sr) => sr.decisions), sourceResults };
    }

    const results = await Promise.all(
      this.mockPrecedentAdapters.map((adapter) => adapter.searchHealthPrecedents(classification))
    );
    const decisions = results.flat();
    const sourceResults: PrecedentSourceResult[] = [
      { source: "yargitay", mode: "mock", decisions: results[0] ?? [], searchResultsCount: (results[0] ?? []).length, unavailable: false, errorCodes: [] },
      { source: "danistay", mode: "mock", decisions: results[1] ?? [], searchResultsCount: (results[1] ?? []).length, unavailable: false, errorCodes: [] },
      { source: "aym", mode: "mock", decisions: results[2] ?? [], searchResultsCount: (results[2] ?? []).length, unavailable: false, errorCodes: [] }
    ];
    return { decisions, sourceResults };
  }

  filterPrecedents(decisions: CourtDecision[]) {
    return filterReasonedPrecedents(decisions);
  }

  async prepareInformationPack(input: PrepareInformationPackInput) {
    const classification = this.classify(input.question);
    const [legislation, precedentResult] = await Promise.all([
      this.searchLegislation(classification, input.sourceMode),
      this.searchPrecedents(classification, input.sourceMode, input.precedentSources)
    ]);
    const { decisions, sourceResults } = precedentResult;
    const filtered = this.filterPrecedents(decisions);
    const liveUnavailable = isLiveUnavailable(legislation) ? [legislation] : [];
    const provisions = isLiveResult(legislation)
      ? legislation.status === "ok" ? legislation.provisions : []
      : legislation;

    const precedentDiagnostics = buildPrecedentSelectionDiagnostics(filtered, input.question, sourceResults);
    const pack = composeDoctorLegalInformationPack(
      classification,
      provisions,
      selectVerifiedPrecedents(filtered),
      liveUnavailable
    );
    const selectionDiagnostics = input.sourceMode === "live"
      ? buildLegislationSelectionDiagnostics({
        query: input.question,
        sourceMode: "live",
        provisions,
        sourceUnavailable: liveUnavailable,
        warningCount: pack.sourceWarnings.length
      })
      : undefined;

    return {
      ...pack,
      ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
      precedentDiagnostics
    };
  }
}

function isLiveResult(value: unknown): value is LiveLegislationResult {
  return !Array.isArray(value);
}

function isLiveUnavailable(value: Awaited<ReturnType<PhysicianLegalInformationService["searchLegislation"]>>) {
  return isLiveResult(value) && value.status === "unavailable";
}

function queryFromProvisions(provisions: LegislationProvision[], documentIds: string[]) {
  return provisions[0]?.sourceTrace?.query ?? documentIds.join(" ");
}
