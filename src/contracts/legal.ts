export type SourceKind = "legislation" | "yargitay" | "danistay" | "aym";
export type LegislationSourceMode = "mock" | "live";

export type LegalDimension =
  | "criminal"
  | "civil_compensation"
  | "disciplinary_administrative"
  | "patient_rights"
  | "privacy_kvkk"
  | "professional_ethics";

export type PrecedentStatus =
  | "precedent_usable"
  | "limited_value"
  | "procedural_only"
  | "metadata_only"
  | "no_reasoning";

export interface SourceEvidence {
  source: SourceKind;
  documentId: string;
  sourceId?: string;
  sourceUrl?: string;
  retrievedAt: string;
  retrievalMetadata?: Record<string, string | number | boolean | null>;
  official: true;
  fullText: boolean;
}

export interface LegislationDocument {
  id: string;
  title: string;
  provisions: LegislationProvision[];
  evidence: SourceEvidence;
}

export interface LegislationProvision {
  documentId: string;
  legislationName: string;
  articleNumber: string;
  verbatimText: string;
  connection: string;
  dimensions: LegalDimension[];
  evidence: SourceEvidence;
  sourceTrace?: LegislationSourceTrace;
  ranking?: ProvisionRanking;
}

export interface ProvisionRanking {
  score: number;
  matchedTerms: string[];
  rankingReasons: string[];
  fromMappedArticleList: boolean;
}

export interface CourtDecision {
  id: string;
  court: Exclude<SourceKind, "legislation">;
  chamber?: string;
  decisionDate?: string;
  meritsNumber?: string;
  decisionNumber?: string;
  factSummary?: string;
  legalReasoning?: string;
  outcome?: string;
  relevanceNote?: string;
  topicTags: string[];
  fullText?: string;
  evidence: SourceEvidence;
}

export interface ClassifiedMedicalLegalQuestion {
  question: string;
  dimensions: LegalDimension[];
  searchTerms: string[];
  missingInformation: string[];
}

export interface FilteredPrecedent {
  decision: CourtDecision;
  status: PrecedentStatus;
  reason: string;
}

export interface VerifiedPrecedentEntry {
  courtAndChamber: string;
  date: string;
  meritsAndDecisionNumber: string;
  factSummary: string;
  legalAssessment: string;
  outcome: string;
  similarityDifference: string;
  sourceDocumentId: string;
}

export interface LegalClassificationSection {
  criminal: string[];
  civilCompensation: string[];
  disciplinaryAdministrative: string[];
  patientRights: string[];
  privacyKvkk: string[];
  professionalEthics: string[];
}

export interface DoctorLegalInformationPack {
  shortAnswer: string;
  legalClassification: LegalClassificationSection;
  relevantLegislation: Array<{
    legislationName: string;
    articleNumber: string;
    verbatimQuote: string;
    connection: string;
    sourceDocumentId: string;
    sourceTrace?: LegislationSourceTrace;
    ranking?: ProvisionRanking;
  }>;
  verifiedHighCourtPrecedents: VerifiedPrecedentEntry[];
  missingInformation: string[];
  lawyerReviewPoints: string[];
  sourceWarnings: string[];
  sourceUnavailable?: SourceUnavailable[];
  sourceTrace?: LegislationSourceTrace[];
}

export interface PrepareInformationPackInput {
  question: string;
  sourceMode?: LegislationSourceMode;
}

export interface SourceUnavailable {
  status: "unavailable";
  source: string;
  errorCode: string;
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
  sourceTrace?: LegislationSourceTrace[];
}

export interface LegislationSourceTrace {
  query: string;
  matchedHealthMapping: {
    sourceId: string;
    query: string;
    title: string;
    articleNumbers: string[];
    topicCluster?: string;
    legislationRole?: string;
    healthLawPriority?: number;
    selectionReason?: string;
  } | null;
  attemptedHealthMappings?: string[];
  officialSearchRequest: {
    url: string;
    phrase: string;
    searchArea: string;
    pageSize: number;
  } | null;
  officialSearchResultsCount: number | null;
  officialSearchResults?: Array<{
    sourceId: string;
    title: string;
    landingUrl: string;
    documentUrl: string;
  }>;
  selectedSearchResult: {
    sourceId: string;
    title: string;
    landingUrl: string;
    documentUrl: string;
  } | null;
  selectedResultReason: string | null;
  landingUrl: string | null;
  detailUrl: string | null;
  fullTextUrl: string | null;
  directPdfUrl: string | null;
  generatedPdfUrl: string | null;
  contentType: string | null;
  extractionMethod: string | null;
  extractedArticleNumbers: string[];
  candidateArticleNumbers?: string[];
  rankedArticleNumbers?: string[];
  rejectedArticleNumbers?: string[];
  rankingMethod?: string | null;
  retrievedAt: string | null;
  error?: string;
}
