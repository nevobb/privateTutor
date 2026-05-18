import type { AuthenticatedUser } from "../auth/authTypes";
import { writeDecisionLogEntry } from "./decisionLogRepository";
import { getWorkspace } from "./workspaceRepository";
import {
  createUploadedFile,
  listUploadedFiles,
  updateUploadedFile,
} from "./uploadedFileRepository";
import type { CreateUploadedFileApiRequest } from "./uploadedFileApiSchemas";
import type { UploadedFileRecord } from "./workspaceTypes";

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export interface UploadedFileApiService {
  createFileForWorkspace(
    user: AuthenticatedUser,
    workspaceId: string,
    input: CreateUploadedFileApiRequest
  ): Promise<UploadedFileRecord | null>;
  listFilesForWorkspace(user: AuthenticatedUser, workspaceId: string): Promise<UploadedFileRecord[] | null>;
}

interface Repositories {
  getWorkspace: typeof getWorkspace;
  createUploadedFile: typeof createUploadedFile;
  updateUploadedFile: typeof updateUploadedFile;
  listUploadedFiles: typeof listUploadedFiles;
  writeDecisionLogEntry: typeof writeDecisionLogEntry;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace,
    createUploadedFile,
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
