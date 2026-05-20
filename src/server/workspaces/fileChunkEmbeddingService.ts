import type { AuthenticatedUser } from "../auth/authTypes";
import { getWorkspace as defaultGetWorkspace } from "./workspaceRepository";
import { getUploadedFile as defaultGetUploadedFile } from "./uploadedFileRepository";
import {
  listFileChunks as defaultListFileChunks,
  updateFileChunkEmbeddingLifecycle as defaultUpdateChunkEmbeddingLifecycle,
} from "./fileChunkRepository";
import { setCurrentChunkEmbedding as defaultSetCurrentChunkEmbedding } from "./fileChunkEmbeddingRepository";
import { fileChunkEmbeddingProvider as defaultEmbeddingProvider } from "./fileChunkEmbeddingProvider";
import type { FileChunkRecord, FileChunkEmbeddingRecord } from "./workspaceTypes";
import { computeEmbeddingSourceTextHash } from "./fileChunkEmbeddingHash";

export type EmbeddingRunFailureCode =
  | "workspace_not_found"
  | "file_not_found"
  | "chunking_not_completed"
  | "no_chunks";

export type EmbeddingRunResult =
  | { ok: true; embeddedChunkCount: number; failedChunkCount: number }
  | { ok: false; code: EmbeddingRunFailureCode };

interface Deps {
  getWorkspace: typeof defaultGetWorkspace;
  getUploadedFile: typeof defaultGetUploadedFile;
  listFileChunks: typeof defaultListFileChunks;
  updateChunkEmbeddingLifecycle: typeof defaultUpdateChunkEmbeddingLifecycle;
  setCurrentChunkEmbedding: typeof defaultSetCurrentChunkEmbedding;
  embeddingProvider: typeof defaultEmbeddingProvider;
}

function defaultDeps(): Deps {
  return {
    getWorkspace: defaultGetWorkspace,
    getUploadedFile: defaultGetUploadedFile,
    listFileChunks: defaultListFileChunks,
    updateChunkEmbeddingLifecycle: defaultUpdateChunkEmbeddingLifecycle,
    setCurrentChunkEmbedding: defaultSetCurrentChunkEmbedding,
    embeddingProvider: defaultEmbeddingProvider,
  };
}

const EMBEDDING_FAILURE_CODE = "embedding_generation_failed";

export interface FileChunkEmbeddingService {
  runEmbeddingLifecycleForFile(
    user: AuthenticatedUser,
    workspaceId: string,
    fileId: string
  ): Promise<EmbeddingRunResult>;
}

export function createFileChunkEmbeddingService(deps: Deps = defaultDeps()): FileChunkEmbeddingService {
  return {
    async runEmbeddingLifecycleForFile(user, workspaceId, fileId) {
      const workspace = await deps.getWorkspace(user.userId, workspaceId);
      if (!workspace) {
        return { ok: false, code: "workspace_not_found" };
      }

      const file = await deps.getUploadedFile(user.userId, fileId);
      if (!file || file.workspaceId !== workspaceId) {
        return { ok: false, code: "file_not_found" };
      }

      if (file.chunkingStatus !== "completed") {
        return { ok: false, code: "chunking_not_completed" };
      }

      const chunks = await deps.listFileChunks(user.userId, workspaceId, fileId);
      const nonEmptyChunks = chunks.filter((chunk) => chunk.text.trim().length > 0);

      if (nonEmptyChunks.length === 0) {
        return { ok: false, code: "no_chunks" };
      }

      let embeddedChunkCount = 0;
      let failedChunkCount = 0;

      for (const chunk of nonEmptyChunks) {
        const ok = await embedSingleChunk(user, workspaceId, fileId, chunk, deps);
        if (ok) {
          embeddedChunkCount += 1;
        } else {
          failedChunkCount += 1;
        }
      }

      return { ok: true, embeddedChunkCount, failedChunkCount };
    },
  };
}

export const fileChunkEmbeddingService: FileChunkEmbeddingService = createFileChunkEmbeddingService();

async function embedSingleChunk(
  user: AuthenticatedUser,
  workspaceId: string,
  fileId: string,
  chunk: FileChunkRecord,
  deps: Deps
): Promise<boolean> {
  const currentHash = computeEmbeddingSourceTextHash(chunk.text);
  if (chunk.embeddingStatus === "completed" && chunk.embeddingSourceTextHash === currentHash) {
    return true;
  }

  await deps.updateChunkEmbeddingLifecycle(user.userId, workspaceId, fileId, chunk.chunkId, {
    embeddingStatus: "pending",
    embeddingErrorCode: null,
    embeddingUpdatedAt: new Date(),
  });

  try {
    const embedded = await deps.embeddingProvider.embedText({
      userId: user.userId,
      workspaceId,
      fileId,
      chunkId: chunk.chunkId,
      text: chunk.text,
      embeddingPurpose: "document",
    });

    const now = new Date();
    const record: FileChunkEmbeddingRecord = {
      userId: user.userId,
      workspaceId,
      fileId,
      chunkId: chunk.chunkId,
      vector: embedded.vector,
      embeddingStatus: "completed",
      embeddingProvider: embedded.provider,
      embeddingModel: embedded.model,
      embeddingDimension: embedded.dimension,
      embeddingUpdatedAt: now,
      embeddingErrorCode: null,
      embeddingSourceTextHash: embedded.sourceTextHash,
    };

    await deps.setCurrentChunkEmbedding(record);
    await deps.updateChunkEmbeddingLifecycle(user.userId, workspaceId, fileId, chunk.chunkId, {
      embeddingStatus: "completed",
      embeddingProvider: embedded.provider,
      embeddingModel: embedded.model,
      embeddingDimension: embedded.dimension,
      embeddingUpdatedAt: now,
      embeddingErrorCode: null,
      embeddingSourceTextHash: embedded.sourceTextHash,
    });

    return true;
  } catch {
    await deps.updateChunkEmbeddingLifecycle(user.userId, workspaceId, fileId, chunk.chunkId, {
      embeddingStatus: "failed",
      embeddingErrorCode: EMBEDDING_FAILURE_CODE,
      embeddingUpdatedAt: new Date(),
    });
    return false;
  }
}
