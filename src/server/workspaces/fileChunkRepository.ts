import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore/lite";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { FileChunkRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";
import { computeEmbeddingSourceTextHash } from "./fileChunkEmbeddingHash";

function resolveChunksPath(userId: string, workspaceId: string, fileId: string): [string, string, string, string, string, string, string] {
  return ["users", userId, "workspaces", workspaceId, "files", fileId, "chunks"];
}

function resolveChunkEmbeddingPath(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string
): [string, string, string, string, string, string, string, string, string, string] {
  return [...resolveChunksPath(userId, workspaceId, fileId), chunkId, "embedding", "current"];
}

export async function listFileChunks(
  userId: string,
  workspaceId: string,
  fileId: string
): Promise<FileChunkRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = collection(db, ...resolveChunksPath(userId, workspaceId, fileId));
    const snapshot = await getDocs(query(ref, orderBy("chunkIndex", "asc")));

    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        chunkId: item.id,
        userId,
        workspaceId,
        fileId,
        text: typeof data.text === "string" ? data.text : "",
        chunkIndex: typeof data.chunkIndex === "number" ? data.chunkIndex : 0,
        charStart: typeof data.charStart === "number" ? data.charStart : 0,
        charEnd: typeof data.charEnd === "number" ? data.charEnd : 0,
        tokenEstimate: typeof data.tokenEstimate === "number" ? data.tokenEstimate : 0,
        source: "extracted_text",
        embeddingStatus: mapEmbeddingStatus(data.embeddingStatus),
        embeddingProvider: typeof data.embeddingProvider === "string" ? data.embeddingProvider : undefined,
        embeddingModel: typeof data.embeddingModel === "string" ? data.embeddingModel : undefined,
        embeddingDimension: typeof data.embeddingDimension === "number" ? data.embeddingDimension : undefined,
        embeddingUpdatedAt: data.embeddingUpdatedAt ? toDate(data.embeddingUpdatedAt) : null,
        embeddingErrorCode: typeof data.embeddingErrorCode === "string" ? data.embeddingErrorCode : null,
        embeddingSourceTextHash:
          typeof data.embeddingSourceTextHash === "string" ? data.embeddingSourceTextHash : undefined,
        createdAt: data.createdAt ? toDate(data.createdAt) : new Date(0),
      };
    });
  });
}

export async function deleteFileChunks(userId: string, workspaceId: string, fileId: string): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = collection(db, ...resolveChunksPath(userId, workspaceId, fileId));
    const snapshot = await getDocs(ref);

    await Promise.all(
      snapshot.docs.map(async (item) => {
        await deleteDoc(doc(db, ...resolveChunkEmbeddingPath(userId, workspaceId, fileId, item.id)));
        await deleteDoc(doc(db, ...resolveChunksPath(userId, workspaceId, fileId), item.id));
      })
    );
  });
}

export async function replaceFileChunks(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunks: Omit<FileChunkRecord, "createdAt">[]
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    await deleteFileChunks(userId, workspaceId, fileId);

    const now = new Date();
    await Promise.all(
      chunks.map((chunk) =>
        setDoc(doc(db, ...resolveChunksPath(userId, workspaceId, fileId), chunk.chunkId), {
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          tokenEstimate: chunk.tokenEstimate,
          source: "extracted_text",
          embeddingStatus: "not_started",
          embeddingProvider: null,
          embeddingModel: null,
          embeddingDimension: null,
          embeddingUpdatedAt: null,
          embeddingErrorCode: null,
          embeddingSourceTextHash: computeEmbeddingSourceTextHash(chunk.text),
          createdAt: now,
        })
      )
    );
  });
}

export async function updateFileChunkEmbeddingLifecycle(
  userId: string,
  workspaceId: string,
  fileId: string,
  chunkId: string,
  updates: Partial<
    Pick<
      FileChunkRecord,
      | "embeddingStatus"
      | "embeddingProvider"
      | "embeddingModel"
      | "embeddingDimension"
      | "embeddingUpdatedAt"
      | "embeddingErrorCode"
      | "embeddingSourceTextHash"
    >
  >
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    await setDoc(doc(db, ...resolveChunksPath(userId, workspaceId, fileId), chunkId), compactRecord(updates), {
      merge: true,
    });
  });
}

function mapEmbeddingStatus(value: unknown): FileChunkRecord["embeddingStatus"] {
  if (
    value === "not_started" ||
    value === "pending" ||
    value === "completed" ||
    value === "failed" ||
    value === "stale"
  ) {
    return value;
  }
  return "not_started";
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}
