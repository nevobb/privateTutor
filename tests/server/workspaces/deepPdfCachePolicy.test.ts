import { describe, expect, it } from "vitest";
import {
  CURRENT_DEEP_PDF_ARTIFACT_VERSION,
  DEFAULT_DEEP_PDF_PROVIDER_NAME,
  evaluateDeepPdfCacheState,
  shouldRunDeepPdfProcessing,
  shouldUseExistingDeepPdfResult,
  type DeepPdfCacheDecisionInput,
} from "../../../src/server/workspaces/deepPdfCachePolicy";

function makeInput(overrides: Partial<DeepPdfCacheDecisionInput> = {}): DeepPdfCacheDecisionInput {
  return {
    costMode: "Normal Learning",
    qualityGateDecision: "recommend_advanced_understanding",
    sourceType: "pdf",
    deepPdfStatus: "recommended",
    currentProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
    currentModel: "gemini-2.5-pro",
    currentArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
    currentInputHash: "hash-v1",
    currentStorageGeneration: "gen-v1",
    ...overrides,
  };
}

describe("deepPdfCachePolicy", () => {
  it("uses existing completed result when provider/model/artifact version and identity match", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "completed",
        deepPdfProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
        deepPdfModel: "gemini-2.5-pro",
        deepPdfArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
        deepPdfInputHash: "hash-v1",
      })
    );

    expect(result.decision).toBe("use_existing_result");
    expect(shouldUseExistingDeepPdfResult(result)).toBe(true);
    expect(shouldRunDeepPdfProcessing(result)).toBe(false);
  });

  it("requires reprocess later when completed result has changed source identity", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "completed",
        deepPdfProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
        deepPdfModel: "gemini-2.5-pro",
        deepPdfArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
        deepPdfInputHash: "hash-old",
        currentInputHash: "hash-new",
      })
    );

    expect(result.decision).toBe("reprocess_needed_source_changed");
    expect(shouldUseExistingDeepPdfResult(result)).toBe(false);
    expect(shouldRunDeepPdfProcessing(result)).toBe(false);
  });

  it("requires reprocess later when artifact version changed", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "completed",
        deepPdfProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
        deepPdfModel: "gemini-2.5-pro",
        deepPdfArtifactVersion: "deep_pdf_artifacts_v0",
        deepPdfInputHash: "hash-v1",
      })
    );

    expect(result.decision).toBe("reprocess_needed_version_changed");
    expect(shouldRunDeepPdfProcessing(result)).toBe(false);
  });

  it("marks recommended + Normal Learning as eligible for future auto-run without executing anything", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "recommended",
        costMode: "Normal Learning",
      })
    );

    expect(result.decision).toBe("eligible_for_future_auto_run");
    expect(shouldRunDeepPdfProcessing(result)).toBe(true);
  });

  it("blocks auto-run in Cheap Practice and keeps recommendation only", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "recommended",
        costMode: "Cheap Practice",
      })
    );

    expect(result.decision).toBe("blocked_by_cost_mode");
    expect(shouldRunDeepPdfProcessing(result)).toBe(false);
  });

  it("allows retry later for failed runs when policy would otherwise allow it", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "failed",
        costMode: "Deep Research",
      })
    );

    expect(result.decision).toBe("retry_allowed_later");
    expect(shouldRunDeepPdfProcessing(result)).toBe(true);
  });

  it("prevents duplicate processing while pending", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "pending",
      })
    );

    expect(result.decision).toBe("already_pending");
    expect(shouldRunDeepPdfProcessing(result)).toBe(false);
  });

  it("handles old files with missing new metadata conservatively without crashing", () => {
    const result = evaluateDeepPdfCacheState(
      makeInput({
        deepPdfStatus: "completed",
        deepPdfProviderName: undefined,
        deepPdfModel: undefined,
        deepPdfArtifactVersion: undefined,
        deepPdfInputHash: undefined,
        currentInputHash: undefined,
        deepPdfStorageGeneration: undefined,
        currentStorageGeneration: undefined,
      })
    );

    expect(result.decision).toBe("insufficient_identity_metadata");
    expect(shouldUseExistingDeepPdfResult(result)).toBe(false);
    expect(shouldRunDeepPdfProcessing(result)).toBe(false);
  });
});
