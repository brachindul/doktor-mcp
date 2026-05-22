import type { LegalDimension, LegislationProvision } from "../../contracts/legal.js";

export interface LiveLegislationUnavailable {
  status: "unavailable";
  source: "mevzuat.gov.tr";
  errorCode:
    | "search_failed"
    | "document_not_found"
    | "source_blocked"
    | "source_error"
    | "unsupported_content_type"
    | "provision_not_found"
    | "parse_failed";
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
}

export interface OfficialLegislationSearchResult {
  sourceId: string;
  title: string;
  sourceUrl: string;
  documentUrl: string;
  legislationNumber: string;
  legislationType: string;
  legislationArrangement: string;
}

export interface LiveLegislationDocument {
  sourceId: string;
  title: string;
  sourceUrl: string;
  documentUrl: string;
  text: string;
  contentType: string;
  retrievedAt: string;
}

export interface LiveLegislationProvisionResult {
  status: "ok";
  source: "mevzuat.gov.tr";
  query: string;
  searchResults: OfficialLegislationSearchResult[];
  documents: LiveLegislationDocument[];
  provisions: LegislationProvision[];
}

export type LiveLegislationResult = LiveLegislationProvisionResult | LiveLegislationUnavailable;

export interface HealthLegislationHint {
  terms: string[];
  query: string;
  title: string;
  sourceId: string;
  legislationNumber: string;
  legislationType: string;
  legislationArrangement: string;
  articleNumbers: string[];
  dimensions: LegalDimension[];
}
