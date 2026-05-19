import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore/lite";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { FileChunkRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

function resolveChunksPath(userId: string, workspaceId: string, fileId: string): [string, string, string, string, string, string, string] {
  return ["users", userId, "workspaces", workspaceId, "files", fileId, "chunks"];
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
        createdAt: data.createdAt ? toDate(data.createdAt) : new Date(0),
      };
    });
  });
}

export async function deleteFileChunks(userId: string, workspaceId: string, fileId: string): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = collection(db, ...resolveChunksPath(userId, workspaceId, fileId));
    const snapshot = await getDocs(ref);

    await Promise.all(snapshot.docs.map((item) => deleteDoc(doc(db, ...resolveChunksPath(userId, workspaceId, fileId), item.id))));
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
          createdAt: now,
        })
      )
    );
  });
}
