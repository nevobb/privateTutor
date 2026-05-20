import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { DocumentPage } from "../../types";
import { toDate } from "./workspaceTypes";

type DocumentPageRecord = DocumentPage;

function resolveDocumentPagesPath(
  userId: string,
  workspaceId: string,
  fileId: string
): [string, string, string, string, string, string, string] {
  return ["users", userId, "workspaces", workspaceId, "files", fileId, "pages"];
}

export async function listDocumentPages(
  userId: string,
  workspaceId: string,
  fileId: string
): Promise<DocumentPageRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db
      .collection(resolveDocumentPagesPath(userId, workspaceId, fileId).join("/"))
      .orderBy("pageNumber", "asc")
      .get();

    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        id: item.id,
        userId,
        workspaceId,
        fileId,
        pageNumber: typeof data.pageNumber === "number" ? data.pageNumber : 1,
        extractedText: typeof data.extractedText === "string" ? data.extractedText : "",
        cleanedText: typeof data.cleanedText === "string" ? data.cleanedText : undefined,
        charStart: typeof data.charStart === "number" ? data.charStart : undefined,
        charEnd: typeof data.charEnd === "number" ? data.charEnd : undefined,
        textQuality:
          data.textQuality === "good" ||
          data.textQuality === "partial" ||
          data.textQuality === "poor" ||
          data.textQuality === "unknown"
            ? data.textQuality
            : undefined,
        sourceChunkIds: Array.isArray(data.sourceChunkIds)
          ? data.sourceChunkIds.filter((value): value is string => typeof value === "string")
          : undefined,
        createdAt: data.createdAt ? toDate(data.createdAt) : new Date(0),
        updatedAt: data.updatedAt ? toDate(data.updatedAt) : new Date(0),
      };
    });
  });
}

export async function deleteDocumentPages(
  userId: string,
  workspaceId: string,
  fileId: string
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.collection(resolveDocumentPagesPath(userId, workspaceId, fileId).join("/")).get();
    await Promise.all(snapshot.docs.map((item) => item.ref.delete()));
  });
}

export async function replaceDocumentPages(
  userId: string,
  workspaceId: string,
  fileId: string,
  pages: Array<Omit<DocumentPageRecord, "createdAt" | "updatedAt">>
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    await deleteDocumentPages(userId, workspaceId, fileId);
    const now = new Date();

    await Promise.all(
      pages.map((page, index) => {
        const pageId = page.id || `page_${String(index + 1).padStart(4, "0")}`;
        return db.doc(`${resolveDocumentPagesPath(userId, workspaceId, fileId).join("/")}/${pageId}`).set({
          pageNumber: page.pageNumber,
          extractedText: page.extractedText,
          cleanedText: page.cleanedText ?? null,
          charStart: page.charStart ?? null,
          charEnd: page.charEnd ?? null,
          textQuality: page.textQuality ?? "unknown",
          sourceChunkIds: page.sourceChunkIds ?? null,
          createdAt: now,
          updatedAt: now,
        });
      })
    );
  });
}

