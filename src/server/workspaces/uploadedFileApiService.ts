import type { AuthenticatedUser } from "../auth/authTypes";
import { writeDecisionLogEntry } from "./decisionLogRepository";
import { getWorkspace } from "./workspaceRepository";
import {
  createUploadedFile,
  getUploadedFile,
  listUploadedFiles,
  updateUploadedFile,
} from "./uploadedFileRepository";
import type { CreateUploadedFileApiRequest } from "./uploadedFileApiSchemas";
import type { UploadedFileRecord } from "./workspaceTypes";

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const SUMMARY_PLACEHOLDER_TEXT = "Summary placeholder; content extraction not enabled yet.";
const SUMMARY_FAILURE_CODE = "summary_lifecycle_failed";

type SummaryRunFailureCode = "workspace_not_found" | "file_not_found" | "invalid_transition";

type SummaryRunResult =
  | { ok: true; file: UploadedFileRecord }
  | { ok: false; code: SummaryRunFailureCode };

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
}

interface Repositories {
  getWorkspace: typeof getWorkspace;
  createUploadedFile: typeof createUploadedFile;
  getUploadedFile: typeof getUploadedFile;
  updateUploadedFile: typeof updateUploadedFile;
  listUploadedFiles: typeof listUploadedFiles;
  writeDecisionLogEntry: typeof writeDecisionLogEntry;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace,
    createUploadedFile,
    getUploadedFile,
    updateUploadedFile,
    listUploadedFiles,
    writeDecisionLogEntry,
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

      const topic = inferTopic(input.fileName, input.topicHint);
      const confidence = inferConfidence(input.fileName, input.topicHint);
      const assignmentStatus: UploadedFileRecord["assignmentStatus"] =
        confidence < LOW_CONFIDENCE_THRESHOLD ? "needs-review" : "assigned";

      const created = await repositories.createUploadedFile(user.userId, {
        workspaceId,
        name: input.fileName,
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
  };
}

export const uploadedFileApiService: UploadedFileApiService = createUploadedFileApiService();

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
