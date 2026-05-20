import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore/lite";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { FileChunkEmbeddingRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

function resolveChunkEmbeddingPath(
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

export async function setCurrentChunkEmbedding(record: FileChunkEmbeddingRecord): Promise<void> {
  return withFirestoreEmulatorClient(record.userId, async ({ db }) => {
    await setDoc(
      doc(db, ...resolveChunkEmbeddingPath(record.userId, record.workspaceId, record.fileId, record.chunkId)),
      {
        vector: record.vector,
        embeddingStatus: record.embeddingStatus,
        embeddingProvider: record.embeddingProvider,
        embeddingModel: record.embeddingModel,
        embeddingDimension: record.embeddingDimension,
        embeddingUpdatedAt: record.embeddingUpdatedAt,
        embeddingErrorCode: record.embeddingErrorCode,
        embeddingSourceTextHash: record.embeddingSourceTextHash,
      }
    );
  });
}

export async function getCurrentChunkEmbedding(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): Promise<FileChunkEmbeddingRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await getDoc(doc(db, ...resolveChunkEmbeddingPath(userId, workspaceId, fileId, chunkId)));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Record<string, unknown>;
    return {
      userId,
      workspaceId,
      fileId,
      chunkId,
      vector: Array.isArray(data.vector) ? data.vector.filter((v): v is number => typeof v === "number") : [],
      embeddingStatus: "completed",
      embeddingProvider: typeof data.embeddingProvider === "string" ? data.embeddingProvider : "",
      embeddingModel: typeof data.embeddingModel === "string" ? data.embeddingModel : "",
      embeddingDimension: typeof data.embeddingDimension === "number" ? data.embeddingDimension : 0,
      embeddingUpdatedAt: data.embeddingUpdatedAt ? toDate(data.embeddingUpdatedAt) : new Date(0),
      embeddingErrorCode: null,
      embeddingSourceTextHash:
        typeof data.embeddingSourceTextHash === "string" ? data.embeddingSourceTextHash : "",
    };
  });
}

export async function deleteCurrentChunkEmbedding(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    await deleteDoc(doc(db, ...resolveChunkEmbeddingPath(userId, workspaceId, fileId, chunkId)));
  });
}
