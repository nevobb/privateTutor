import type { CostMode } from "../../types/index";
import {
  evaluateDeepPdfCacheState,
  shouldRunDeepPdfProcessing,
  shouldUseExistingDeepPdfResult,
  CURRENT_DEEP_PDF_ARTIFACT_VERSION,
  DEFAULT_DEEP_PDF_PROVIDER_NAME,
} from "./deepPdfCachePolicy";
import type { FirebaseStoragePdfBytesLoader } from "./firebaseStoragePdfBytesLoader";
import { firebaseStoragePdfBytesLoader } from "./firebaseStoragePdfBytesLoader";
import type { DocumentUnderstandingProvider } from "./documentUnderstandingProvider";
import { GeminiPdfUnderstandingProvider } from "./documentUnderstandingProvider";
import { DEFAULT_GEMINI_DOCUMENT_MODEL } from "./geminiPdfUnderstandingClient";
import {
  getUploadedFile,
  updateUploadedFile,
} from "./uploadedFileRepository";
import {
  replaceDocumentPages,
  saveDocumentOutline,
  replaceDetectedQuestions,
} from "./documentArtifactRepository";
import type { UploadedFileRecord } from "./workspaceTypes";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type DeepPdfRunStatus = "completed" | "skipped" | "failed";

export type DeepPdfRunResult = {
  status: DeepPdfRunStatus;
  file?: UploadedFileRecord;
  skipReason?: string;
  errorCode?: string;
};

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface DeepPdfOrchestrationService {
  runDeepPdfUnderstanding(
    userId: string,
    fileId: string,
    options?: { costMode?: CostMode }
  ): Promise<DeepPdfRunResult>;
}

// ---------------------------------------------------------------------------
// Dependencies (fully injectable for testing)
// ---------------------------------------------------------------------------

export interface DeepPdfOrchestrationDeps {
  getUploadedFile: typeof getUploadedFile;
  updateUploadedFile: typeof updateUploadedFile;
  replaceDocumentPages: typeof replaceDocumentPages;
  saveDocumentOutline: typeof saveDocumentOutline;
  replaceDetectedQuestions: typeof replaceDetectedQuestions;
  deepPdfProvider: DocumentUnderstandingProvider;
  pdfBytesLoader: FirebaseStoragePdfBytesLoader;
  providerName: string;
  modelName: string;
  getApiKey(): string | undefined;
}

function defaultDeps(): DeepPdfOrchestrationDeps {
  return {
    getUploadedFile,
    updateUploadedFile,
    replaceDocumentPages,
    saveDocumentOutline,
    replaceDetectedQuestions,
    deepPdfProvider: new GeminiPdfUnderstandingProvider(),
    pdfBytesLoader: firebaseStoragePdfBytesLoader,
    providerName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
    modelName: process.env.GEMINI_DOCUMENT_MODEL?.trim() || DEFAULT_GEMINI_DOCUMENT_MODEL,
    getApiKey: () => process.env.GEMINI_API_KEY,
  };
}

// ---------------------------------------------------------------------------
// Artifact persistence helper (mirrors text-only orchestration pattern)
// ---------------------------------------------------------------------------

async function persistArtifacts(
  deps: Pick<DeepPdfOrchestrationDeps, "replaceDocumentPages" | "saveDocumentOutline" | "replaceDetectedQuestions">,
  userId: string,
  fileId: string,
  output: import("./documentUnderstandingProvider").DocumentUnderstandingOutput
): Promise<void> {
  if (output.pages.length > 0) {
    await deps.replaceDocumentPages(
      userId,
      fileId,
      output.pages.map((p) => ({
        pageId: p.pageId,
        fileId,
        pageNumber: p.pageNumber,
        extractedText: p.extractedText,
        cleanedText: p.cleanedText,
        textQuality: p.textQuality,
        charCount: p.charCount,
        sourceChunkIds: p.sourceChunkIds,
      }))
    );
  }

  if (output.outline) {
    await deps.saveDocumentOutline(userId, fileId, {
      outlineId: output.outline.outlineId,
      fileId,
      title: output.outline.title,
      sections: output.outline.sections,
      confidence: output.outline.confidence,
    });
  }

  if (output.detectedQuestions.length > 0) {
    await deps.replaceDetectedQuestions(
      userId,
      fileId,
      output.detectedQuestions.map((q) => ({
        questionId: q.questionId,
        fileId,
        label: q.label,
        questionNumber: q.questionNumber,
        topic: q.topic,
        summary: q.summary,
        pageStart: q.pageStart,
        pageEnd: q.pageEnd,
        charStart: q.charStart,
        charEnd: q.charEnd,
        sourceChunkIds: q.sourceChunkIds,
        subsections: q.subsections,
        confidence: q.confidence,
        extractionNotes: q.extractionNotes,
      }))
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeepPdfOrchestrationService(
  deps: DeepPdfOrchestrationDeps = defaultDeps()
): DeepPdfOrchestrationService {
  return {
    async runDeepPdfUnderstanding(userId, fileId, options) {
      // ── 1. Load file record ──────────────────────────────────────────────
      const file = await deps.getUploadedFile(userId, fileId);
      if (!file) {
        return { status: "failed", errorCode: "file_not_found" };
      }

      // ── 2. Basic structural guards ───────────────────────────────────────
      if (file.sourceType !== "pdf") {
        return { status: "skipped", file, skipReason: "wrong_source_type" };
      }

      if (!file.storagePath) {
        return { status: "skipped", file, skipReason: "missing_storage_path" };
      }

      // ── 3. API key guard ─────────────────────────────────────────────────
      const apiKey = deps.getApiKey();
      if (!apiKey) {
        return { status: "skipped", file, skipReason: "missing_api_key" };
      }

      // ── 4. Cache policy evaluation ───────────────────────────────────────
      const effectiveCostMode: CostMode = options?.costMode ?? "Normal Learning";

      const cacheResult = evaluateDeepPdfCacheState({
        costMode: effectiveCostMode,
        // deepPdfStatus "recommended" or "failed" implies quality gate said so
        qualityGateDecision:
          file.deepPdfStatus === "recommended" || file.deepPdfStatus === "failed"
            ? "recommend_advanced_understanding"
            : undefined,
        sourceType: file.sourceType,
        deepPdfStatus: file.deepPdfStatus,
        deepPdfProviderName: file.deepPdfProviderName,
        deepPdfModel: file.deepPdfModel,
        deepPdfInputHash: file.deepPdfInputHash,
        deepPdfStorageGeneration: file.deepPdfStorageGeneration,
        deepPdfArtifactVersion: file.deepPdfArtifactVersion,
        currentProviderName: deps.providerName,
        currentModel: deps.modelName,
        currentArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
      });

      if (shouldUseExistingDeepPdfResult(cacheResult)) {
        return { status: "skipped", file, skipReason: `cache_${cacheResult.decision}` };
      }

      if (!shouldRunDeepPdfProcessing(cacheResult)) {
        return { status: "skipped", file, skipReason: cacheResult.decision };
      }

      // ── 5. Mark pending (optimistic lock against duplicate runs) ─────────
      const pendingFile = await deps.updateUploadedFile(userId, fileId, {
        deepPdfStatus: "pending",
        deepPdfUpdatedAt: new Date(),
        deepPdfErrorCode: null,
      });
      if (!pendingFile) {
        return { status: "failed", errorCode: "file_not_found" };
      }

      try {
        // ── 6. Load PDF bytes ────────────────────────────────────────────────
        const bytesResult = await deps.pdfBytesLoader.loadPdfBytesWithMetadata({
          userId,
          workspaceId: file.workspaceId ?? "",
          fileId,
          fileName: file.name,
          storagePath: file.storagePath,
          sourceType: file.sourceType,
        });

        if (!bytesResult.ok) {
          const failedFile = await deps.updateUploadedFile(userId, fileId, {
            deepPdfStatus: "failed",
            deepPdfErrorCode: `bytes_load_failed:${bytesResult.code}`,
            deepPdfUpdatedAt: new Date(),
          });
          return {
            status: "failed",
            file: failedFile ?? pendingFile,
            errorCode: `bytes_load_failed:${bytesResult.code}`,
          };
        }

        const { bytes, inputHash, storageGeneration } = bytesResult;

        // ── 7. Call Gemini provider with inline bytes ────────────────────────
        const providerOutput = await deps.deepPdfProvider.run({
          userId,
          workspaceId: file.workspaceId ?? "",
          fileId,
          fileName: file.name,
          storagePath: file.storagePath,
          sourceType: "pdf",
          pdfBytes: bytes,
          mode: "deep_pdf",
        });

        if (providerOutput.errors.length > 0) {
          const firstError = providerOutput.errors[0] ?? "unknown_provider_error";
          const failedFile = await deps.updateUploadedFile(userId, fileId, {
            deepPdfStatus: "failed",
            deepPdfErrorCode: `provider_error:${firstError.slice(0, 120)}`,
            deepPdfUpdatedAt: new Date(),
          });
          return {
            status: "failed",
            file: failedFile ?? pendingFile,
            errorCode: "provider_error",
          };
        }

        // ── 8. Persist artifacts ─────────────────────────────────────────────
        await persistArtifacts(deps, userId, fileId, providerOutput);

        // ── 9. Mark completed + store identity metadata ──────────────────────
        const outlineTitle =
          providerOutput.outline?.title ?? providerOutput.outline?.sections[0]?.label;

        const now = new Date();
        const completedFile = await deps.updateUploadedFile(userId, fileId, {
          deepPdfStatus: "completed",
          understandingMode: "deep_pdf",
          deepPdfProviderName: deps.providerName,
          deepPdfModel: deps.modelName,
          deepPdfInputHash: inputHash,
          deepPdfStorageGeneration: storageGeneration,
          deepPdfArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
          deepPdfCompletedAt: now,
          deepPdfUpdatedAt: now,
          deepPdfErrorCode: null,
          // Upgrade file-level metadata from provider output if available
          pageCount: providerOutput.pageCount > 0 ? providerOutput.pageCount : file.pageCount,
          outlineTitle: outlineTitle ?? file.outlineTitle,
          detectedQuestionCount:
            providerOutput.detectedQuestions.length > 0
              ? providerOutput.detectedQuestions.length
              : file.detectedQuestionCount,
          extractionQuality: providerOutput.extractionQuality ?? file.extractionQuality,
        });

        return {
          status: "completed",
          file: completedFile ?? pendingFile,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        const failedFile = await deps.updateUploadedFile(userId, fileId, {
          deepPdfStatus: "failed",
          deepPdfErrorCode: `orchestration_error:${message.slice(0, 120)}`,
          deepPdfUpdatedAt: new Date(),
        });
        return {
          status: "failed",
          file: failedFile ?? undefined,
          errorCode: "orchestration_error",
        };
      }
    },
  };
}

export const deepPdfOrchestrationService: DeepPdfOrchestrationService =
  createDeepPdfOrchestrationService();
