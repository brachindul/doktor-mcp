import type { CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";

export const YARGITAY_SOURCE = "yargitay.gov.tr" as const;

export interface LiveYargitaySearchResult {
  documentId: string;
  sourceId?: string;
  title?: string;
  date?: string;
  chamber?: string;
  meritsNumber?: string;
  decisionNumber?: string;
  sourceUrl: string;
  documentUrl?: string;
  summaryText?: string;
}

export interface LiveYargitayOkResult {
  status: "ok";
  source: typeof YARGITAY_SOURCE;
  query: string;
  searchResultsCount: number;
  selectedResult: LiveYargitaySearchResult | null;
  decisions: CourtDecision[];
  sourceTraces: DecisionSourceTrace[];
}

export interface LiveYargitayUnavailable {
  status: "unavailable";
  source: typeof YARGITAY_SOURCE;
  errorCode:
    | "search_failed"
    | "source_blocked"
    | "source_error"
    | "document_not_found"
    | "parse_failed"
    | "no_health_mapping";
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
  sourceTrace?: DecisionSourceTrace[];
}

export type LiveYargitayResult = LiveYargitayOkResult | LiveYargitayUnavailable;
