import type {
  LegislationProvision,
  LegislationSelectionDiagnostics,
  LegislationSourceMode,
  SourceUnavailable
} from "../../contracts/legal.js";

export interface BuildLegislationSelectionDiagnosticsInput {
  query: string;
  sourceMode: LegislationSourceMode;
  provisions: LegislationProvision[];
  sourceUnavailable?: SourceUnavailable[];
  warningCount?: number;
}

export function buildLegislationSelectionDiagnostics({
  query,
  sourceMode,
  provisions,
  sourceUnavailable = [],
  warningCount = 0
}: BuildLegislationSelectionDiagnosticsInput): LegislationSelectionDiagnostics {
  const selectedLegislations = new Map<string, LegislationSelectionDiagnostics["selectedLegislations"][number]>();

  for (const provision of provisions) {
    const mapping = provision.sourceTrace?.matchedHealthMapping;
    const legislationKey = `${provision.documentId}:${mapping?.topicCluster ?? "unknown"}`;
    const current = selectedLegislations.get(legislationKey) ?? {
      legislationName: provision.legislationName,
      legislationRole: mapping?.legislationRole ?? null,
      topicCluster: mapping?.topicCluster ?? null,
      healthLawPriority: mapping?.healthLawPriority ?? null,
      selectedArticleNumbers: [],
      rejectedArticleNumbers: summarizeRejected(provision.sourceTrace?.rejectedArticleNumbers ?? []),
      selectionReason: mapping?.selectionReason ?? null
    };

    current.selectedArticleNumbers = unique([...current.selectedArticleNumbers, provision.articleNumber]);
    current.rejectedArticleNumbers = unique([
      ...current.rejectedArticleNumbers,
      ...summarizeRejected(provision.sourceTrace?.rejectedArticleNumbers ?? [])
    ]);
    selectedLegislations.set(legislationKey, current);
  }

  return {
    query,
    sourceMode,
    selectedLegislationCount: selectedLegislations.size,
    selectedProvisionCount: provisions.length,
    selectedLegislations: [...selectedLegislations.values()],
    selectedProvisions: provisions.map((provision) => ({
      legislationName: provision.legislationName,
      articleNumber: provision.articleNumber,
      score: provision.ranking?.score ?? null,
      matchedTerms: provision.ranking?.matchedTerms ?? [],
      topRankingReasons: provision.ranking?.rankingReasons.slice(0, 3) ?? [],
      fromMappedArticleList: provision.ranking?.fromMappedArticleList ?? null
    })),
    unavailableCount: sourceUnavailable.length,
    warningCount
  };
}

function summarizeRejected(articleNumbers: string[]) {
  return articleNumbers.slice(0, 10);
}

function unique(values: string[]) {
  return [...new Set(values)];
}
