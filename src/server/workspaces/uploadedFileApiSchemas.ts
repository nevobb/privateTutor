import type { UploadedFileRecord } from "./workspaceTypes";

const VALID_SOURCE_TYPES = ["pdf", "docx"] as const;

export interface CreateUploadedFileApiRequest {
  fileName: string;
  sourceType: (typeof VALID_SOURCE_TYPES)[number];
  storagePath?: string;
  topicHint?: string;
}

export interface UploadedFileApiResponse {
  id: string;
  userId: string;
  workspaceId?: string;
  fileName: string;
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
    uploadedAt: record.uploadedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isSourceType(value: unknown): value is (typeof VALID_SOURCE_TYPES)[number] {
  return typeof value === "string" && VALID_SOURCE_TYPES.includes(value as (typeof VALID_SOURCE_TYPES)[number]);
}

function getFileExtension(fileName: string): string | null {
  const parts = fileName.toLowerCase().split(".");
  if (parts.length < 2) return null;
  return parts.at(-1) ?? null;
}
