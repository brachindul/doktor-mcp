/**
 * Pack audit — validates a DoctorLegalInformationPack for compliance with MVP constraints.
 */

export interface ContractCheckResult {
  passed: boolean;
  missingSections: string[];
  missingLegislationFields: Array<{ index: number; fields: string[] }>;
  missingPrecedentFields: Array<{ index: number; fields: string[] }>;
  unofficialSourceDetected: boolean;
  unofficialSourceDetails: string[];
  unsafeAdviceDetected: boolean;
  unsafeAdvicePhrases: string[];
}

export interface AuditResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedCounts: {
    legislationItems: number;
    legislationWithSourceTrace: number;
    precedents: number;
    excludedDecisions: number;
    sourceSummaries: number;
    unavailableSources: number;
  };
  contractCheck: ContractCheckResult;
  recommendedNextStep: string;
}

const MVP_OUT_OF_SCOPE_FIELDS = [
  "riskLevel",
  "immediateActions",
  "finalLegalOpinion",
  "riskSeviyesi",
  "derhalYapilacaklar",
  "kesinHukukiKanaat",
  "dilekseTaslagi"
];

const EXCLUDED_ELIGIBILITY_STATUSES = new Set([
  "metadata_only",
  "procedural_only",
  "no_reasoning"
]);

// Fallback placeholder strings from answerComposer — presence means field was missing from source
const PRECEDENT_FALLBACK_STRINGS: Record<string, string> = {
  date: "Kaynakta tarih yok",
  factSummary: "Kaynakta olay ozeti yok",
  legalAssessment: "Kaynakta hukuki degerlendirme yok",
  outcome: "Kaynakta sonuc yok",
  similarityDifference: "Benzerlik teyit edilmedi",
  meritsAndDecisionNumber: "Kaynakta esas/karar no yok"
};

// Official domains for Turkish legal sources. Any URL in a legislation sourceTrace
// that does not match these patterns is considered unofficial.
const OFFICIAL_LEGISLATION_DOMAIN_SUFFIX = ".gov.tr";
const LEGISLATION_SOURCETRACE_URL_FIELDS = [
  "landingUrl",
  "fullTextUrl",
  "detailUrl",
  "directPdfUrl",
  "generatedPdfUrl"
] as const;

function isOfficialLegislationUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith(OFFICIAL_LEGISLATION_DOMAIN_SUFFIX);
  } catch {
    // Unparseable URL — treat as unofficial
    return false;
  }
}

// MVP forbidden phrases — must not appear in any free-text field of the pack
const MVP_FORBIDDEN_PHRASES = [
  "kesin hukuki kanaat",
  "dilekçe taslağı",
  "savunma taslağı",
  "risk seviyesi",
  "derhal yapılacak",
  // also catch common ASCII/unaccented variants
  "kesin hukuki opinion",
  "petition draft",
  "defense draft",
  // v0.43.0: output safety language guards
  "kesin olarak sorumlusunuz",
  "kesin beraat eder",
  "derhal şunu yapın",
  "derhal sunu yapin",
  "risk seviyesi yüksek",
  "risk seviyesi dusuk",
  "risk seviyesi düşük",
  "savunma dilekçesi şöyle olmalı",
  "savunma dilekcesi soyle olmali",
  "şu cezayı alırsınız",
  "su cezayi alirsiniz",
  "şunu yapmanız gerekir",
  "sunu yapmaniz gerekir"
];

function isNonEmpty(val: unknown): boolean {
  return typeof val === "string" && val.trim().length > 0;
}

function containsFallback(val: unknown, fallback: string): boolean {
  return typeof val === "string" && val.includes(fallback);
}

function collectPackText(p: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof p.shortAnswer === "string") parts.push(p.shortAnswer);
  const lc = p.legalClassification as Record<string, unknown> | null | undefined;
  if (lc && typeof lc === "object") {
    for (const v of Object.values(lc)) {
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) {
        for (const item of v as unknown[]) {
          if (typeof item === "string") parts.push(item);
        }
      }
    }
  }
  if (typeof p.missingInformation === "string") parts.push(p.missingInformation);
  else if (Array.isArray(p.missingInformation)) {
    for (const v of p.missingInformation as unknown[]) {
      if (typeof v === "string") parts.push(v);
    }
  }
  const lrp = p.lawyerReviewPoints;
  if (Array.isArray(lrp)) {
    for (const pt of lrp) {
      if (typeof pt === "string") parts.push(pt);
    }
  }
  const legislation = Array.isArray(p.relevantLegislation) ? p.relevantLegislation : [];
  for (const item of legislation) {
    const it = item as Record<string, unknown>;
    if (typeof it.verbatimQuote === "string") parts.push(it.verbatimQuote);
    if (typeof it.connection === "string") parts.push(it.connection);
  }
  const precs = Array.isArray(p.verifiedHighCourtPrecedents) ? p.verifiedHighCourtPrecedents : [];
  for (const prec of precs) {
    const pr = prec as Record<string, unknown>;
    if (typeof pr.factSummary === "string") parts.push(pr.factSummary);
    if (typeof pr.legalAssessment === "string") parts.push(pr.legalAssessment);
    if (typeof pr.outcome === "string") parts.push(pr.outcome);
    if (typeof pr.similarityDifference === "string") parts.push(pr.similarityDifference);
  }
  return parts.join(" ").toLowerCase();
}

function checkContract(p: Record<string, unknown>): ContractCheckResult {
  const missingSections: string[] = [];
  const missingLegislationFields: Array<{ index: number; fields: string[] }> = [];
  const missingPrecedentFields: Array<{ index: number; fields: string[] }> = [];
  const unofficialSourceDetails: string[] = [];
  const unsafeAdvicePhrases: string[] = [];

  // 1. Required top-level sections
  if (!isNonEmpty(p.shortAnswer)) missingSections.push("shortAnswer");

  const lc = p.legalClassification as Record<string, unknown> | null | undefined;
  const hasLegalClassification =
    lc &&
    typeof lc === "object" &&
    Object.values(lc).some((v) =>
      Array.isArray(v) ? (v as unknown[]).some((item) => isNonEmpty(item)) : isNonEmpty(v)
    );
  if (!hasLegalClassification) missingSections.push("legalClassification");

  // missingInformation can be a string or string[]
  const hasMissingInformation = Array.isArray(p.missingInformation)
    ? (p.missingInformation as unknown[]).some((v) => isNonEmpty(v))
    : isNonEmpty(p.missingInformation);
  if (!hasMissingInformation) missingSections.push("missingInformation");

  const lrp = p.lawyerReviewPoints;
  const hasLawyerReviewPoints =
    Array.isArray(lrp) &&
    lrp.length > 0 &&
    (lrp as unknown[]).some((pt) => isNonEmpty(pt));
  if (!hasLawyerReviewPoints) missingSections.push("lawyerReviewPoints");

  // 2. Per-legislation field completeness
  const legislation = Array.isArray(p.relevantLegislation) ? p.relevantLegislation : [];
  for (let i = 0; i < legislation.length; i++) {
    const item = legislation[i] as Record<string, unknown>;
    const missing: string[] = [];
    if (!isNonEmpty(item.legislationName)) missing.push("legislationName");
    if (!isNonEmpty(item.articleNumber)) missing.push("articleNumber");
    if (!isNonEmpty(item.verbatimQuote)) missing.push("verbatimQuote");
    if (!isNonEmpty(item.connection)) missing.push("connection");
    if (missing.length > 0) missingLegislationFields.push({ index: i, fields: missing });
  }

  // 3. Per-precedent field completeness
  const precs = Array.isArray(p.verifiedHighCourtPrecedents) ? p.verifiedHighCourtPrecedents : [];
  for (let i = 0; i < precs.length; i++) {
    const prec = precs[i] as Record<string, unknown>;
    const missing: string[] = [];
    if (!isNonEmpty(prec.courtAndChamber)) missing.push("courtAndChamber");
    // date — missing if absent or is the fallback placeholder
    if (!isNonEmpty(prec.date) || containsFallback(prec.date, PRECEDENT_FALLBACK_STRINGS.date)) {
      missing.push("date");
    }
    if (!isNonEmpty(prec.factSummary) || containsFallback(prec.factSummary, PRECEDENT_FALLBACK_STRINGS.factSummary)) {
      missing.push("factSummary");
    }
    if (!isNonEmpty(prec.legalAssessment) || containsFallback(prec.legalAssessment, PRECEDENT_FALLBACK_STRINGS.legalAssessment)) {
      missing.push("legalAssessment");
    }
    if (!isNonEmpty(prec.outcome) || containsFallback(prec.outcome, PRECEDENT_FALLBACK_STRINGS.outcome)) {
      missing.push("outcome");
    }
    if (!isNonEmpty(prec.similarityDifference) || containsFallback(prec.similarityDifference, PRECEDENT_FALLBACK_STRINGS.similarityDifference)) {
      missing.push("similarityDifference");
    }
    // meritsAndDecisionNumber — required "esas/karar" field
    if (
      !isNonEmpty(prec.meritsAndDecisionNumber) ||
      containsFallback(prec.meritsAndDecisionNumber, PRECEDENT_FALLBACK_STRINGS.meritsAndDecisionNumber)
    ) {
      missing.push("meritsAndDecisionNumber");
    }
    if (missing.length > 0) missingPrecedentFields.push({ index: i, fields: missing });
  }

  // 4. Unofficial source detection
  // 4a. Precedent: accessSource containing "mock" (case-insensitive) is always unofficial
  for (let i = 0; i < precs.length; i++) {
    const prec = precs[i] as Record<string, unknown>;
    const trace = prec.decisionSourceTrace as Record<string, unknown> | undefined;
    if (trace) {
      const accessSource = trace.accessSource as string | undefined;
      if (accessSource && /mock/i.test(accessSource)) {
        unofficialSourceDetails.push(
          `verifiedHighCourtPrecedents[${i}] accessSource is "${accessSource}" (documentId: "${prec.sourceDocumentId ?? "unknown"}"). Mock data must not appear in a physician-facing pack.`
        );
      }
    }
    // Also check top-level accessSource field on the precedent entry itself
    const topAccessSource = prec.accessSource as string | undefined;
    if (topAccessSource && /mock/i.test(topAccessSource) && !trace) {
      unofficialSourceDetails.push(
        `verifiedHighCourtPrecedents[${i}] top-level accessSource is "${topAccessSource}" (documentId: "${prec.sourceDocumentId ?? "unknown"}"). Mock data must not appear in a physician-facing pack.`
      );
    }
  }

  // 4b. Legislation: sourceTrace URLs must point to official Turkish government domains (*.gov.tr)
  for (let i = 0; i < legislation.length; i++) {
    const item = legislation[i] as Record<string, unknown>;
    const sourceTrace = item.sourceTrace as Record<string, unknown> | undefined;
    if (sourceTrace) {
      for (const field of LEGISLATION_SOURCETRACE_URL_FIELDS) {
        const url = sourceTrace[field] as string | null | undefined;
        if (url && !isOfficialLegislationUrl(url)) {
          unofficialSourceDetails.push(
            `relevantLegislation[${i}].sourceTrace.${field} points to unofficial domain: "${url}". Only *.gov.tr sources are permitted for legislation.`
          );
        }
      }
    }
  }

  // 5. MVP forbidden phrase scanning across all free-text fields
  const allText = collectPackText(p);
  for (const phrase of MVP_FORBIDDEN_PHRASES) {
    if (allText.includes(phrase.toLowerCase())) {
      unsafeAdvicePhrases.push(phrase);
    }
  }

  const passed =
    missingSections.length === 0 &&
    missingLegislationFields.length === 0 &&
    missingPrecedentFields.length === 0 &&
    unofficialSourceDetails.length === 0 &&
    unsafeAdvicePhrases.length === 0;

  return {
    passed,
    missingSections,
    missingLegislationFields,
    missingPrecedentFields,
    unofficialSourceDetected: unofficialSourceDetails.length > 0,
    unofficialSourceDetails,
    unsafeAdviceDetected: unsafeAdvicePhrases.length > 0,
    unsafeAdvicePhrases
  };
}

const EMPTY_CONTRACT_CHECK: ContractCheckResult = {
  passed: false,
  missingSections: [],
  missingLegislationFields: [],
  missingPrecedentFields: [],
  unofficialSourceDetected: false,
  unofficialSourceDetails: [],
  unsafeAdviceDetected: false,
  unsafeAdvicePhrases: []
};

export function auditPack(pack: unknown): AuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pack || typeof pack !== "object") {
    return {
      ok: false,
      errors: ["Pack is not an object or is null."],
      warnings: [],
      checkedCounts: {
        legislationItems: 0,
        legislationWithSourceTrace: 0,
        precedents: 0,
        excludedDecisions: 0,
        sourceSummaries: 0,
        unavailableSources: 0
      },
      contractCheck: EMPTY_CONTRACT_CHECK,
      recommendedNextStep: "Provide a valid DoctorLegalInformationPack JSON object."
    };
  }

  const p = pack as Record<string, unknown>;

  // Check MVP-out-of-scope fields
  for (const field of MVP_OUT_OF_SCOPE_FIELDS) {
    if (field in p) {
      errors.push(`MVP-out-of-scope field present: "${field}". Remove this field.`);
    }
  }

  // Check relevantLegislation
  const legislation = Array.isArray(p.relevantLegislation) ? p.relevantLegislation : [];
  const legislationItems = legislation.length;
  let legislationWithSourceTrace = 0;

  for (let i = 0; i < legislation.length; i++) {
    const item = legislation[i] as Record<string, unknown>;
    if (!item.sourceDocumentId) {
      errors.push(`relevantLegislation[${i}] missing sourceDocumentId (legislationName: "${item.legislationName ?? "unknown"}").`);
    } else {
      legislationWithSourceTrace++;
    }
    // Force-status audit warnings
    const docId = String(item.sourceDocumentId ?? "unknown");
    if (item.inForce === "unknown") {
      warnings.push(`Provision ${docId}: yürürlük durumu belirsiz (inForce unknown)`);
    }
    if (item.repealed === true) {
      warnings.push(`Provision ${docId}: yürürlükten kalkmış (repealed)`);
    }
  }

  // Check calibrationStatus presence (warn if no source has calibration info)
  if (!p.calibrationStatus && !p.precedentDiagnostics) {
    warnings.push("No calibrationStatus found. Run probe:precedents to assess live source status.");
  }

  // Check selectionDiagnostics
  if (!p.selectionDiagnostics) {
    warnings.push("selectionDiagnostics is missing. Run in live sourceMode to populate it.");
  }

  // Check precedentDiagnostics
  const precedentDiagnostics = p.precedentDiagnostics as Record<string, unknown> | undefined;
  if (!precedentDiagnostics) {
    warnings.push("precedentDiagnostics is missing. Call buildPrecedentSelectionDiagnostics before packing.");
  }

  // Check sourceSummaries inside precedentDiagnostics
  let sourceSummaries = 0;
  let unavailableSources = 0;
  if (precedentDiagnostics) {
    if (!Array.isArray(precedentDiagnostics.sourceSummaries)) {
      warnings.push("precedentDiagnostics.sourceSummaries is missing or not an array.");
    } else {
      const summaries = precedentDiagnostics.sourceSummaries as Array<Record<string, unknown>>;
      sourceSummaries = summaries.length;
      for (const s of summaries) {
        if (s.unavailableCount && Number(s.unavailableCount) > 0) {
          unavailableSources++;
          warnings.push(`Source "${s.source}" is unavailable in precedentDiagnostics.sourceSummaries (errorCodes: ${JSON.stringify(s.errorCodes ?? [])}).`);
        }
      }
    }
  }

  // Check verifiedHighCourtPrecedents for excluded statuses and trace quality
  const verifiedPrecedents = Array.isArray(p.verifiedHighCourtPrecedents) ? p.verifiedHighCourtPrecedents : [];
  const precedentCount = verifiedPrecedents.length;

  // Cross-check via decisionSourceTrace on decisions if available
  for (let i = 0; i < verifiedPrecedents.length; i++) {
    const prec = verifiedPrecedents[i] as Record<string, unknown>;
    const trace = prec.decisionSourceTrace as Record<string, unknown> | undefined;
    if (trace) {
      if (trace.fullTextAvailable === false) {
        errors.push(`verifiedHighCourtPrecedents[${i}] (documentId: "${prec.sourceDocumentId ?? "unknown"}") has decisionSourceTrace.fullTextAvailable === false. Full text required for verified precedents.`);
      }
      if (trace.eligibilityStatus && trace.eligibilityStatus !== "precedent_usable") {
        errors.push(`verifiedHighCourtPrecedents[${i}] (documentId: "${prec.sourceDocumentId ?? "unknown"}") has eligibilityStatus "${trace.eligibilityStatus}" — only precedent_usable allowed.`);
      }
    }
  }

  // Build a map of documentId -> eligibilityStatus from precedentDiagnostics if available
  const excludedDecisions = Array.isArray(precedentDiagnostics?.excludedDecisions)
    ? (precedentDiagnostics!.excludedDecisions as Array<Record<string, unknown>>)
    : [];
  const excludedDocIds = new Set<string>();
  for (const excl of excludedDecisions) {
    if (EXCLUDED_ELIGIBILITY_STATUSES.has(excl.status as string)) {
      if (excl.documentId) excludedDocIds.add(excl.documentId as string);
      if (excl.sourceDocumentId) excludedDocIds.add(excl.sourceDocumentId as string);
    }
  }

  // Check selectedPrecedents in diagnostics
  if (precedentDiagnostics && Array.isArray(precedentDiagnostics.selectedPrecedents)) {
    const selected = precedentDiagnostics.selectedPrecedents as Array<Record<string, unknown>>;
    for (const s of selected) {
      if (s.status && EXCLUDED_ELIGIBILITY_STATUSES.has(s.status as string)) {
        errors.push(
          `selectedPrecedents contains entry with excluded status "${s.status}" (court: ${s.court ?? "unknown"}, date: ${s.date ?? "unknown"}). This must not appear in verifiedHighCourtPrecedents.`
        );
      }
    }
  }

  // Count sourceWarnings
  const sourceWarnings = Array.isArray(p.sourceWarnings) ? p.sourceWarnings : [];
  if (sourceWarnings.length > 0) {
    warnings.push(`${sourceWarnings.length} sourceWarning(s) present in pack.`);
  }

  // Run contract checks
  const contractCheck = checkContract(p);

  // Surface contract failures as errors
  for (const sec of contractCheck.missingSections) {
    errors.push(`Contract: required section "${sec}" is missing or empty.`);
  }
  for (const { index, fields } of contractCheck.missingLegislationFields) {
    errors.push(`Contract: relevantLegislation[${index}] missing required fields: ${fields.join(", ")}.`);
  }
  for (const { index, fields } of contractCheck.missingPrecedentFields) {
    errors.push(`Contract: verifiedHighCourtPrecedents[${index}] missing or has placeholder in fields: ${fields.join(", ")}.`);
  }
  for (const detail of contractCheck.unofficialSourceDetails) {
    errors.push(`Contract: ${detail}`);
  }
  for (const phrase of contractCheck.unsafeAdvicePhrases) {
    errors.push(`Contract: MVP-forbidden phrase detected in pack text: "${phrase}".`);
  }

  const ok = errors.length === 0;
  let recommendedNextStep: string;
  if (ok && warnings.length === 0) {
    recommendedNextStep = "Pack is clean. Ready for lawyer review.";
  } else if (ok) {
    recommendedNextStep = `Pack has ${warnings.length} warning(s) but no errors. Address warnings before lawyer review.`;
  } else {
    recommendedNextStep = `Pack has ${errors.length} error(s). Fix errors before sending to lawyer review.`;
  }

  return {
    ok,
    errors,
    warnings,
    checkedCounts: {
      legislationItems,
      legislationWithSourceTrace,
      precedents: precedentCount,
      excludedDecisions: excludedDecisions.length,
      sourceSummaries,
      unavailableSources
    },
    contractCheck,
    recommendedNextStep
  };
}
