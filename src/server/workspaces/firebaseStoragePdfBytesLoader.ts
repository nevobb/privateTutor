import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "../firebase/firebaseAdminApp";
import { getFirebaseServerMode, getRequiredServerProjectId } from "../firebase/firebaseServerRuntimeMode";
import type { PdfBytesLoader } from "./documentUnderstandingProvider";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Matches upload limit in storageUploadClient.ts. */
export const PDF_BYTES_MAX_SIZE = 20 * 1024 * 1024; // 20 MB

/** App-managed storage path convention: users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName} */
const STORAGE_PATH_PATTERN =
  /^users\/([^/]+)\/workspaces\/([^/]+)\/files\/([^/]+)\/([^/]+)$/;

const PDF_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/octet-stream", // tolerated — some uploads store without explicit type
]);

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type PdfLoadErrorCode =
  | "wrong_source_type"
  | "missing_storage_path"
  | "invalid_path_format"
  | "ownership_mismatch"
  | "file_id_mismatch"
  | "file_too_large"
  | "wrong_content_type"
  | "storage_unavailable"
  | "storage_read_error"
  | "empty_bytes";

export type PdfLoadResult =
  | {
      ok: true;
      bytes: Uint8Array;
      sizeBytes: number;
      contentType: string;
      storageGeneration: string | undefined;
      inputHash: string;
      storagePath: string;
    }
  | { ok: false; code: PdfLoadErrorCode; message: string };

// ---------------------------------------------------------------------------
// Dependency interface (narrow, mockable)
// ---------------------------------------------------------------------------

export interface StorageFileHandle {
  download(): Promise<[Buffer]>;
  getMetadata(): Promise<[{ size?: string | number; contentType?: string; generation?: string }]>;
}

export interface StorageBucketHandle {
  file(path: string): StorageFileHandle;
}

export interface FirebaseStoragePdfBytesLoaderDeps {
  getStorageBucket(): StorageBucketHandle;
}

// ---------------------------------------------------------------------------
// Loader interface (richer output than base PdfBytesLoader)
// ---------------------------------------------------------------------------

export interface FirebaseStoragePdfBytesLoader extends PdfBytesLoader {
  loadPdfBytesWithMetadata(input: {
    userId: string;
    workspaceId: string;
    fileId: string;
    fileName: string;
    storagePath: string;
    sourceType: string;
  }): Promise<PdfLoadResult>;
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

type PathParseResult =
  | { ok: true; userId: string; workspaceId: string; fileId: string; fileName: string }
  | { ok: false; code: PdfLoadErrorCode; message: string };

function parseStoragePath(storagePath: string): PathParseResult {
  if (!storagePath || storagePath.trim().length === 0) {
    return { ok: false, code: "missing_storage_path", message: "storagePath is empty or missing." };
  }

  // Reject path traversal
  if (storagePath.includes("..")) {
    return {
      ok: false,
      code: "invalid_path_format",
      message: "storagePath must not contain traversal segments.",
    };
  }

  const match = STORAGE_PATH_PATTERN.exec(storagePath);
  if (!match) {
    return {
      ok: false,
      code: "invalid_path_format",
      message:
        "storagePath must match users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName}.",
    };
  }

  const [, userId, workspaceId, fileId, fileName] = match;
  return { ok: true, userId: userId!, workspaceId: workspaceId!, fileId: fileId!, fileName: fileName! };
}

function validateOwnership(
  parsedPath: { userId: string; fileId: string },
  input: { userId: string; fileId: string }
): { ok: true } | { ok: false; code: PdfLoadErrorCode; message: string } {
  if (parsedPath.userId !== input.userId) {
    return {
      ok: false,
      code: "ownership_mismatch",
      message: "storagePath userId does not match the requesting userId.",
    };
  }

  if (parsedPath.fileId !== input.fileId) {
    return {
      ok: false,
      code: "file_id_mismatch",
      message: "storagePath fileId does not match the requested fileId.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Hash helper — sha256 of bytes, hex-encoded. No raw content logged.
// ---------------------------------------------------------------------------

function computeInputHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// Default bucket resolution
// ---------------------------------------------------------------------------

function getDefaultStorageBucket(): StorageBucketHandle {
  const mode = getFirebaseServerMode();
  const projectId = getRequiredServerProjectId();

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ?? `${projectId}.appspot.com`;

  if (mode === "emulator" && !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error(
      "storage_unavailable: FIREBASE_STORAGE_EMULATOR_HOST is not set in emulator mode. " +
        "Configure it or inject a StorageBucketHandle in tests."
    );
  }

  const app = getFirebaseAdminApp();
  return getStorage(app).bucket(bucketName) as unknown as StorageBucketHandle;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFirebaseStoragePdfBytesLoader(
  deps: FirebaseStoragePdfBytesLoaderDeps = { getStorageBucket: getDefaultStorageBucket }
): FirebaseStoragePdfBytesLoader {
  return {
    async loadPdfBytesWithMetadata(input): Promise<PdfLoadResult> {
      // Guard: source type must be PDF
      if (input.sourceType !== "pdf") {
        return {
          ok: false,
          code: "wrong_source_type",
          message: `Source type "${input.sourceType}" is not supported. Only PDF files can be loaded.`,
        };
      }

      // Guard: validate and parse path
      const pathResult = parseStoragePath(input.storagePath);
      if (!pathResult.ok) {
        return { ok: false, code: pathResult.code, message: pathResult.message };
      }

      // Guard: ownership
      const ownershipResult = validateOwnership(pathResult, {
        userId: input.userId,
        fileId: input.fileId,
      });
      if (!ownershipResult.ok) {
        return { ok: false, code: ownershipResult.code, message: ownershipResult.message };
      }

      let bucket: StorageBucketHandle;
      try {
        bucket = deps.getStorageBucket();
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown storage init error";
        return { ok: false, code: "storage_unavailable", message };
      }

      const fileHandle = bucket.file(input.storagePath);

      // Fetch metadata first to guard on content type and size before downloading
      let storageMetadata: { size?: string | number; contentType?: string; generation?: string };
      try {
        const [meta] = await fileHandle.getMetadata();
        storageMetadata = meta;
      } catch (error) {
        const message = error instanceof Error ? error.message : "metadata fetch failed";
        return { ok: false, code: "storage_read_error", message: `metadata_fetch_failed: ${message}` };
      }

      // Guard: content type check (non-fatal if absent — storage may omit)
      const contentType = storageMetadata.contentType ?? "application/pdf";
      if (storageMetadata.contentType && !PDF_CONTENT_TYPES.has(storageMetadata.contentType)) {
        return {
          ok: false,
          code: "wrong_content_type",
          message: `Expected PDF content type, got "${storageMetadata.contentType}".`,
        };
      }

      // Guard: size check from metadata
      const metaSize =
        typeof storageMetadata.size === "string"
          ? parseInt(storageMetadata.size, 10)
          : typeof storageMetadata.size === "number"
            ? storageMetadata.size
            : null;

      if (metaSize !== null && metaSize > PDF_BYTES_MAX_SIZE) {
        return {
          ok: false,
          code: "file_too_large",
          message: `File is ${metaSize} bytes which exceeds the ${PDF_BYTES_MAX_SIZE}-byte limit.`,
        };
      }

      // Download bytes
      let downloadedBuffer: Buffer;
      try {
        const [buffer] = await fileHandle.download();
        downloadedBuffer = buffer;
      } catch (error) {
        const message = error instanceof Error ? error.message : "download failed";
        return { ok: false, code: "storage_read_error", message: `download_failed: ${message}` };
      }

      if (!downloadedBuffer || downloadedBuffer.length === 0) {
        return { ok: false, code: "empty_bytes", message: "Storage returned empty PDF content." };
      }

      // Guard: size check from actual bytes
      if (downloadedBuffer.length > PDF_BYTES_MAX_SIZE) {
        return {
          ok: false,
          code: "file_too_large",
          message: `Downloaded file is ${downloadedBuffer.length} bytes which exceeds the ${PDF_BYTES_MAX_SIZE}-byte limit.`,
        };
      }

      const bytes = new Uint8Array(downloadedBuffer);
      // Hash computed from bytes — no raw bytes or content logged
      const inputHash = computeInputHash(bytes);

      return {
        ok: true,
        bytes,
        sizeBytes: bytes.length,
        contentType,
        storageGeneration: storageMetadata.generation,
        inputHash,
        storagePath: input.storagePath,
      };
    },

    async loadPdfBytes(input): Promise<Uint8Array> {
      const result = await this.loadPdfBytesWithMetadata(input);
      if (!result.ok) {
        throw new Error(`${result.code}: ${result.message}`);
      }
      return result.bytes;
    },
  };
}

export const firebaseStoragePdfBytesLoader: FirebaseStoragePdfBytesLoader =
  createFirebaseStoragePdfBytesLoader();
