import type { CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";

export const DANISTAY_SOURCE = "danistay.gov.tr" as const;

export interface LiveDanistaySearchResult {
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

export interface LiveDanistayOkResult {
  status: "ok";
  source: typeof DANISTAY_SOURCE;
  query: string;
  searchResultsCount: number;
  selectedResult: LiveDanistaySearchResult | null;
  decisions: CourtDecision[];
  sourceTraces: DecisionSourceTrace[];
}

export interface LiveDanistayUnavailable {
  status: "unavailable";
  source: typeof DANISTAY_SOURCE;
  errorCode:
    | "search_failed"
    | "source_blocked"
    | "source_error"
    | "document_not_found"
    | "parse_failed"
    | "no_health_mapping"
    | "needs_browser_capture"
    | "fixture_required";
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
  sourceTrace?: DecisionSourceTrace[];
}

export type LiveDanistayResult = LiveDanistayOkResult | LiveDanistayUnavailable;
