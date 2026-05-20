import type { DocumentOutline } from "../../types";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import { toDate } from "./workspaceTypes";

const OUTLINE_DOC_ID = "current";

export function resolveDocumentOutlineDocPath(
  userId: string,
  workspaceId: string,
  fileId: string
): string {
  return `users/${userId}/workspaces/${workspaceId}/files/${fileId}/documentOutline/${OUTLINE_DOC_ID}`;
}

export async function getDocumentOutline(
  userId: string,
  workspaceId: string,
  fileId: string
): Promise<DocumentOutline | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(resolveDocumentOutlineDocPath(userId, workspaceId, fileId)).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() as Record<string, unknown>;
    return {
      id: OUTLINE_DOC_ID,
      userId,
      workspaceId,
      fileId,
      title: typeof data.title === "string" ? data.title : undefined,
      sections: Array.isArray(data.sections)
        ? data.sections
            .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
            .map((item, index) => ({
              sectionId:
                typeof item.sectionId === "string" && item.sectionId.trim().length > 0
                  ? item.sectionId
                  : `section_${String(index + 1).padStart(4, "0")}`,
              label: typeof item.label === "string" ? item.label : undefined,
              title: typeof item.title === "string" ? item.title : undefined,
              sectionType: typeof item.sectionType === "string" ? item.sectionType : undefined,
              pageStart: typeof item.pageStart === "number" ? item.pageStart : undefined,
              pageEnd: typeof item.pageEnd === "number" ? item.pageEnd : undefined,
              blockIds: Array.isArray(item.blockIds)
                ? item.blockIds.filter((value): value is string => typeof value === "string")
                : undefined,
              sourceChunkIds: Array.isArray(item.sourceChunkIds)
                ? item.sourceChunkIds.filter((value): value is string => typeof value === "string")
                : undefined,
              confidence:
                item.confidence === "high" || item.confidence === "medium" || item.confidence === "low"
                  ? item.confidence
                  : undefined,
            }))
        : [],
      createdAt: data.createdAt ? toDate(data.createdAt) : new Date(0),
      updatedAt: data.updatedAt ? toDate(data.updatedAt) : new Date(0),
    };
  });
}

export async function replaceDocumentOutline(
  userId: string,
  workspaceId: string,
  fileId: string,
  outline: Omit<DocumentOutline, "createdAt" | "updatedAt">
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const now = new Date();
    await db.doc(resolveDocumentOutlineDocPath(userId, workspaceId, fileId)).set({
      title: outline.title ?? null,
      sections: outline.sections,
      createdAt: now,
      updatedAt: now,
    });
  });
}
