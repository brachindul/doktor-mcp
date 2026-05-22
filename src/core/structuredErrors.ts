/**
 * Structured error contract used across source adapters. Mirrors local-yargi
 * source-engine error taxonomy so MCP clients see a uniform shape:
 *
 *   - `source_blocked`     : Source actively rejected us (429 / 403 with cool-down).
 *   - `source_error`       : Network / 5xx / unspecified transport failure.
 *   - `parse_failed`       : Response received but cannot be parsed.
 *   - `document_not_found` : 404 for a specific document.
 *
 * `retryable` tells the orchestrator whether to keep the source in the
 * rotation; `recommendedNextStep` is a human-facing hint.
 */
export type StructuredErrorCode =
  | "source_blocked"
  | "source_error"
  | "parse_failed"
  | "document_not_found";

export interface StructuredError {
  errorCode: StructuredErrorCode;
  message: string;
  retryable: boolean;
  recommendedNextStep: string;
}

export function buildSourceBlocked(message: string, recommendedNextStep = "Retry after the source cools down."): StructuredError {
  return { errorCode: "source_blocked", message, retryable: true, recommendedNextStep };
}

export function buildSourceError(message: string, retryable = true, recommendedNextStep = "Retry the request."): StructuredError {
  return { errorCode: "source_error", message, retryable, recommendedNextStep };
}

export function buildParseFailed(message: string, recommendedNextStep = "Verify the upstream endpoint format."): StructuredError {
  return { errorCode: "parse_failed", message, retryable: false, recommendedNextStep };
}

export function buildDocumentNotFound(message: string, recommendedNextStep = "Document is not available at the source."): StructuredError {
  return { errorCode: "document_not_found", message, retryable: false, recommendedNextStep };
}
