export type SourceKind = "legislation" | "yargitay" | "danistay" | "aym" | "bedesten";
export type LegislationSourceMode = "mock" | "live";
export type PrecedentSource = "yargitay" | "danistay" | "aym" | "bedesten";
export type PrecedentSourceMode = "live" | "mock" | "disabled";

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

/**
 * Describes the richness of content available for a court decision.
 * Used by `CourtDecision.contentStatus` and `VerifiedPrecedentAuditEntry.contentStatus`.
 *
 * - `full_text`      : Full legal text retrieved and reasoning detected.
 * - `html_markdown`  : Full text retrieved but converted from HTML; reasoning may be partial.
 * - `pdf_link_only`  : Only a PDF URL was found; no text was extracted.
 * - `metadata_only`  : Only metadata (court, date, number) available; no full text.
 * - `unavailable`    : Source could not be reached or content could not be parsed.
 */
export type ContentStatus =
  | "full_text"
  | "html_markdown"
  | "pdf_link_only"
  | "metadata_only"
  | "unavailable";

/**
 * Fetch outcome for a single decision retrieval attempt (v0.27.0).
 */
export type FetchStatus =
  | "search_hit"
  | "full_text_fetched"
  | "metadata_only"
  | "pdf_link_only"
  | "unavailable"
  | "timeout"
  | "parse_error"
  | "source_unavailable";

/**
 * Per-decision cross-source provenance record (v0.27.0).
 */
export interface DecisionSourceProvenance {
  source: "bedesten" | "yargitay" | "danistay" | "aym" | "mock";
  accessSource?: string;
  fetchStatus: FetchStatus;
  contentStatus: ContentStatus;
  quoteUsable: boolean;
  timedOut?: boolean;
  retryCount?: number;
  backoffMs?: number;
  fetchedAt?: string;
}

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
  /** Whether the provision is currently in force. "unknown" when metadata is unavailable. Never assumes "true" by default. */
  inForce?: boolean | "unknown";
  /** Date of last amendment, if available from source metadata. ISO date string. */
  lastAmendedDate?: string;
  /** Whether the provision has been repealed. */
  repealed?: boolean;
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
  contentStatus?: ContentStatus;
  quoteUsable?: boolean;
  provenance?: DecisionSourceProvenance[];
  normalizedDecisionKey?: string;
  evidence: SourceEvidence;
  decisionSourceTrace?: DecisionSourceTrace;
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
  court?: Exclude<SourceKind, "legislation">;
  chamber?: string;
  date: string;
  decisionDate?: string;
  meritsAndDecisionNumber: string;
  meritsNumber?: string;
  decisionNumber?: string;
  factSummary: string;
  legalAssessment: string;
  outcome: string;
  similarityDifference: string;
  sourceDocumentId: string;
  sourceId?: string;
  sourceUrl?: string;
  accessSource?: string;
  fullTextAvailable?: boolean;
  reasoningDetected?: boolean;
  eligibilityStatus?: PrecedentStatus;
  eligibilityReasons?: string[];
  exclusionReasons?: string[];
  healthLawRelevanceScore?: number;
  matchedQueryTerms?: string[];
  matchedHealthLawTerms?: string[];
  issueProfile?: string;
  missingExpectedIssueTerms?: string[];
  weakRelevanceReason?: string | null;
  suggestedQueryTerms?: string[];
  selectedAsVerifiedReason?: string;
  decisionSourceTrace?: DecisionSourceTrace;
}

export interface LegalClassificationSection {
  criminal: string[];
  civilCompensation: string[];
  disciplinaryAdministrative: string[];
  patientRights: string[];
  privacyKvkk: string[];
  professionalEthics: string[];
}

/**
 * Individual assessment sentence tied to a source reference.
 * Each sentence MUST reference a legislation provision or precedent ruling.
 * Uses conditional language — never categorical final judgments.
 * @since v0.44.0
 */
export interface AssessmentSentence {
  /** The assessment text. Must use conditional language. */
  text: string;
  /** Reference to the source: legislation provision ID or precedent decision ID. */
  sourceRef: string;
  /** Human-readable label for the source (e.g., "Hasta Hakları Yönetmeliği md. 5"). */
  sourceLabel: string;
}

/**
 * Source-grounded preliminary assessment.
 * Each sentence MUST reference a legislation provision or precedent ruling.
 * No sentence without a sourceRef is allowed.
 * Uses conditional language — never categorical final judgments.
 * @since v0.44.0
 */
export interface PreliminaryAssessment {
  /**
   * Overall summary in conditional, source-grounded language.
   * Example: "Kaynaklar, bu durumun Hasta Hakları Yönetmeliği'nin X maddesine göre
   * değerlendirilebileceğini göstermektedir."
   */
  summary: string;
  /** Individual assessment sentences, each tied to a source reference. */
  sentences: AssessmentSentence[];
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
    inForce?: boolean | "unknown";
    lastAmendedDate?: string;
    repealed?: boolean;
  }>;
  verifiedHighCourtPrecedents: VerifiedPrecedentEntry[];
  missingInformation: string[];
  lawyerReviewPoints: string[];
  sourceWarnings: string[];
  sourceUnavailable?: SourceUnavailable[];
  sourceTrace?: LegislationSourceTrace[];
  selectionDiagnostics?: LegislationSelectionDiagnostics;
  precedentDiagnostics?: PrecedentSelectionDiagnostics;
  /**
   * Optional source-grounded preliminary assessment.
   * Each sentence MUST reference a legislation provision or precedent ruling.
   * No sentence without a sourceRef is allowed.
   * Uses conditional language — never categorical final judgments.
   * @since v0.44.0
   */
  preliminaryAssessment?: PreliminaryAssessment;
}

export interface PrepareInformationPackInput {
  question: string;
  sourceMode?: LegislationSourceMode;
  precedentSources?: PrecedentSource[];
  timeBudget?: any;
  /** Controls whether the pack includes a source-grounded preliminary assessment. Defaults to "grounded-advisory". */
  assessmentTone?: "strict" | "grounded-advisory";
}

export interface PrecedentSourceSummary {
  source: PrecedentSource;
  mode: PrecedentSourceMode;
  searched: boolean;
  searchResultsCount: number | null;
  candidateCount: number;
  selectedCount: number;
  excludedCount: number;
  unavailableCount: number;
  errorCodes: string[];
}

export interface PrecedentSourceResult {
  source: PrecedentSource;
  mode: PrecedentSourceMode;
  decisions: CourtDecision[];
  searchResultsCount: number | null;
  unavailable: boolean;
  errorCodes: string[];
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

export interface DecisionSourceTrace {
  query: string;
  source: Exclude<SourceKind, "legislation">;
  court: string;
  searchRequest: { url: string | null; phrase: string; pageSize: number } | null;
  searchResultsCount: number | null;
  selectedResult: { documentId: string; title?: string } | null;
  selectedResultReason: string | null;
  documentId: string;
  sourceId?: string;
  fullTextAvailable: boolean;
  fullTextRetrievalMethod: string | null;
  retrievedAt: string | null;
  eligibilityStatus: PrecedentStatus;
  eligibilityReasons: string[];
  exclusionReasons: string[];
  error?: string;
  retryCount?: number;
  backoffMs?: number;
  httpStatus?: number | null;
  contentType?: string | null;
}

export interface PrecedentSelectionDiagnostics {
  query: string;
  selectedPrecedentCount: number;
  excludedDecisionCount: number;
  sourceSummaries: PrecedentSourceSummary[];
  selectedPrecedents: Array<{
    source: PrecedentSource;
    court: string;
    chamber?: string;
    date?: string;
    docketNo?: string;
    decisionNo?: string;
    status: PrecedentStatus;
    matchedHealthTopics: string[];
    eligibilityReasons: string[];
  }>;
  excludedDecisions: Array<{
    source: PrecedentSource;
    court: string;
    date?: string;
    status: PrecedentStatus;
    exclusionReasons: string[];
  }>;
}

export interface LegislationSelectionDiagnostics {
  query: string;
  sourceMode: LegislationSourceMode;
  selectedLegislationCount: number;
  selectedProvisionCount: number;
  selectedLegislations: Array<{
    legislationName: string;
    legislationRole: string | null;
    topicCluster: string | null;
    healthLawPriority: number | null;
    selectedArticleNumbers: string[];
    rejectedArticleNumbers: string[];
    selectionReason: string | null;
  }>;
  selectedProvisions: Array<{
    legislationName: string;
    articleNumber: string;
    score: number | null;
    matchedTerms: string[];
    topRankingReasons: string[];
    fromMappedArticleList: boolean | null;
  }>;
  unavailableCount: number;
  warningCount: number;
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
