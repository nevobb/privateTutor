import type { UploadedFileRecord } from "./workspaceTypes";

const VALID_SOURCE_TYPES = ["pdf", "docx"] as const;
const VALID_UNDERSTANDING_STATUSES = ["not_started", "pending", "completed", "failed"] as const;
const VALID_EXTRACTION_QUALITIES = ["good", "partial", "poor"] as const;
const VALID_DEEP_PDF_STATUSES = [
  "not_started",
  "recommended",
  "pending",
  "completed",
  "failed",
  "skipped",
] as const;

export interface CreateUploadedFileApiRequest {
  fileName: string;
  originalFileName?: string;
  sourceType: (typeof VALID_SOURCE_TYPES)[number];
  storagePath?: string;
  topicHint?: string;
}

export interface UploadedFileApiResponse {
  id: string;
  userId: string;
  workspaceId?: string;
  fileName: string;
  originalFileName?: string;
  sourceType: "pdf" | "docx" | "note" | "other";
  storagePath?: string;
  topic?: string;
  confidence?: number;
  assignmentStatus: UploadedFileRecord["assignmentStatus"];
  indexingStatus: UploadedFileRecord["indexingStatus"];
  summaryStatus: UploadedFileRecord["summaryStatus"];
  summaryText: string | null;
  summarySource: UploadedFileRecord["summarySource"];
  summaryErrorCode: string | null;
  summaryUpdatedAt: string | null;
  extractionStatus: UploadedFileRecord["extractionStatus"];
  extractedText?: string;
  extractedTextPreview?: string;
  extractedTextCharCount?: number;
  extractionSource?: UploadedFileRecord["extractionSource"];
  extractionErrorCode: string | null;
  extractionUpdatedAt: string | null;
  understandingStatus?: UploadedFileRecord["understandingStatus"];
  understandingErrorCode: string | null;
  understandingUpdatedAt: string | null;
  pageCount?: number;
  outlineTitle?: string;
  detectedQuestionCount?: number;
  extractionQuality?: UploadedFileRecord["extractionQuality"];
  chunkingStatus: UploadedFileRecord["chunkingStatus"];
  chunkCount?: number;
  chunkingErrorCode: string | null;
  chunkingUpdatedAt: string | null;
  deepPdfStatus?: UploadedFileRecord["deepPdfStatus"];
  deepPdfProviderName?: string;
  deepPdfModel?: string;
  deepPdfInputHash?: string;
  deepPdfStorageGeneration?: string;
  deepPdfArtifactVersion?: string;
  deepPdfCompletedAt: string | null;
  deepPdfErrorCode: string | null;
  deepPdfUpdatedAt: string | null;
  understandingMode?: UploadedFileRecord["understandingMode"];
  embeddingStatus: UploadedFileRecord["embeddingStatus"];
  embeddingUpdatedAt: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFileListApiResponse {
  files: UploadedFileApiResponse[];
}

export type CreateUploadedFileValidationResult =
  | { ok: true; input: CreateUploadedFileApiRequest }
  | { ok: false; error: string };

export type UploadedFileApiResponseValidationResult =
  | { ok: true; value: UploadedFileApiResponse }
  | { ok: false; error: string };

export function parseCreateUploadedFileRequest(body: unknown): CreateUploadedFileValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  const fileName = asTrimmedString(raw.fileName);
  if (!fileName) {
    return { ok: false, error: "fileName is required and must be a non-empty string." };
  }
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return { ok: false, error: "fileName must not contain path separators or traversal segments." };
  }

  if (!isSourceType(raw.sourceType)) {
    return { ok: false, error: "sourceType must be one of: pdf, docx." };
  }
  const extension = getFileExtension(fileName);
  if (!extension || extension !== raw.sourceType) {
    return { ok: false, error: "sourceType must match fileName extension (.pdf or .docx)." };
  }

  if (raw.storagePath !== undefined && typeof raw.storagePath !== "string") {
    return { ok: false, error: "storagePath must be a string when provided." };
  }

  if (raw.topicHint !== undefined && typeof raw.topicHint !== "string") {
    return { ok: false, error: "topicHint must be a string when provided." };
  }

  return {
    ok: true,
    input: {
      fileName,
      originalFileName: asTrimmedString(raw.originalFileName),
      sourceType: raw.sourceType,
      storagePath: asTrimmedString(raw.storagePath),
      topicHint: asTrimmedString(raw.topicHint),
    },
  };
}

export function toUploadedFileApiResponse(record: UploadedFileRecord): UploadedFileApiResponse {
  return {
    id: record.id,
    userId: record.userId,
    workspaceId: record.workspaceId,
    fileName: record.name,
    originalFileName: record.originalFileName,
    sourceType: record.sourceType,
    storagePath: record.storagePath,
    topic: record.topic,
    confidence: record.confidence,
    assignmentStatus: record.assignmentStatus,
    indexingStatus: record.indexingStatus,
    summaryStatus: record.summaryStatus ?? "not_requested",
    summaryText: record.summaryText ?? null,
    summarySource: record.summarySource ?? "none",
    summaryErrorCode: record.summaryErrorCode ?? null,
    summaryUpdatedAt: record.summaryUpdatedAt ? record.summaryUpdatedAt.toISOString() : null,
    extractionStatus: record.extractionStatus ?? "not_started",
    extractedText: record.extractedText,
    extractedTextPreview: record.extractedTextPreview,
    extractedTextCharCount: record.extractedTextCharCount,
    extractionSource: record.extractionSource,
    extractionErrorCode: record.extractionErrorCode ?? null,
    extractionUpdatedAt: record.extractionUpdatedAt ? record.extractionUpdatedAt.toISOString() : null,
    understandingStatus: record.understandingStatus,
    understandingErrorCode: record.understandingErrorCode ?? null,
    understandingUpdatedAt: record.understandingUpdatedAt ? record.understandingUpdatedAt.toISOString() : null,
    pageCount: record.pageCount,
    outlineTitle: record.outlineTitle,
    detectedQuestionCount: record.detectedQuestionCount,
    extractionQuality: record.extractionQuality,
    chunkingStatus: record.chunkingStatus ?? "not_started",
    chunkCount: record.chunkCount,
    chunkingErrorCode: record.chunkingErrorCode ?? null,
    chunkingUpdatedAt: record.chunkingUpdatedAt ? record.chunkingUpdatedAt.toISOString() : null,
    deepPdfStatus: record.deepPdfStatus,
    deepPdfProviderName: record.deepPdfProviderName,
    deepPdfModel: record.deepPdfModel,
    deepPdfInputHash: record.deepPdfInputHash,
    deepPdfStorageGeneration: record.deepPdfStorageGeneration,
    deepPdfArtifactVersion: record.deepPdfArtifactVersion,
    deepPdfCompletedAt: record.deepPdfCompletedAt ? record.deepPdfCompletedAt.toISOString() : null,
    deepPdfErrorCode: record.deepPdfErrorCode ?? null,
    deepPdfUpdatedAt: record.deepPdfUpdatedAt ? record.deepPdfUpdatedAt.toISOString() : null,
    understandingMode: record.understandingMode,
    embeddingStatus: record.embeddingStatus ?? "not_started",
    embeddingUpdatedAt: record.embeddingUpdatedAt ? record.embeddingUpdatedAt.toISOString() : null,
    uploadedAt: record.uploadedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function parseUploadedFileApiResponse(body: unknown): UploadedFileApiResponseValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Uploaded file response must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  if (raw.understandingStatus !== undefined && !isUnderstandingStatus(raw.understandingStatus)) {
    return {
      ok: false,
      error: "understandingStatus must be one of: not_started, pending, completed, failed.",
    };
  }

  if (raw.extractionQuality !== undefined && !isExtractionQuality(raw.extractionQuality)) {
    return {
      ok: false,
      error: "extractionQuality must be one of: good, partial, poor.",
    };
  }

  if (raw.deepPdfStatus !== undefined && !isDeepPdfStatus(raw.deepPdfStatus)) {
    return {
      ok: false,
      error: "deepPdfStatus must be one of: not_started, recommended, pending, completed, failed, skipped.",
    };
  }

  if (
    raw.understandingMode !== undefined &&
    raw.understandingMode !== "text_only" &&
    raw.understandingMode !== "deep_pdf"
  ) {
    return {
      ok: false,
      error: "understandingMode must be one of: text_only, deep_pdf.",
    };
  }

  return { ok: true, value: raw as unknown as UploadedFileApiResponse };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isSourceType(value: unknown): value is (typeof VALID_SOURCE_TYPES)[number] {
  return typeof value === "string" && VALID_SOURCE_TYPES.includes(value as (typeof VALID_SOURCE_TYPES)[number]);
}

function isUnderstandingStatus(value: unknown): value is UploadedFileRecord["understandingStatus"] {
  return typeof value === "string" && VALID_UNDERSTANDING_STATUSES.includes(value as (typeof VALID_UNDERSTANDING_STATUSES)[number]);
}

function isExtractionQuality(value: unknown): value is UploadedFileRecord["extractionQuality"] {
  return typeof value === "string" && VALID_EXTRACTION_QUALITIES.includes(value as (typeof VALID_EXTRACTION_QUALITIES)[number]);
}

function isDeepPdfStatus(value: unknown): value is UploadedFileRecord["deepPdfStatus"] {
  return typeof value === "string" && VALID_DEEP_PDF_STATUSES.includes(value as (typeof VALID_DEEP_PDF_STATUSES)[number]);
}

function getFileExtension(fileName: string): string | null {
  const parts = fileName.toLowerCase().split(".");
  if (parts.length < 2) return null;
  return parts.at(-1) ?? null;
}
