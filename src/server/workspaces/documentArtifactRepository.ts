import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import {
  parseDetectedQuestionArtifactRecord,
  parseDocumentOutlineArtifactRecord,
  parseDocumentPageArtifactRecord,
  serializeDetectedQuestionArtifactRecord,
  serializeDocumentOutlineArtifactRecord,
  serializeDocumentPageArtifactRecord,
} from "./documentArtifactSchemas";
import type {
  DetectedQuestionArtifactRecord,
  DocumentOutlineArtifactRecord,
  DocumentPageArtifactRecord,
} from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

export function documentPagesPath(
  userId: string,
  fileId: string
): [string, string, string, string, string] {
  return ["users", userId, "uploadedFiles", fileId, "pages"];
}

export function documentPagePath(
  userId: string,
  fileId: string,
  pageId: string
): [string, string, string, string, string, string] {
  return [...documentPagesPath(userId, fileId), pageId];
}

export function documentOutlineCollectionPath(
  userId: string,
  fileId: string
): [string, string, string, string, string] {
  return ["users", userId, "uploadedFiles", fileId, "documentOutline"];
}

export function documentOutlinePath(
  userId: string,
  fileId: string,
  outlineId = "v1"
): [string, string, string, string, string, string] {
  return [...documentOutlineCollectionPath(userId, fileId), outlineId];
}

export function detectedQuestionsPath(
  userId: string,
  fileId: string
): [string, string, string, string, string] {
  return ["users", userId, "uploadedFiles", fileId, "detectedQuestions"];
}

export function detectedQuestionPath(
  userId: string,
  fileId: string,
  questionId: string
): [string, string, string, string, string, string] {
  return [...detectedQuestionsPath(userId, fileId), questionId];
}

export async function replaceDocumentPages(
  userId: string,
  fileId: string,
  pages: Omit<DocumentPageArtifactRecord, "userId" | "createdAt" | "updatedAt">[]
): Promise<DocumentPageArtifactRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.collection(documentPagesPath(userId, fileId).join("/")).get();
    await Promise.all(snapshot.docs.map((item) => item.ref.delete()));

    const now = new Date();
    const records = pages.map((page) => ({
      ...page,
      userId,
      fileId,
      createdAt: now,
      updatedAt: now,
    }));

    await Promise.all(
      records.map((record) =>
        db.doc(documentPagePath(userId, fileId, record.pageId).join("/")).set(serializeDocumentPageArtifactRecord(record))
      )
    );

    return records;
  });
}

export async function listDocumentPages(
  userId: string,
  fileId: string
): Promise<DocumentPageArtifactRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.collection(documentPagesPath(userId, fileId).join("/")).orderBy("pageNumber", "asc").get();
    const records: DocumentPageArtifactRecord[] = [];

    for (const item of snapshot.docs) {
      const parsed = parseDocumentPageArtifactRecord(item.data(), { userId, fileId });
      if (parsed.ok) {
        records.push(parsed.value);
      }
    }

    return records;
  });
}

export async function saveDocumentOutline(
  userId: string,
  fileId: string,
  outline: Omit<DocumentOutlineArtifactRecord, "userId" | "createdAt" | "updatedAt">
): Promise<DocumentOutlineArtifactRecord> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const existing = await db.doc(documentOutlinePath(userId, fileId, outline.outlineId).join("/")).get();
    const now = new Date();
    const currentCreatedAt = existing.exists ? toDate(existing.data()?.createdAt) : undefined;
    const record: DocumentOutlineArtifactRecord = {
      ...outline,
      userId,
      fileId,
      createdAt: currentCreatedAt ?? now,
      updatedAt: now,
    };

    await db
      .doc(documentOutlinePath(userId, fileId, outline.outlineId).join("/"))
      .set(serializeDocumentOutlineArtifactRecord(record));

    return record;
  });
}

export async function getDocumentOutline(
  userId: string,
  fileId: string,
  outlineId = "v1"
): Promise<DocumentOutlineArtifactRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(documentOutlinePath(userId, fileId, outlineId).join("/")).get();
    if (!snapshot.exists) {
      return null;
    }

    const parsed = parseDocumentOutlineArtifactRecord(snapshot.data(), { userId, fileId });
    return parsed.ok ? parsed.value : null;
  });
}

export async function replaceDetectedQuestions(
  userId: string,
  fileId: string,
  questions: Omit<DetectedQuestionArtifactRecord, "userId" | "createdAt" | "updatedAt">[]
): Promise<DetectedQuestionArtifactRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.collection(detectedQuestionsPath(userId, fileId).join("/")).get();
    await Promise.all(snapshot.docs.map((item) => item.ref.delete()));

    const now = new Date();
    const records = questions.map((question) => ({
      ...question,
      userId,
      fileId,
      createdAt: now,
      updatedAt: now,
    }));

    await Promise.all(
      records.map((record) =>
        db
          .doc(detectedQuestionPath(userId, fileId, record.questionId).join("/"))
          .set(serializeDetectedQuestionArtifactRecord(record))
      )
    );

    return records;
  });
}

export async function listDetectedQuestions(
  userId: string,
  fileId: string
): Promise<DetectedQuestionArtifactRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db
      .collection(detectedQuestionsPath(userId, fileId).join("/"))
      .orderBy("charStart", "asc")
      .get();
    const records: DetectedQuestionArtifactRecord[] = [];

    for (const item of snapshot.docs) {
      const parsed = parseDetectedQuestionArtifactRecord(item.data(), { userId, fileId });
      if (parsed.ok) {
        records.push(parsed.value);
      }
    }

    return records;
  });
}
