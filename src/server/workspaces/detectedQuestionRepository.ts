import type { DetectedQuestion } from "../../types";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import { toDate } from "./workspaceTypes";

export function resolveDetectedQuestionsCollectionPath(
  userId: string,
  workspaceId: string,
  fileId: string
): string {
  return `users/${userId}/workspaces/${workspaceId}/files/${fileId}/detectedQuestions`;
}

export async function listDetectedQuestions(
  userId: string,
  workspaceId: string,
  fileId: string
): Promise<DetectedQuestion[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db
      .collection(resolveDetectedQuestionsCollectionPath(userId, workspaceId, fileId))
      .orderBy("questionNumber", "asc")
      .orderBy("pageStart", "asc")
      .get();

    return snapshot.docs.map((doc) => mapDetectedQuestion(doc.id, doc.data() as Record<string, unknown>, userId, workspaceId, fileId));
  });
}

export async function replaceDetectedQuestions(
  userId: string,
  workspaceId: string,
  fileId: string,
  questions: Array<Omit<DetectedQuestion, "createdAt" | "updatedAt">>
): Promise<void> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const collectionPath = resolveDetectedQuestionsCollectionPath(userId, workspaceId, fileId);
    const existing = await db.collection(collectionPath).get();
    await Promise.all(existing.docs.map((doc) => doc.ref.delete()));

    const now = new Date();
    await Promise.all(
      questions.map((question, index) => {
        const questionId = question.id || `question_${String(index + 1).padStart(4, "0")}`;
        return db.doc(`${collectionPath}/${questionId}`).set({
          labelRaw: question.labelRaw,
          normalizedLabel: question.normalizedLabel ?? null,
          questionNumber: question.questionNumber ?? null,
          topic: question.topic ?? null,
          summary: question.summary ?? null,
          pageStart: question.pageStart ?? null,
          pageEnd: question.pageEnd ?? null,
          blockIds: question.blockIds ?? null,
          sourceChunkIds: question.sourceChunkIds ?? null,
          subsections: question.subsections ?? null,
          confidence: question.confidence,
          extractionNotes: question.extractionNotes ?? null,
          createdAt: now,
          updatedAt: now,
        });
      })
    );
  });
}

function mapDetectedQuestion(
  id: string,
  data: Record<string, unknown>,
  userId: string,
  workspaceId: string,
  fileId: string
): DetectedQuestion {
  return {
    id,
    userId,
    workspaceId,
    fileId,
    labelRaw: typeof data.labelRaw === "string" ? data.labelRaw : "",
    normalizedLabel: typeof data.normalizedLabel === "string" ? data.normalizedLabel : undefined,
    questionNumber: typeof data.questionNumber === "number" ? data.questionNumber : undefined,
    topic: typeof data.topic === "string" ? data.topic : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
    pageStart: typeof data.pageStart === "number" ? data.pageStart : undefined,
    pageEnd: typeof data.pageEnd === "number" ? data.pageEnd : undefined,
    blockIds: Array.isArray(data.blockIds) ? data.blockIds.filter((v): v is string => typeof v === "string") : undefined,
    sourceChunkIds: Array.isArray(data.sourceChunkIds)
      ? data.sourceChunkIds.filter((v): v is string => typeof v === "string")
      : undefined,
    subsections: Array.isArray(data.subsections)
      ? data.subsections.filter((v): v is string => typeof v === "string")
      : undefined,
    confidence: data.confidence === "high" || data.confidence === "medium" ? data.confidence : "low",
    extractionNotes: typeof data.extractionNotes === "string" ? data.extractionNotes : undefined,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(0),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : new Date(0),
  };
}
