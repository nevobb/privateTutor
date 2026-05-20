import type { AuthenticatedUser } from "../auth/authTypes";
import { writeDecisionLogEntry as defaultWriteDecisionLogEntry } from "./decisionLogRepository";
import { getWorkspace as defaultGetWorkspace } from "./workspaceRepository";
import { getUploadedFile as defaultGetUploadedFile, updateUploadedFile as defaultUpdateUploadedFile } from "./uploadedFileRepository";
import { listDocumentPages as defaultListDocumentPages } from "./documentPageRepository";
import {
  documentStructuringProvider as defaultDocumentStructuringProvider,
} from "./documentStructuringProviderFactory";
import {
  validateDocumentStructuringResult,
  type DocumentStructuringProvider,
} from "./documentStructuringProvider";
import {
  replaceDetectedQuestions as defaultReplaceDetectedQuestions,
} from "./detectedQuestionRepository";
import { replaceDocumentOutline as defaultReplaceDocumentOutline } from "./documentOutlineRepository";
import type { FileMaterialType } from "../../types";

export type DocumentUnderstandingFailureCode =
  | "workspace_not_found"
  | "file_not_found"
  | "extraction_not_completed"
  | "pages_not_found";

export type DocumentUnderstandingResult =
  | {
      ok: true;
      understandingStatus: "completed";
      materialType: FileMaterialType;
      detectedQuestionCount: number;
      outlineSectionCount: number;
    }
  | { ok: false; code: DocumentUnderstandingFailureCode | "lifecycle_failed" };

interface Deps {
  getWorkspace: typeof defaultGetWorkspace;
  getUploadedFile: typeof defaultGetUploadedFile;
  updateUploadedFile: typeof defaultUpdateUploadedFile;
  listDocumentPages: typeof defaultListDocumentPages;
  replaceDetectedQuestions: typeof defaultReplaceDetectedQuestions;
  replaceDocumentOutline: typeof defaultReplaceDocumentOutline;
  structuringProvider: DocumentStructuringProvider;
  writeDecisionLogEntry: typeof defaultWriteDecisionLogEntry;
}

function defaultDeps(): Deps {
  return {
    getWorkspace: defaultGetWorkspace,
    getUploadedFile: defaultGetUploadedFile,
    updateUploadedFile: defaultUpdateUploadedFile,
    listDocumentPages: defaultListDocumentPages,
    replaceDetectedQuestions: defaultReplaceDetectedQuestions,
    replaceDocumentOutline: defaultReplaceDocumentOutline,
    structuringProvider: defaultDocumentStructuringProvider,
    writeDecisionLogEntry: defaultWriteDecisionLogEntry,
  };
}

const UNDERSTANDING_FAILURE_CODE = "document_understanding_failed";

export interface FileDocumentUnderstandingService {
  runDocumentUnderstandingLifecycleForFile(
    user: AuthenticatedUser,
    workspaceId: string,
    fileId: string
  ): Promise<DocumentUnderstandingResult>;
}

export function createFileDocumentUnderstandingService(
  deps: Deps = defaultDeps()
): FileDocumentUnderstandingService {
  return {
    async runDocumentUnderstandingLifecycleForFile(user, workspaceId, fileId) {
      const workspace = await deps.getWorkspace(user.userId, workspaceId);
      if (!workspace) return { ok: false, code: "workspace_not_found" };

      const file = await deps.getUploadedFile(user.userId, fileId);
      if (!file || file.workspaceId !== workspaceId) return { ok: false, code: "file_not_found" };
      if (file.extractionStatus !== "completed") return { ok: false, code: "extraction_not_completed" };

      const pages = await deps.listDocumentPages(user.userId, workspaceId, fileId);
      if (pages.length === 0) {
        await deps.updateUploadedFile(user.userId, fileId, {
          understandingStatus: "failed",
          understandingErrorCode: "pages_not_found",
          understandingUpdatedAt: new Date(),
        });
        return { ok: false, code: "pages_not_found" };
      }

      await deps.updateUploadedFile(user.userId, fileId, {
        understandingStatus: "processing",
        understandingErrorCode: null,
        understandingUpdatedAt: new Date(),
      });

      try {
        const raw = await deps.structuringProvider.structureDocument({
          userId: user.userId,
          workspaceId,
          fileId,
          fileName: file.name,
          originalFileName: file.originalFileName,
          sourceType: file.sourceType === "pdf" || file.sourceType === "docx" ? file.sourceType : "pdf",
          pages: pages.map((page) => ({
            pageNumber: page.pageNumber,
            extractedText: page.extractedText,
            cleanedText: page.cleanedText,
            textQuality: page.textQuality,
          })),
        });

        const structured = validateDocumentStructuringResult(raw);

        await deps.replaceDetectedQuestions(
          user.userId,
          workspaceId,
          fileId,
          structured.detectedQuestions.map((question, index) => ({
            id: `question_${String(index + 1).padStart(4, "0")}`,
            userId: user.userId,
            workspaceId,
            fileId,
            ...question,
          }))
        );

        await deps.replaceDocumentOutline(user.userId, workspaceId, fileId, {
          id: "current",
          userId: user.userId,
          workspaceId,
          fileId,
          title: structured.title,
          sections: structured.sections,
        });

        await deps.updateUploadedFile(user.userId, fileId, {
          understandingStatus: "completed",
          understandingErrorCode: null,
          understandingUpdatedAt: new Date(),
          materialType: structured.materialType,
        });

        await safeWriteDecisionLogEntry(deps, user.userId, {
          decisionType: "topic_classification",
          title: "Document understanding lifecycle",
          decision: "understanding_completed",
          rationale: `Detected ${structured.detectedQuestions.length} questions and ${structured.sections.length} sections with material type ${structured.materialType}.`,
          workspaceId,
        });

        return {
          ok: true,
          understandingStatus: "completed",
          materialType: structured.materialType,
          detectedQuestionCount: structured.detectedQuestions.length,
          outlineSectionCount: structured.sections.length,
        };
      } catch {
        await deps.updateUploadedFile(user.userId, fileId, {
          understandingStatus: "failed",
          understandingErrorCode: UNDERSTANDING_FAILURE_CODE,
          understandingUpdatedAt: new Date(),
        });

        await safeWriteDecisionLogEntry(deps, user.userId, {
          decisionType: "topic_classification",
          title: "Document understanding lifecycle",
          decision: "understanding_failed",
          rationale: "Document structuring provider or persistence failed.",
          workspaceId,
        });

        return { ok: false, code: "lifecycle_failed" };
      }
    },
  };
}

export const fileDocumentUnderstandingService: FileDocumentUnderstandingService =
  createFileDocumentUnderstandingService();

async function safeWriteDecisionLogEntry(
  deps: Pick<Deps, "writeDecisionLogEntry">,
  userId: string,
  input: Parameters<Deps["writeDecisionLogEntry"]>[1]
): Promise<void> {
  try {
    await deps.writeDecisionLogEntry(userId, input);
  } catch {
    // Non-fatal by design: understanding lifecycle must not fail on decision-log writes.
  }
}
