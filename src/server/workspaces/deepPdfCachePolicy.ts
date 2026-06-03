import type { CostMode, DeepPdfStatus } from "../../types";

export const CURRENT_DEEP_PDF_ARTIFACT_VERSION = "deep_pdf_artifacts_v1";
export const DEFAULT_DEEP_PDF_PROVIDER_NAME = "gemini_pdf_understanding";

export type DeepPdfCacheDecision =
  | "use_existing_result"
  | "eligible_for_future_auto_run"
  | "blocked_by_cost_mode"
  | "reprocess_needed_source_changed"
  | "reprocess_needed_version_changed"
  | "reprocess_needed_provider_changed"
  | "retry_allowed_later"
  | "already_pending"
  | "insufficient_identity_metadata"
  | "not_eligible";

export type DeepPdfCacheDecisionInput = {
  costMode?: CostMode;
  qualityGateDecision?:
    | "use_text_only"
    | "recommend_advanced_understanding"
    | "requires_user_confirmation_or_higher_cost_mode"
    | "insufficient_input";
  sourceType?: "pdf" | "docx" | "note" | "other";
  deepPdfStatus?: DeepPdfStatus;
  deepPdfProviderName?: string | null;
  deepPdfModel?: string | null;
  deepPdfInputHash?: string | null;
  deepPdfStorageGeneration?: string | null;
  deepPdfArtifactVersion?: string | null;
  currentProviderName?: string | null;
  currentModel?: string | null;
  currentInputHash?: string | null;
  currentStorageGeneration?: string | null;
  currentArtifactVersion?: string | null;
};

export type DeepPdfCacheDecisionResult = {
  decision: DeepPdfCacheDecision;
  shouldUseExistingResult: boolean;
  shouldRunProcessing: boolean;
};

export function evaluateDeepPdfCacheState(
  input: DeepPdfCacheDecisionInput
): DeepPdfCacheDecisionResult {
  if (input.deepPdfStatus === "pending") {
    return makeDecision("already_pending");
  }

  if (input.deepPdfStatus === "completed") {
    const currentArtifactVersion = input.currentArtifactVersion ?? CURRENT_DEEP_PDF_ARTIFACT_VERSION;
    const hasProviderMatch =
      Boolean(input.deepPdfProviderName) &&
      Boolean(input.currentProviderName) &&
      input.deepPdfProviderName === input.currentProviderName;
    const hasModelMatch =
      Boolean(input.deepPdfModel) &&
      Boolean(input.currentModel) &&
      input.deepPdfModel === input.currentModel;
    const hasArtifactVersionMatch =
      Boolean(input.deepPdfArtifactVersion) &&
      input.deepPdfArtifactVersion === currentArtifactVersion;
    const hasInputHashMatch =
      Boolean(input.deepPdfInputHash) &&
      Boolean(input.currentInputHash) &&
      input.deepPdfInputHash === input.currentInputHash;
    const hasStorageGenerationMatch =
      Boolean(input.deepPdfStorageGeneration) &&
      Boolean(input.currentStorageGeneration) &&
      input.deepPdfStorageGeneration === input.currentStorageGeneration;
    const hasAnyIdentityPair =
      (Boolean(input.deepPdfInputHash) && Boolean(input.currentInputHash)) ||
      (Boolean(input.deepPdfStorageGeneration) && Boolean(input.currentStorageGeneration));

    if (!hasAnyIdentityPair || !input.deepPdfProviderName || !input.deepPdfModel || !input.deepPdfArtifactVersion) {
      return makeDecision("insufficient_identity_metadata");
    }

    if (!(hasInputHashMatch || hasStorageGenerationMatch)) {
      return makeDecision("reprocess_needed_source_changed");
    }

    if (!hasArtifactVersionMatch) {
      return makeDecision("reprocess_needed_version_changed");
    }

    if (!hasProviderMatch || !hasModelMatch) {
      return makeDecision("reprocess_needed_provider_changed");
    }

    return makeDecision("use_existing_result");
  }

  if (input.deepPdfStatus === "failed") {
    if (allowsFutureAutoRun(input)) {
      return makeDecision("retry_allowed_later");
    }
    return makeDecision("blocked_by_cost_mode");
  }

  if (input.deepPdfStatus === "recommended") {
    if (allowsFutureAutoRun(input)) {
      return makeDecision("eligible_for_future_auto_run");
    }
    return makeDecision("blocked_by_cost_mode");
  }

  return makeDecision("not_eligible");
}

export function shouldUseExistingDeepPdfResult(result: DeepPdfCacheDecisionResult): boolean {
  return result.shouldUseExistingResult;
}

export function shouldRunDeepPdfProcessing(result: DeepPdfCacheDecisionResult): boolean {
  return result.shouldRunProcessing;
}

function allowsFutureAutoRun(input: DeepPdfCacheDecisionInput): boolean {
  if (input.sourceType !== "pdf") {
    return false;
  }

  if (
    input.qualityGateDecision !== "recommend_advanced_understanding" &&
    input.qualityGateDecision !== "requires_user_confirmation_or_higher_cost_mode"
  ) {
    return false;
  }

  if (input.costMode === "Cheap Practice") {
    return false;
  }

  return input.costMode === "Normal Learning" || input.costMode === "Deep Research";
}

function makeDecision(decision: DeepPdfCacheDecision): DeepPdfCacheDecisionResult {
  return {
    decision,
    shouldUseExistingResult: decision === "use_existing_result",
    shouldRunProcessing:
      decision === "eligible_for_future_auto_run" || decision === "retry_allowed_later",
  };
}
