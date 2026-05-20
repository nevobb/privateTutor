import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { FileChunkEmbeddingRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

export function resolveChunkEmbeddingPath(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): [string, string, string, string, string, string, string, string, string, string] {
  return [
    "users",
    userId,
    "workspaces",
    workspaceId,
    "files",
    fileId,
    "chunks",
    chunkId,
    "embedding",
    "current",
  ];
}

export async function setFileChunkEmbedding(record: FileChunkEmbeddingRecord): Promise<void> {
  return withFirestoreEmulatorClient(record.userId, async ({ db }) => {
    await db.doc(resolveChunkEmbeddingPath(record.userId, record.workspaceId, record.fileId, record.chunkId).join("/")).set(
      compactRecord({
        userId: record.userId,
        workspaceId: record.workspaceId,
        fileId: record.fileId,
        chunkId: record.chunkId,
        vector: record.vector,
        embeddingStatus: record.embeddingStatus,
        embeddingProvider: record.embeddingProvider,
        embeddingModel: record.embeddingModel,
        embeddingDimension: record.embeddingDimension,
        embeddingUpdatedAt: record.embeddingUpdatedAt,
        embeddingErrorCode: record.embeddingErrorCode,
        embeddingSourceTextHash: record.embeddingSourceTextHash,
      })
    );
  });
}

export async function setCurrentChunkEmbedding(record: FileChunkEmbeddingRecord): Promise<void> {
  return setFileChunkEmbedding(record);
}

export async function getFileChunkEmbedding(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): Promise<FileChunkEmbeddingRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(resolveChunkEmbeddingPath(userId, workspaceId, fileId, chunkId).join("/")).get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as Record<string, unknown>;
    if (typeof data.userId !== "string" || data.userId !== userId) {
      return null;
    }

    return {
      userId,
      workspaceId,
      fileId,
      chunkId,
      vector: Array.isArray(data.vector)
        ? data.vector
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
        : [],
      embeddingStatus: data.embeddingStatus === "completed" ? "completed" : "completed",
      embeddingProvider: typeof data.embeddingProvider === "string" ? data.embeddingProvider : "deterministic",
      embeddingModel: typeof data.embeddingModel === "string" ? data.embeddingModel : "deterministic-v1",
      embeddingDimension: typeof data.embeddingDimension === "number" ? data.embeddingDimension : 0,
      embeddingUpdatedAt: toDate(data.embeddingUpdatedAt),
      embeddingErrorCode: null,
      embeddingSourceTextHash:
        typeof data.embeddingSourceTextHash === "string" ? data.embeddingSourceTextHash : "",
    };
  });
}

export async function getCurrentChunkEmbedding(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): Promise<FileChunkEmbeddingRecord | null> {
  return getFileChunkEmbedding(userId, workspaceId, fileId, chunkId);
}

export async function deleteFileChunkEmbedding(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    await db.doc(resolveChunkEmbeddingPath(userId, workspaceId, fileId, chunkId).join("/")).delete();
  });
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}
