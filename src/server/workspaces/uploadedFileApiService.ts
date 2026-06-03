import type { AuthenticatedUser } from "../auth/authTypes";
import type { CostMode } from "../../types/index";
import { writeDecisionLogEntry } from "./decisionLogRepository";
import { getWorkspace } from "./workspaceRepository";
import {
  createUploadedFile,
  getUploadedFile,
  listUploadedFiles,
  updateUploadedFile,
} from "./uploadedFileRepository";
import {
  documentUnderstandingOrchestrationService as defaultDocumentUnderstandingOrchestrationService,
  type DocumentUnderstandingOrchestrationService,
} from "./documentUnderstandingOrchestrationService";
import {
  deepPdfOrchestrationService as defaultDeepPdfOrchestrationService,
  type DeepPdfOrchestrationService,
} from "./deepPdfOrchestrationService";
import { fileExtractionProvider as defaultFileExtractionProvider } from "./fileExtractionProvider";
import { realDocumentExtractionProvider } from "./realDocumentExtractionProvider";
import type { FileExtractionProvider } from "./fileExtractionProvider";
import { chunkExtractedText } from "./fileChunker";
import { evaluateDocumentQualityGate as defaultEvaluateDocumentQualityGate } from "./documentQualityGate";
import {
  listFileChunks as defaultListFileChunks,
  replaceFileChunks as defaultReplaceFileChunks,
} from "./fileChunkRepository";
import type { CreateUploadedFileApiRequest } from "./uploadedFileApiSchemas";
import type { UploadedFileRecord } from "./workspaceTypes";

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const SUMMARY_PLACEHOLDER_TEXT = "Summary placeholder; content extraction not enabled yet.";
const SUMMARY_FAILURE_CODE = "summary_lifecycle_failed";
const EXTRACTION_FAILURE_CODE = "extraction_lifecycle_failed";
const EXTRACTION_PREVIEW_MAX_CHARS = 280;
const CHUNKING_FAILURE_CODE = "chunking_lifecycle_failed";

type SummaryRunFailureCode = "workspace_not_found" | "file_not_found" | "invalid_transition";

type SummaryRunResult =
  | { ok: true; file: UploadedFileRecord }
  | { ok: false; code: SummaryRunFailureCode };

type ExtractionRunFailureCode =
  | "workspace_not_found"
  | "file_not_found"
  | "missing_storage_path"
  | "unsupported_source_type"
  | "invalid_transition";

type ExtractionRunResult =
  | { ok: true; file: UploadedFileRecord }
  | { ok: false; code: ExtractionRunFailureCode };

type ChunkingRunFailureCode =
  | "workspace_not_found"
  | "file_not_found"
  | "extraction_not_completed"
  | "missing_extracted_text"
  | "invalid_transition";

type ChunkingRunResult =
  | { ok: true; file: UploadedFileRecord; chunkCount: number }
  | { ok: false; code: ChunkingRunFailureCode };

export interface UploadedFileApiService {
  createFileForWorkspace(
    user: AuthenticatedUser,
    workspaceId: string,
    input: CreateUploadedFileApiRequest
  ): Promise<UploadedFileRecord | null>;
  listFilesForWorkspace(user: AuthenticatedUser, workspaceId: string): Promise<UploadedFileRecord[] | null>;
  runSummaryLifecycleForFile(
    user: AuthenticatedUser,
    workspaceId: string,
    fileId: string
  ): Promise<SummaryRunResult>;
  runExtractionLifecycleForFile(
    user: AuthenticatedUser,
    workspaceId: string,
    fileId: string,
    fileBuffer?: Buffer
  ): Promise<ExtractionRunResult>;
  runChunkingLifecycleForFile(
    user: AuthenticatedUser,
    workspaceId: string,
    fileId: string,
    options?: { costMode?: CostMode }
  ): Promise<ChunkingRunResult>;
}

export class UploadedFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadedFileValidationError";
  }
}

interface Repositories {
  getWorkspace: typeof getWorkspace;
  createUploadedFile: typeof createUploadedFile;
  getUploadedFile: typeof getUploadedFile;
  updateUploadedFile: typeof updateUploadedFile;
  listUploadedFiles: typeof listUploadedFiles;
  writeDecisionLogEntry: typeof writeDecisionLogEntry;
  fileExtractionProvider: typeof defaultFileExtractionProvider;
  listFileChunks: typeof defaultListFileChunks;
  replaceFileChunks: typeof defaultReplaceFileChunks;
  documentUnderstandingOrchestrationService: DocumentUnderstandingOrchestrationService;
  evaluateDocumentQualityGate: typeof defaultEvaluateDocumentQualityGate;
  deepPdfOrchestrationService?: DeepPdfOrchestrationService;
}

function getDefaultExtractionProvider(fileBuffer?: Buffer): FileExtractionProvider {
  if (fileBuffer && process.env.REAL_DOCUMENT_PARSER !== "0") {
    return realDocumentExtractionProvider;
  }
  return defaultFileExtractionProvider;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace,
    createUploadedFile,
    getUploadedFile,
    updateUploadedFile,
    listUploadedFiles,
    writeDecisionLogEntry,
    fileExtractionProvider: defaultFileExtractionProvider,
    listFileChunks: defaultListFileChunks,
    replaceFileChunks: defaultReplaceFileChunks,
    documentUnderstandingOrchestrationService: defaultDocumentUnderstandingOrchestrationService,
    evaluateDocumentQualityGate: defaultEvaluateDocumentQualityGate,
    deepPdfOrchestrationService: defaultDeepPdfOrchestrationService,
  };
}

export function createUploadedFileApiService(
  repositories: Repositories = defaultRepositories()
): UploadedFileApiService {
  return {
    async createFileForWorkspace(user, workspaceId, input) {
      const workspace = await repositories.getWorkspace(user.userId, workspaceId);
      if (!workspace) {
        return null;
      }

      if (input.storagePath) {
        validateStoragePathOwnership(input.storagePath, user.userId, workspaceId, input.fileName);
      }

      const topic = inferTopic(input.fileName, input.topicHint);
      const confidence = inferConfidence(input.fileName, input.topicHint);
      const assignmentStatus: UploadedFileRecord["assignmentStatus"] =
        confidence < LOW_CONFIDENCE_THRESHOLD ? "needs-review" : "assigned";

      const created = await repositories.createUploadedFile(user.userId, {
        workspaceId,
        name: input.fileName,
        originalFileName: input.originalFileName,
        sourceType: input.sourceType,
        storagePath: input.storagePath,
        topicHint: input.topicHint,
        topic,
        confidence,
        assignmentStatus,
        indexingStatus: "uploaded",
        summaryStatus: "not_requested",
        summaryText: null,
        summarySource: "none",
        summaryErrorCode: null,
        summaryUpdatedAt: null,
        extractionStatus: "not_started",
        extractedText: undefined,
        extractedTextPreview: undefined,
        extractedTextCharCount: undefined,
        extractionSource: undefined,
        extractionErrorCode: null,
        extractionUpdatedAt: null,
        understandingStatus: "not_started",
        understandingErrorCode: null,
        understandingUpdatedAt: null,
        pageCount: undefined,
        outlineTitle: undefined,
        detectedQuestionCount: undefined,
        extractionQuality: undefined,
        chunkingStatus: "not_started",
        chunkCount: undefined,
        chunkingErrorCode: null,
        chunkingUpdatedAt: null,
        deepPdfStatus: "not_started",
        deepPdfProviderName: undefined,
        deepPdfModel: undefined,
        deepPdfInputHash: undefined,
        deepPdfStorageGeneration: undefined,
        deepPdfArtifactVersion: undefined,
        deepPdfCompletedAt: null,
        deepPdfErrorCode: null,
        deepPdfUpdatedAt: null,
        understandingMode: "text_only",
      });

      await Promise.all([
        repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_assignment",
          title: "File assignment status",
          decision:
            assignmentStatus === "assigned"
              ? "File assigned automatically to workspace topic context."
              : "File needs manual review before assignment.",
          rationale: `Assignment confidence ${confidence.toFixed(2)} for topic \"${topic}\".`,
          workspaceId,
        }),
        repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "topic_classification",
          title: "Topic classification",
          decision: `Classified as \"${topic}\" with confidence ${confidence.toFixed(2)}.`,
          rationale: input.topicHint
            ? "Used topicHint plus filename signal for deterministic baseline classification."
            : "Used filename heuristic for deterministic baseline classification.",
          workspaceId,
        }),
      ]);

      let current = created;
      try {
        const indexing = await repositories.updateUploadedFile(user.userId, created.id, {
          indexingStatus: "indexing",
        });

        if (!indexing) {
          throw new Error("File not found during indexing transition.");
        }

        const indexed = await repositories.updateUploadedFile(user.userId, created.id, {
          indexingStatus: "indexed",
        });

        if (!indexed) {
          throw new Error("File not found during indexing completion.");
        }

        current = indexed;

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_indexing",
          title: "File indexing lifecycle",
          decision: "Indexing lifecycle completed: uploaded -> indexing -> indexed.",
          rationale: "Phase 8 metadata-first lifecycle executed without retrieval/chunk indexing.",
          workspaceId,
        });

        return current;
      } catch {
        const failed = await repositories.updateUploadedFile(user.userId, created.id, {
          indexingStatus: "failed",
        });

        current = failed ?? current;

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_indexing",
          title: "File indexing lifecycle",
          decision: "Indexing lifecycle failed and status was set to failed.",
          rationale: "Phase 8 fallback path preserves metadata and marks indexingStatus=failed.",
          workspaceId,
        });

        return current;
      }
    },

    async listFilesForWorkspace(user, workspaceId) {
      const workspace = await repositories.getWorkspace(user.userId, workspaceId);
      if (!workspace) {
        return null;
      }

      return repositories.listUploadedFiles(user.userId, workspaceId);
    },

    async runSummaryLifecycleForFile(user, workspaceId, fileId) {
      const workspace = await repositories.getWorkspace(user.userId, workspaceId);
      if (!workspace) {
        return { ok: false, code: "workspace_not_found" };
      }

      const current = await repositories.getUploadedFile(user.userId, fileId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, code: "file_not_found" };
      }

      if (current.summaryStatus === "ready" || current.summaryStatus === "pending") {
        return { ok: false, code: "invalid_transition" };
      }

      await repositories.writeDecisionLogEntry(user.userId, {
        decisionType: "file_summary",
        title: "Summary lifecycle",
        decision: "summary_requested",
        rationale: "Summary lifecycle trigger started in metadata-only mode.",
        workspaceId,
      });

      try {
        const pending = await repositories.updateUploadedFile(user.userId, fileId, {
          summaryStatus: "pending",
          summaryText: null,
          summarySource: "none",
          summaryErrorCode: null,
          summaryUpdatedAt: new Date(),
        });

        if (!pending) {
          return { ok: false, code: "file_not_found" };
        }

        const ready = await repositories.updateUploadedFile(user.userId, fileId, {
          summaryStatus: "ready",
          summaryText: SUMMARY_PLACEHOLDER_TEXT,
          summarySource: "placeholder",
          summaryErrorCode: null,
          summaryUpdatedAt: new Date(),
        });

        if (!ready) {
          return { ok: false, code: "file_not_found" };
        }

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_summary",
          title: "Summary lifecycle",
          decision: "summary_completed",
          rationale: "Summary status marked ready with deterministic placeholder text (metadata-only).",
          workspaceId,
        });

        return { ok: true, file: ready };
      } catch {
        const failed = await repositories.updateUploadedFile(user.userId, fileId, {
          summaryStatus: "failed",
          summarySource: "none",
          summaryErrorCode: SUMMARY_FAILURE_CODE,
          summaryUpdatedAt: new Date(),
        });

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_summary",
          title: "Summary lifecycle",
          decision: "summary_failed",
          rationale: "Summary lifecycle fell back to failed status in metadata-only mode.",
          workspaceId,
        });

        if (!failed) {
          return { ok: false, code: "file_not_found" };
        }

        return { ok: true, file: failed };
      }
    },

    async runExtractionLifecycleForFile(user, workspaceId, fileId, fileBuffer?: Buffer) {
      const workspace = await repositories.getWorkspace(user.userId, workspaceId);
      if (!workspace) {
        return { ok: false, code: "workspace_not_found" };
      }

      const current = await repositories.getUploadedFile(user.userId, fileId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, code: "file_not_found" };
      }

      if (!current.storagePath) {
        return { ok: false, code: "missing_storage_path" };
      }

      if (current.sourceType !== "pdf" && current.sourceType !== "docx") {
        return { ok: false, code: "unsupported_source_type" };
      }

      if (current.extractionStatus === "pending" || current.extractionStatus === "completed") {
        return { ok: false, code: "invalid_transition" };
      }

      await repositories.writeDecisionLogEntry(user.userId, {
        decisionType: "file_extraction",
        title: "Extraction lifecycle",
        decision: "extraction_requested",
        rationale: "Extraction lifecycle trigger started with deterministic provider boundary.",
        workspaceId,
      });

      try {
        const pending = await repositories.updateUploadedFile(user.userId, fileId, {
          extractionStatus: "pending",
          extractionErrorCode: null,
          extractionUpdatedAt: new Date(),
        });
        if (!pending) {
          return { ok: false, code: "file_not_found" };
        }

        const effectiveProvider = fileBuffer
          ? realDocumentExtractionProvider
          : repositories.fileExtractionProvider;

        const extraction = await effectiveProvider.extractText({
          userId: user.userId,
          workspaceId,
          fileId,
          fileName: current.name,
          sourceType: current.sourceType,
          storagePath: current.storagePath,
          fileBuffer: fileBuffer ?? null,
        });

        const text = extraction.text.trim();
        const completed = await repositories.updateUploadedFile(user.userId, fileId, {
          extractionStatus: "completed",
          extractedText: text,
          extractedTextPreview: text.slice(0, EXTRACTION_PREVIEW_MAX_CHARS),
          extractedTextCharCount: text.length,
          extractionSource: extraction.source,
          extractionErrorCode: null,
          extractionUpdatedAt: new Date(),
        });

        if (!completed) {
          return { ok: false, code: "file_not_found" };
        }

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_extraction",
          title: "Extraction lifecycle",
          decision: "extraction_completed",
          rationale: extraction.parserName
            ? `Extraction completed with real parser: ${extraction.parserName}.${extraction.warnings?.length ? ` Warnings: ${extraction.warnings.join(", ")}.` : ""}`
            : "Extraction completed with deterministic placeholder provider boundary.",
          workspaceId,
        });

        return { ok: true, file: completed };
      } catch {
        const failed = await repositories.updateUploadedFile(user.userId, fileId, {
          extractionStatus: "failed",
          extractionErrorCode: EXTRACTION_FAILURE_CODE,
          extractionUpdatedAt: new Date(),
        });

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_extraction",
          title: "Extraction lifecycle",
          decision: "extraction_failed",
          rationale: "Extraction lifecycle failed and status marked failed.",
          workspaceId,
        });

        if (!failed) {
          return { ok: false, code: "file_not_found" };
        }
        return { ok: true, file: failed };
      }
    },

    async runChunkingLifecycleForFile(user, workspaceId, fileId, options) {
      const workspace = await repositories.getWorkspace(user.userId, workspaceId);
      if (!workspace) {
        return { ok: false, code: "workspace_not_found" };
      }

      const current = await repositories.getUploadedFile(user.userId, fileId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, code: "file_not_found" };
      }

      if (current.extractionStatus !== "completed") {
        return { ok: false, code: "extraction_not_completed" };
      }

      if (!current.extractedText || current.extractedText.trim().length === 0) {
        return { ok: false, code: "missing_extracted_text" };
      }

      if (current.chunkingStatus === "pending") {
        return { ok: false, code: "invalid_transition" };
      }

      await repositories.writeDecisionLogEntry(user.userId, {
        decisionType: "file_chunking",
        title: "Chunking lifecycle",
        decision: "chunking_requested",
        rationale: "Chunking lifecycle started from extracted text boundary.",
        workspaceId,
      });

      try {
        const pending = await repositories.updateUploadedFile(user.userId, fileId, {
          chunkingStatus: "pending",
          chunkingErrorCode: null,
          chunkingUpdatedAt: new Date(),
        });
        if (!pending) {
          return { ok: false, code: "file_not_found" };
        }

        const chunks = chunkExtractedText({ text: current.extractedText });
        const chunkRecords = chunks.map((chunk) => ({
          chunkId: `chunk_${String(chunk.chunkIndex).padStart(4, "0")}`,
          userId: user.userId,
          workspaceId,
          fileId,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          tokenEstimate: chunk.tokenEstimate,
          source: "extracted_text" as const,
        }));

        await repositories.replaceFileChunks(user.userId, workspaceId, fileId, chunkRecords);

        const completed = await repositories.updateUploadedFile(user.userId, fileId, {
          chunkingStatus: "completed",
          chunkCount: chunkRecords.length,
          chunkingErrorCode: null,
          chunkingUpdatedAt: new Date(),
        });
        if (!completed) {
          return { ok: false, code: "file_not_found" };
        }

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_chunking",
          title: "Chunking lifecycle",
          decision: "chunking_completed",
          rationale: `Chunking completed with ${chunkRecords.length} deterministic chunks.`,
          workspaceId,
        });

        const fileAfterUnderstanding =
          (await maybeRunTextOnlyDocumentUnderstandingAfterChunking({
            repositories,
            userId: user.userId,
            workspaceId,
            fileId,
            file: {
              ...current,
              chunkingStatus: "completed",
              chunkCount: chunkRecords.length,
              chunkingErrorCode: null,
              chunkingUpdatedAt: completed.chunkingUpdatedAt,
            },
            costMode: options?.costMode,
          })) ?? completed;

        return { ok: true, file: fileAfterUnderstanding, chunkCount: chunkRecords.length };
      } catch {
        const failed = await repositories.updateUploadedFile(user.userId, fileId, {
          chunkingStatus: "failed",
          chunkingErrorCode: CHUNKING_FAILURE_CODE,
          chunkingUpdatedAt: new Date(),
        });

        await repositories.writeDecisionLogEntry(user.userId, {
          decisionType: "file_chunking",
          title: "Chunking lifecycle",
          decision: "chunking_failed",
          rationale: "Chunking lifecycle failed and status marked failed.",
          workspaceId,
        });

        if (!failed) {
          return { ok: false, code: "file_not_found" };
        }
        return { ok: true, file: failed, chunkCount: failed.chunkCount ?? 0 };
      }
    },
  };
}

export const uploadedFileApiService: UploadedFileApiService = createUploadedFileApiService();

async function maybeRunTextOnlyDocumentUnderstandingAfterChunking({
  repositories,
  userId,
  workspaceId,
  fileId,
  file,
  costMode,
}: {
  repositories: Repositories;
  userId: string;
  workspaceId: string;
  fileId: string;
  file: UploadedFileRecord;
  costMode?: CostMode;
}): Promise<UploadedFileRecord | null> {
  if (!shouldRunTextOnlyDocumentUnderstanding(file)) {
    return null;
  }

  const understandingResult =
    await repositories.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding(userId, fileId);

  if (!understandingResult.ok) {
    return repositories.getUploadedFile(userId, fileId);
  }

  const qualityGateResult = repositories.evaluateDocumentQualityGate({
    extractionQuality: understandingResult.file.extractionQuality,
    extractedTextCharCount: understandingResult.file.extractedTextCharCount,
    pageCount: understandingResult.file.pageCount,
    detectedQuestionCount: understandingResult.file.detectedQuestionCount,
    sourceType: understandingResult.file.sourceType,
    qualitySignals: understandingResult.output.qualitySignals,
  });

  if (!shouldRecommendDeepPdf(understandingResult.file.deepPdfStatus, qualityGateResult.decision)) {
    return understandingResult.file;
  }

  const recommendedFile =
    (await repositories.updateUploadedFile(userId, fileId, {
      deepPdfStatus: "recommended",
      deepPdfUpdatedAt: new Date(),
    })) ?? understandingResult.file;

  // Attempt controlled Deep PDF execution (best-effort, non-blocking).
  // costMode is threaded from runChunkingLifecycleForFile. When not provided by the caller
  // (e.g. the /chunks API route does not send a cost mode), it defaults to "Normal Learning",
  // which is the app-wide default (page.tsx). Cheap Practice is blocked by the cache policy.
  //
  // TODO (Batch 8D.1): propagate per-session cost mode from the client when the chunks API
  // route is extended to accept and forward it. Until then, callers that need strict cost mode
  // enforcement must pass it explicitly via runChunkingLifecycleForFile options.
  const effectiveCostMode: CostMode = costMode ?? "Normal Learning";

  if (repositories.deepPdfOrchestrationService) {
    try {
      const deepPdfResult = await repositories.deepPdfOrchestrationService.runDeepPdfUnderstanding(
        userId,
        fileId,
        { costMode: effectiveCostMode }
      );
      if (deepPdfResult.status === "completed" && deepPdfResult.file) {
        return deepPdfResult.file;
      }
    } catch {
      // Deep PDF failure must never fail the chunking lifecycle.
    }
  }

  return recommendedFile;
}

function shouldRunTextOnlyDocumentUnderstanding(file: UploadedFileRecord): boolean {
  if (file.sourceType !== "pdf" && file.sourceType !== "docx") {
    return false;
  }

  if (file.extractionStatus !== "completed") {
    return false;
  }

  if (file.chunkingStatus !== "completed") {
    return false;
  }

  if (!file.extractedText || file.extractedText.trim().length === 0) {
    return false;
  }

  if (file.understandingStatus === "pending" || file.understandingStatus === "completed") {
    return false;
  }

  return true;
}

function shouldRecommendDeepPdf(
  status: UploadedFileRecord["deepPdfStatus"],
  decision:
    | "use_text_only"
    | "recommend_advanced_understanding"
    | "requires_user_confirmation_or_higher_cost_mode"
    | "insufficient_input"
): boolean {
  if (
    decision !== "recommend_advanced_understanding" &&
    decision !== "requires_user_confirmation_or_higher_cost_mode"
  ) {
    return false;
  }

  if (status === "recommended" || status === "pending" || status === "completed") {
    return false;
  }

  return true;
}

function validateStoragePathOwnership(
  storagePath: string,
  userId: string,
  workspaceId: string,
  fileName: string
): void {
  if (storagePath.includes("..")) {
    throw new UploadedFileValidationError("storagePath must not contain traversal segments.");
  }

  const match = /^users\/([^/]+)\/workspaces\/([^/]+)\/files\/([^/]+)\/([^/]+)$/.exec(storagePath);
  if (!match) {
    throw new UploadedFileValidationError(
      "storagePath must match users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName}."
    );
  }

  const [, pathUserId, pathWorkspaceId, pathFileId, pathFileName] = match;
  if (!pathFileId || pathFileId.trim().length === 0) {
    throw new UploadedFileValidationError("storagePath fileId segment is required.");
  }
  if (pathUserId !== userId) {
    throw new UploadedFileValidationError("storagePath userId does not match authenticated user.");
  }
  if (pathWorkspaceId !== workspaceId) {
    throw new UploadedFileValidationError("storagePath workspaceId does not match route workspace.");
  }
  if (pathFileName !== fileName) {
    throw new UploadedFileValidationError("storagePath fileName must match fileName payload.");
  }
}

function inferTopic(fileName: string, topicHint?: string): string {
  if (topicHint && topicHint.trim().length > 0) {
    return topicHint.trim();
  }

  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  const normalized = withoutExtension
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : "General study material";
}

function inferConfidence(fileName: string, topicHint?: string): number {
  if (topicHint && topicHint.trim().length > 0) {
    return 0.92;
  }

  const tokenCount = fileName
    .replace(/\.[^./\\]+$/, "")
    .split(/[\s\-_]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;

  if (tokenCount >= 4) return 0.82;
  if (tokenCount >= 2) return 0.74;
  return 0.61;
}
