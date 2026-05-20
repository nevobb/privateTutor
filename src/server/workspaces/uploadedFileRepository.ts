import { randomUUID } from "node:crypto";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { CreateUploadedFileInput, UploadedFileRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

export function uploadedFilePath(userId: string, fileId: string): [string, string, string, string] {
  return ["users", userId, "uploadedFiles", fileId];
}

export async function createUploadedFile(
  userId: string,
  input: CreateUploadedFileInput
): Promise<UploadedFileRecord> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const fileId = randomUUID();
    const now = new Date();
    const ref = db.doc(uploadedFilePath(userId, fileId).join("/"));

    const record: UploadedFileRecord = {
      id: fileId,
      userId,
      name: input.name,
      originalFileName: input.originalFileName,
      url: "",
      embeddingStatus: input.embeddingStatus ?? "not_started",
      embeddingUpdatedAt: input.embeddingUpdatedAt ?? null,
      uploadedAt: now,
      workspaceId: input.workspaceId,
      assignmentStatus: input.assignmentStatus,
      indexingStatus: input.indexingStatus,
      sourceType: input.sourceType,
      topic: input.topic,
      confidence: input.confidence,
      storagePath: input.storagePath,
      summaryStatus: input.summaryStatus,
      summaryText: input.summaryText,
      summarySource: input.summarySource,
      summaryErrorCode: input.summaryErrorCode,
      summaryUpdatedAt: input.summaryUpdatedAt,
      extractionStatus: input.extractionStatus,
      extractedText: input.extractedText,
      extractedTextPreview: input.extractedTextPreview,
      extractedTextCharCount: input.extractedTextCharCount,
      extractionSource: input.extractionSource,
      extractionErrorCode: input.extractionErrorCode,
      extractionUpdatedAt: input.extractionUpdatedAt,
      chunkingStatus: input.chunkingStatus,
      chunkCount: input.chunkCount,
      chunkingErrorCode: input.chunkingErrorCode,
      chunkingUpdatedAt: input.chunkingUpdatedAt,
      understandingStatus: input.understandingStatus ?? "not_started",
      understandingUpdatedAt: input.understandingUpdatedAt ?? null,
      understandingErrorCode: input.understandingErrorCode ?? null,
      visualStatus: input.visualStatus ?? "not_started",
      visualUpdatedAt: input.visualUpdatedAt ?? null,
      visualErrorCode: input.visualErrorCode ?? null,
      materialType: input.materialType ?? "unknown",
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(compactRecord(record));
    return record;
  });
}

export async function getUploadedFile(userId: string, fileId: string): Promise<UploadedFileRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(uploadedFilePath(userId, fileId).join("/")).get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as Record<string, unknown>;
    if (getOwnerUserId(data) !== userId) {
      return null;
    }

    return mapUploadedFileRecord(snapshot.id, data);
  });
}

export async function listUploadedFiles(userId: string, workspaceId: string): Promise<UploadedFileRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.collection(`users/${userId}/uploadedFiles`).orderBy("updatedAt", "desc").get();

    return snapshot.docs
      .filter((item) => {
        const data = item.data() as Record<string, unknown>;
        return getOwnerUserId(data) === userId && data.workspaceId === workspaceId;
      })
      .map((item) => mapUploadedFileRecord(item.id, item.data() as Record<string, unknown>));
  });
}

export async function updateUploadedFile(
  userId: string,
  fileId: string,
  updates: Partial<
    Pick<
      UploadedFileRecord,
      | "assignmentStatus"
      | "indexingStatus"
      | "topic"
      | "confidence"
      | "summaryStatus"
      | "summaryText"
      | "summarySource"
      | "summaryErrorCode"
      | "summaryUpdatedAt"
      | "extractionStatus"
      | "extractedText"
      | "extractedTextPreview"
      | "extractedTextCharCount"
      | "extractionSource"
      | "extractionErrorCode"
      | "extractionUpdatedAt"
      | "chunkingStatus"
      | "chunkCount"
      | "chunkingErrorCode"
      | "chunkingUpdatedAt"
      | "embeddingStatus"
      | "embeddingUpdatedAt"
      | "understandingStatus"
      | "understandingUpdatedAt"
      | "understandingErrorCode"
      | "visualStatus"
      | "visualUpdatedAt"
      | "visualErrorCode"
      | "materialType"
    >
  >
): Promise<UploadedFileRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = db.doc(uploadedFilePath(userId, fileId).join("/"));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as Record<string, unknown>;
    if (getOwnerUserId(data) !== userId) {
      return null;
    }

    const current = mapUploadedFileRecord(snapshot.id, data);
    const hasOwn = <K extends keyof typeof updates>(key: K): boolean =>
      Object.prototype.hasOwnProperty.call(updates, key);

    const next: UploadedFileRecord = {
      ...current,
      assignmentStatus: updates.assignmentStatus ?? current.assignmentStatus,
      indexingStatus: updates.indexingStatus ?? current.indexingStatus,
      topic: updates.topic ?? current.topic,
      confidence: updates.confidence ?? current.confidence,
      summaryStatus: updates.summaryStatus ?? current.summaryStatus,
      summaryText: updates.summaryText ?? current.summaryText,
      summarySource: updates.summarySource ?? current.summarySource,
      summaryErrorCode: updates.summaryErrorCode ?? current.summaryErrorCode,
      summaryUpdatedAt: updates.summaryUpdatedAt ?? current.summaryUpdatedAt,
      extractionStatus: updates.extractionStatus ?? current.extractionStatus,
      extractedText: updates.extractedText ?? current.extractedText,
      extractedTextPreview: updates.extractedTextPreview ?? current.extractedTextPreview,
      extractedTextCharCount: updates.extractedTextCharCount ?? current.extractedTextCharCount,
      extractionSource: updates.extractionSource ?? current.extractionSource,
      extractionErrorCode: updates.extractionErrorCode ?? current.extractionErrorCode,
      extractionUpdatedAt: updates.extractionUpdatedAt ?? current.extractionUpdatedAt,
      chunkingStatus: updates.chunkingStatus ?? current.chunkingStatus,
      chunkCount: updates.chunkCount ?? current.chunkCount,
      chunkingErrorCode: updates.chunkingErrorCode ?? current.chunkingErrorCode,
      chunkingUpdatedAt: updates.chunkingUpdatedAt ?? current.chunkingUpdatedAt,
      embeddingStatus: updates.embeddingStatus ?? current.embeddingStatus,
      embeddingUpdatedAt: updates.embeddingUpdatedAt ?? current.embeddingUpdatedAt,
      understandingStatus: updates.understandingStatus ?? current.understandingStatus,
      understandingUpdatedAt: hasOwn("understandingUpdatedAt")
        ? updates.understandingUpdatedAt
        : current.understandingUpdatedAt,
      understandingErrorCode: hasOwn("understandingErrorCode")
        ? updates.understandingErrorCode
        : current.understandingErrorCode,
      visualStatus: updates.visualStatus ?? current.visualStatus,
      visualUpdatedAt: hasOwn("visualUpdatedAt") ? updates.visualUpdatedAt : current.visualUpdatedAt,
      visualErrorCode: hasOwn("visualErrorCode") ? updates.visualErrorCode : current.visualErrorCode,
      materialType: hasOwn("materialType") ? updates.materialType : current.materialType,
      updatedAt: new Date(),
    };

    await ref.set(compactRecord(next));
    return next;
  });
}

function mapUploadedFileRecord(id: string, data: Record<string, unknown>): UploadedFileRecord {
  return {
    id,
    userId: getOwnerUserId(data),
    name: String(data.name ?? ""),
    originalFileName: typeof data.originalFileName === "string" ? data.originalFileName : undefined,
    url: typeof data.url === "string" ? data.url : "",
    uploadedAt: toDate(data.uploadedAt),
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : undefined,
    assignedTopicId: typeof data.assignedTopicId === "string" ? data.assignedTopicId : undefined,
    assignmentStatus: mapAssignmentStatus(data.assignmentStatus),
    indexingStatus: mapIndexingStatus(data.indexingStatus),
    sourceType: mapSourceType(data.sourceType),
    filePolicy: mapFilePolicy(data.filePolicy),
    topic: typeof data.topic === "string" ? data.topic : undefined,
    subtopic: typeof data.subtopic === "string" ? data.subtopic : undefined,
    summaryId: typeof data.summaryId === "string" ? data.summaryId : undefined,
    indexProvider: typeof data.indexProvider === "string" ? data.indexProvider : undefined,
    indexId: typeof data.indexId === "string" ? data.indexId : undefined,
    confidence: typeof data.confidence === "number" ? data.confidence : undefined,
    storagePath: typeof data.storagePath === "string" ? data.storagePath : undefined,
    summaryStatus: mapSummaryStatus(data.summaryStatus),
    summaryText: typeof data.summaryText === "string" ? data.summaryText : null,
    summarySource: mapSummarySource(data.summarySource),
    summaryErrorCode: typeof data.summaryErrorCode === "string" ? data.summaryErrorCode : null,
    summaryUpdatedAt: data.summaryUpdatedAt ? toDate(data.summaryUpdatedAt) : null,
    extractionStatus: mapExtractionStatus(data.extractionStatus),
    extractedText: typeof data.extractedText === "string" ? data.extractedText : undefined,
    extractedTextPreview: typeof data.extractedTextPreview === "string" ? data.extractedTextPreview : undefined,
    extractedTextCharCount:
      typeof data.extractedTextCharCount === "number" ? data.extractedTextCharCount : undefined,
    extractionSource: mapExtractionSource(data.extractionSource),
    extractionErrorCode: typeof data.extractionErrorCode === "string" ? data.extractionErrorCode : null,
    extractionUpdatedAt: data.extractionUpdatedAt ? toDate(data.extractionUpdatedAt) : null,
    chunkingStatus: mapChunkingStatus(data.chunkingStatus),
    chunkCount: typeof data.chunkCount === "number" ? data.chunkCount : undefined,
    chunkingErrorCode: typeof data.chunkingErrorCode === "string" ? data.chunkingErrorCode : null,
    chunkingUpdatedAt: data.chunkingUpdatedAt ? toDate(data.chunkingUpdatedAt) : null,
    embeddingStatus: mapFileEmbeddingStatus(data.embeddingStatus),
    embeddingUpdatedAt: data.embeddingUpdatedAt ? toDate(data.embeddingUpdatedAt) : null,
    understandingStatus: mapUnderstandingStatus(data.understandingStatus),
    understandingUpdatedAt: data.understandingUpdatedAt ? toDate(data.understandingUpdatedAt) : null,
    understandingErrorCode: typeof data.understandingErrorCode === "string" ? data.understandingErrorCode : null,
    visualStatus: mapVisualStatus(data.visualStatus),
    visualUpdatedAt: data.visualUpdatedAt ? toDate(data.visualUpdatedAt) : null,
    visualErrorCode: typeof data.visualErrorCode === "string" ? data.visualErrorCode : null,
    materialType: mapMaterialType(data.materialType),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapAssignmentStatus(value: unknown): UploadedFileRecord["assignmentStatus"] {
  if (value === "assigned" || value === "needs-review") {
    return value;
  }
  return "unassigned";
}

function mapIndexingStatus(value: unknown): UploadedFileRecord["indexingStatus"] {
  if (
    value === "not-indexed" ||
    value === "queued" ||
    value === "uploaded" ||
    value === "indexing" ||
    value === "indexed" ||
    value === "failed"
  ) {
    return value;
  }
  return "not-indexed";
}

function mapSourceType(value: unknown): UploadedFileRecord["sourceType"] {
  if (value === "pdf" || value === "docx" || value === "note" || value === "other") {
    return value;
  }
  return "other";
}

function mapFilePolicy(value: unknown): UploadedFileRecord["filePolicy"] {
  if (
    value === "knowledge_base_source" ||
    value === "context_for_practice_generation" ||
    value === "temporary_reference"
  ) {
    return value;
  }
  return undefined;
}

function mapSummaryStatus(value: unknown): UploadedFileRecord["summaryStatus"] {
  if (value === "not_requested" || value === "pending" || value === "ready" || value === "failed") {
    return value;
  }
  return "not_requested";
}

function mapSummarySource(value: unknown): UploadedFileRecord["summarySource"] {
  if (value === "none" || value === "placeholder") {
    return value;
  }
  return "none";
}

function mapExtractionStatus(value: unknown): UploadedFileRecord["extractionStatus"] {
  if (value === "not_started" || value === "pending" || value === "completed" || value === "failed") {
    return value;
  }
  return "not_started";
}

function mapExtractionSource(value: unknown): UploadedFileRecord["extractionSource"] {
  if (
    value === "deterministic_test_parser" ||
    value === "manual_placeholder" ||
    value === "future_real_parser" ||
    value === "mammoth_docx_parser" ||
    value === "pdf_parse_pdf_parser"
  ) {
    return value;
  }
  return undefined;
}

function mapChunkingStatus(value: unknown): UploadedFileRecord["chunkingStatus"] {
  if (value === "not_started" || value === "pending" || value === "completed" || value === "failed") {
    return value;
  }
  return "not_started";
}

function mapFileEmbeddingStatus(value: unknown): UploadedFileRecord["embeddingStatus"] {
  if (value === "not_started" || value === "completed" || value === "failed") {
    return value;
  }
  return "not_started";
}

function mapUnderstandingStatus(value: unknown): UploadedFileRecord["understandingStatus"] {
  if (value === "not_started" || value === "processing" || value === "completed" || value === "failed") {
    return value;
  }
  return "not_started";
}

function mapVisualStatus(value: unknown): UploadedFileRecord["visualStatus"] {
  if (value === "not_started" || value === "available" || value === "processing" || value === "completed" || value === "failed") {
    return value;
  }
  return "not_started";
}

function mapMaterialType(value: unknown): UploadedFileRecord["materialType"] {
  if (
    value === "assignment" ||
    value === "exam" ||
    value === "summary" ||
    value === "lecture_notes" ||
    value === "slides" ||
    value === "formula_sheet" ||
    value === "book_chapter" ||
    value === "lab_sheet" ||
    value === "solutions" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}

function getOwnerUserId(data: Record<string, unknown>): string {
  if (typeof data.userId === "string") return data.userId;
  if (typeof data.user_id === "string") return data.user_id;
  return "";
}
