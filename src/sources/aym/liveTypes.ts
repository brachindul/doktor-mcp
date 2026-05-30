import type { CourtDecision, DecisionSourceTrace } from "../../contracts/legal.js";

export const AYM_SOURCE = "aym.gov.tr" as const;

export interface LiveAymSearchResult {
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

export interface LiveAymOkResult {
  status: "ok";
  source: typeof AYM_SOURCE;
  query: string;
  searchResultsCount: number;
  selectedResult: LiveAymSearchResult | null;
  decisions: CourtDecision[];
  sourceTraces: DecisionSourceTrace[];
}

export interface LiveAymUnavailable {
  status: "unavailable";
  source: typeof AYM_SOURCE;
  errorCode:
    | "search_failed"
    | "source_blocked"
    | "source_error"
    | "document_not_found"
    | "parse_failed"
    | "needs_browser_capture"
    | "endpoint_html_only";
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
  sourceTrace?: DecisionSourceTrace[];
}

export type LiveAymResult = LiveAymOkResult | LiveAymUnavailable;
