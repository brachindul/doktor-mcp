import type { LegalDimension, LegislationProvision, LegislationSelectionDiagnostics, LegislationSourceTrace } from "../../contracts/legal.js";

export interface LiveLegislationUnavailable {
  status: "unavailable";
  source: "mevzuat.gov.tr";
  errorCode:
    | "search_failed"
    | "document_not_found"
    | "source_blocked"
    | "source_blocked_cloudflare"
    | "source_error"
    | "unsupported_content_type"
    | "provision_not_found"
    | "parse_failed";
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
  sourceTrace?: LegislationSourceTrace[];
  selectionDiagnostics?: LegislationSelectionDiagnostics;
}

export interface OfficialLegislationSearchResult {
  sourceId: string;
  title: string;
  sourceUrl: string;
  documentUrl: string;
  legislationNumber: string;
  legislationType: string;
  legislationArrangement: string;
  /** Raw metadata from the search API row, used to extract force-status info. */
  rawMetadata?: Record<string, unknown>;
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
  sourceTrace: LegislationSourceTrace[];
  selectionDiagnostics?: LegislationSelectionDiagnostics;
}

export type LiveLegislationResult = LiveLegislationProvisionResult | LiveLegislationUnavailable;

export interface HealthLegislationHint {
  topicCluster:
    | "informed_consent"
    | "medical_intervention"
    | "patient_rights"
    | "patient_privacy"
    | "personal_health_data"
    | "records_epicrisis"
    | "emergency_intervention"
    | "referral_consultation"
    | "physician_duty_of_care"
    | "professional_ethics"
    | "physician_refusal_or_withdrawal"
    | "patient_noncompliance"
    | "physician_patient_relationship_termination"
    | "emergency_exception"
    | "private_health_facility"
    | "professional_scope_of_practice"
    | "public_employment"
    | "transfer_assignment"
    | "disciplinary_administrative";
  legislationRole: "health_primary" | "supporting_general";
  healthLawPriority: number;
  selectionReason: string;
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
