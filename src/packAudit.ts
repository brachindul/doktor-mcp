/**
 * Pack audit — validates a DoctorLegalInformationPack for compliance with MVP constraints.
 */

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
  }

  // Check selectionDiagnostics
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
    recommendedNextStep
  };
}
