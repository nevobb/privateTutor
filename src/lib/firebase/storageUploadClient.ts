import { ref, uploadBytes } from "firebase/storage";
import { getClientStorage } from "./firebaseClientApp";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const SAFE_NAME_REPLACEMENT = "_";

export type UploadableLearningFile = {
  file: File;
  userId: string;
  workspaceId: string;
  fileId: string;
};

export type LearningFileSourceType = "pdf" | "docx";

export function validateLearningFile(
  file: File
): { ok: true; sourceType: LearningFileSourceType } | { ok: false; reason: string } {
  if (!(file instanceof File)) {
    return { ok: false, reason: "No file selected." };
  }

  if (file.size <= 0) {
    return { ok: false, reason: "File is empty." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: "File exceeds 20 MB limit." };
  }

  const sourceType = detectSourceType(file.name, file.type);
  if (!sourceType) {
    return { ok: false, reason: "Only PDF and DOCX are supported." };
  }

  return { ok: true, sourceType };
}

export async function uploadLearningFileToStorage(input: UploadableLearningFile): Promise<{
  storagePath: string;
  fileName: string;
  originalFileName: string;
  sizeBytes: number;
  contentType: string;
  sourceType: LearningFileSourceType;
}> {
  const validation = validateLearningFile(input.file);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const sourceType = validation.sourceType;
  const safeFileName = sanitizeFileName(input.file.name);
  const storagePath = `users/${input.userId}/workspaces/${input.workspaceId}/files/${input.fileId}/${safeFileName}`;

  const storage = getClientStorage();
  const storageRef = ref(storage, storagePath);
  const contentType =
    sourceType === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  await uploadBytes(storageRef, input.file, {
    contentType,
    customMetadata: {
      sourceType,
      originalName: input.file.name,
    },
  });

  return {
    storagePath,
    fileName: safeFileName,
    originalFileName: input.file.name,
    sizeBytes: input.file.size,
    contentType,
    sourceType,
  };
}

export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const extension = getLowercaseExtension(trimmed);
  const baseName = extension ? trimmed.slice(0, -(extension.length + 1)) : trimmed;

  const normalizedBase = baseName
    .replace(/[\\/]+/g, SAFE_NAME_REPLACEMENT)
    .replace(/\.{2,}/g, ".")
    .replace(/[^a-zA-Z0-9._-]+/g, SAFE_NAME_REPLACEMENT)
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");

  const safeBase = normalizedBase.length > 0 ? normalizedBase : "uploaded-file";
  return extension ? `${safeBase}.${extension}` : safeBase;
}

function detectSourceType(fileName: string, mimeType: string): LearningFileSourceType | null {
  const ext = getLowercaseExtension(fileName);
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";

  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }

  return null;
}

function getLowercaseExtension(fileName: string): string | null {
  const parts = fileName.trim().split(".");
  if (parts.length < 2) return null;
  return parts.at(-1)?.toLowerCase() ?? null;
}
