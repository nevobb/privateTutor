import {
  getUploadedFile,
  updateUploadedFile,
} from "./uploadedFileRepository";
import {
  replaceDocumentPages,
  saveDocumentOutline,
  replaceDetectedQuestions,
} from "./documentArtifactRepository";
import {
  pdfParseOutlineProvider,
  type DocumentUnderstandingProvider,
  type DocumentUnderstandingOutput,
} from "./documentUnderstandingProvider";
import type { UploadedFileRecord } from "./workspaceTypes";

type UnderstandingRunFailureCode =
  | "file_not_found"
  | "invalid_transition"
  | "provider_error"
  | "unsupported_provider";

export type DocumentUnderstandingRunResult =
  | { ok: true; file: UploadedFileRecord; output: DocumentUnderstandingOutput }
  | { ok: false; code: UnderstandingRunFailureCode };

export interface DocumentUnderstandingOrchestrationService {
  runTextOnlyUnderstanding(
    userId: string,
    fileId: string
  ): Promise<DocumentUnderstandingRunResult>;
}

interface Dependencies {
  getUploadedFile: typeof getUploadedFile;
  updateUploadedFile: typeof updateUploadedFile;
  replaceDocumentPages: typeof replaceDocumentPages;
  saveDocumentOutline: typeof saveDocumentOutline;
  replaceDetectedQuestions: typeof replaceDetectedQuestions;
  textOnlyProvider: DocumentUnderstandingProvider;
}

function defaultDependencies(): Dependencies {
  return {
    getUploadedFile,
    updateUploadedFile,
    replaceDocumentPages,
    saveDocumentOutline,
    replaceDetectedQuestions,
    textOnlyProvider: pdfParseOutlineProvider,
  };
}

export function createDocumentUnderstandingOrchestrationService(
  deps: Dependencies = defaultDependencies()
): DocumentUnderstandingOrchestrationService {
  return {
    async runTextOnlyUnderstanding(userId, fileId) {
      const current = await deps.getUploadedFile(userId, fileId);
      if (!current) {
        return { ok: false, code: "file_not_found" };
      }

      if (
        current.understandingStatus === "pending" ||
        current.understandingStatus === "completed"
      ) {
        return { ok: false, code: "invalid_transition" };
      }

      const pending = await deps.updateUploadedFile(userId, fileId, {
        understandingStatus: "pending",
        understandingErrorCode: null,
        understandingUpdatedAt: new Date(),
      });
      if (!pending) {
        return { ok: false, code: "file_not_found" };
      }

      try {
        const output = await deps.textOnlyProvider.run({
          userId,
          workspaceId: current.workspaceId ?? "",
          fileId,
          fileName: current.name,
          storagePath: current.storagePath ?? "",
          sourceType: current.sourceType === "pdf" || current.sourceType === "docx" ? current.sourceType : "pdf",
          extractedText: current.extractedText,
          extractedTextCharCount: current.extractedTextCharCount,
          mode: "text_only",
          extractionQuality: current.extractionQuality,
        });

        // Persist artifacts
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

        const outlineTitle = output.outline?.title ?? output.outline?.sections[0]?.label;

        const completed = await deps.updateUploadedFile(userId, fileId, {
          understandingStatus: "completed",
          understandingErrorCode: null,
          understandingUpdatedAt: new Date(),
          pageCount: output.pageCount > 0 ? output.pageCount : undefined,
          outlineTitle,
          detectedQuestionCount: output.detectedQuestions.length,
          extractionQuality: output.extractionQuality ?? undefined,
        });

        if (!completed) {
          return { ok: false, code: "file_not_found" };
        }

        return { ok: true, file: completed, output };
      } catch {
        const failed = await deps.updateUploadedFile(userId, fileId, {
          understandingStatus: "failed",
          understandingErrorCode: "understanding_lifecycle_failed",
          understandingUpdatedAt: new Date(),
        });

        if (!failed) {
          return { ok: false, code: "file_not_found" };
        }

        return { ok: false, code: "provider_error" };
      }
    },
  };
}

export const documentUnderstandingOrchestrationService: DocumentUnderstandingOrchestrationService =
  createDocumentUnderstandingOrchestrationService();
