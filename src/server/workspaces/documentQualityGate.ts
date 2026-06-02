import type { CostMode, ExtractionQuality } from "../../types/index";
import type { DocumentQualitySignals, DocumentUnderstandingMode } from "./documentUnderstandingProvider";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type QualityGateDecision =
  | "use_text_only"
  | "recommend_advanced_understanding"
  | "requires_user_confirmation_or_higher_cost_mode"
  | "insufficient_input";

export type QualityGateReason =
  | "clean_text"
  | "weak_extracted_text"
  | "math_heavy"
  | "visual_reference"
  | "scanned_like"
  | "layout_complex"
  | "missing_extracted_text"
  | "cost_mode_restricted";

export type DocumentQualityGateInput = {
  // From uploaded file metadata (may be undefined for old files)
  extractionQuality?: ExtractionQuality | null;
  extractedTextCharCount?: number;
  pageCount?: number;
  detectedQuestionCount?: number;
  sourceType?: "pdf" | "docx" | "note" | "other";
  // From provider qualitySignals (may be absent if understanding not yet run)
  qualitySignals?: DocumentQualitySignals;
  // Policy context
  costMode?: CostMode;
  // User/session signals (future use — present but not required)
  hasVisualContentRequest?: boolean;
};

export type DocumentQualityGateOutput = {
  decision: QualityGateDecision;
  recommendedProviderMode: DocumentUnderstandingMode;
  reasons: QualityGateReason[];
  confidence: "high" | "medium" | "low";
  extractionQuality: ExtractionQuality | null;
  shouldRunAutomatically: boolean;
  shouldShowUserNoticeLater: boolean;
  safeFallbackProviderMode: DocumentUnderstandingMode;
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const WEAK_TEXT_CHAR_THRESHOLD = 200;
const POOR_TEXT_CHAR_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Internal signal evaluation
// ---------------------------------------------------------------------------

function resolveExtractionQuality(input: DocumentQualityGateInput): ExtractionQuality | null {
  // Prefer explicit file metadata over qualitySignals derivation
  if (input.extractionQuality != null) {
    return input.extractionQuality;
  }
  if (input.qualitySignals) {
    const { textQuality } = input.qualitySignals;
    if (textQuality === "empty" || textQuality === "poor") return "poor";
    if (textQuality === "partial") return "partial";
    if (textQuality === "good") return "good";
  }
  return null;
}

function isMissingText(input: DocumentQualityGateInput): boolean {
  if (input.qualitySignals && !input.qualitySignals.hasExtractedText) return true;
  if (input.extractedTextCharCount !== undefined && input.extractedTextCharCount === 0) return true;
  return false;
}

function isWeakText(input: DocumentQualityGateInput): boolean {
  const charCount =
    input.qualitySignals?.extractedTextCharCount ?? input.extractedTextCharCount ?? null;

  if (charCount === null) return false;
  return charCount < WEAK_TEXT_CHAR_THRESHOLD;
}

function isScannedLike(input: DocumentQualityGateInput): boolean {
  // Very few chars for a PDF almost certainly means scanned/image-only
  const charCount =
    input.qualitySignals?.extractedTextCharCount ?? input.extractedTextCharCount ?? null;

  if (charCount === null) return false;
  if (input.sourceType !== "pdf") return false;
  return charCount < POOR_TEXT_CHAR_THRESHOLD;
}

function isMathHeavy(input: DocumentQualityGateInput): boolean {
  return input.qualitySignals?.likelyHasMath === true;
}

function hasVisualSignal(input: DocumentQualityGateInput): boolean {
  if (input.qualitySignals?.likelyHasVisualContent === true) return true;
  if (input.hasVisualContentRequest === true) return true;
  return false;
}

function isCleanText(input: DocumentQualityGateInput): boolean {
  const eq = resolveExtractionQuality(input);
  if (eq !== "good") return false;

  const charCount =
    input.qualitySignals?.extractedTextCharCount ?? input.extractedTextCharCount ?? null;

  if (charCount !== null && charCount < WEAK_TEXT_CHAR_THRESHOLD) return false;
  if (isMathHeavy(input)) return false;
  if (hasVisualSignal(input)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Cost mode policy
// ---------------------------------------------------------------------------

function costModeAllowsAutoRun(_costMode: CostMode | undefined): boolean {
  // In this batch, no cost mode triggers actual auto-run.
  // This function exists so Batch 5 can replace it cleanly.
  return false;
}

function costModeAllowsRecommendation(costMode: CostMode | undefined): boolean {
  // Cheap Practice: recommendation allowed but user cannot act on it automatically
  // Normal Learning / Deep Research: recommendation allowed
  if (costMode === undefined) return true;
  return true;
}

function costModeIsRestrictive(costMode: CostMode | undefined): boolean {
  return costMode === "Cheap Practice";
}

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

export function evaluateDocumentQualityGate(
  input: DocumentQualityGateInput
): DocumentQualityGateOutput {
  const reasons: QualityGateReason[] = [];
  const eq = resolveExtractionQuality(input);
  const missing = isMissingText(input);
  const scanned = isScannedLike(input);
  const weak = isWeakText(input);
  const mathHeavy = isMathHeavy(input);
  const visual = hasVisualSignal(input);
  const clean = isCleanText(input);
  const restrictive = costModeIsRestrictive(input.costMode);

  // No usable signals at all
  if (
    input.extractionQuality == null &&
    input.qualitySignals == null &&
    input.extractedTextCharCount == null
  ) {
    return {
      decision: "insufficient_input",
      recommendedProviderMode: "text_only",
      reasons: ["missing_extracted_text"],
      confidence: "low",
      extractionQuality: null,
      shouldRunAutomatically: false,
      shouldShowUserNoticeLater: false,
      safeFallbackProviderMode: "text_only",
    };
  }

  // Collect all escalation reasons before deciding
  if (missing) reasons.push("missing_extracted_text");
  if (scanned) reasons.push("scanned_like");
  if (weak && !scanned) reasons.push("weak_extracted_text");
  if (mathHeavy) reasons.push("math_heavy");
  if (visual) reasons.push("visual_reference");

  const needsAdvanced = missing || scanned || (weak && eq !== "good") || mathHeavy || visual;

  if (!needsAdvanced && clean) {
    return {
      decision: "use_text_only",
      recommendedProviderMode: "text_only",
      reasons: ["clean_text"],
      confidence: "high",
      extractionQuality: eq,
      shouldRunAutomatically: false,
      shouldShowUserNoticeLater: false,
      safeFallbackProviderMode: "text_only",
    };
  }

  if (needsAdvanced && costModeAllowsRecommendation(input.costMode)) {
    // Cost mode restricts auto-run for Cheap Practice
    if (restrictive) {
      reasons.push("cost_mode_restricted");
      return {
        decision: "requires_user_confirmation_or_higher_cost_mode",
        recommendedProviderMode: "deep_pdf",
        reasons,
        confidence: reasons.length > 2 ? "high" : "medium",
        extractionQuality: eq,
        shouldRunAutomatically: false,
        shouldShowUserNoticeLater: true,
        safeFallbackProviderMode: "text_only",
      };
    }

    // Normal Learning / Deep Research / undefined: recommend but don't auto-run yet
    const autoRun = costModeAllowsAutoRun(input.costMode);
    return {
      decision: "recommend_advanced_understanding",
      recommendedProviderMode: "deep_pdf",
      reasons,
      confidence: reasons.length >= 2 ? "high" : "medium",
      extractionQuality: eq,
      shouldRunAutomatically: autoRun,
      shouldShowUserNoticeLater: !autoRun,
      safeFallbackProviderMode: "text_only",
    };
  }

  // Partial quality — text-only is acceptable but not ideal
  return {
    decision: "use_text_only",
    recommendedProviderMode: "text_only",
    reasons: reasons.length > 0 ? reasons : ["clean_text"],
    confidence: "medium",
    extractionQuality: eq,
    shouldRunAutomatically: false,
    shouldShowUserNoticeLater: false,
    safeFallbackProviderMode: "text_only",
  };
}
