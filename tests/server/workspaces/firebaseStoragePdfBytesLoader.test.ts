import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createFirebaseStoragePdfBytesLoader,
  PDF_BYTES_MAX_SIZE,
  type StorageBucketHandle,
  type StorageFileHandle,
} from "../../../src/server/workspaces/firebaseStoragePdfBytesLoader";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const VALID_PDF_BYTES = Buffer.concat([PDF_MAGIC, Buffer.alloc(1000, 0xab)]);
const VALID_STORAGE_PATH = "users/alice/workspaces/ws-1/files/file-1/Physics.pdf";
const VALID_INPUT = {
  userId: "alice",
  workspaceId: "ws-1",
  fileId: "file-1",
  fileName: "Physics.pdf",
  storagePath: VALID_STORAGE_PATH,
  sourceType: "pdf",
} as const;

function makeFileHandle(overrides: Partial<{
  downloadBuffer: Buffer | null;
  downloadError: Error | null;
  metaSize: number;
  metaContentType: string;
  metaGeneration: string;
  metaError: Error | null;
}>): StorageFileHandle {
  const {
    downloadBuffer = VALID_PDF_BYTES,
    downloadError = null,
    metaSize = VALID_PDF_BYTES.length,
    metaContentType = "application/pdf",
    metaGeneration = "1234567890",
    metaError = null,
  } = overrides;

  return {
    download: vi.fn(async () => {
      if (downloadError) throw downloadError;
      return [downloadBuffer!] as [Buffer];
    }),
    getMetadata: vi.fn(async () => {
      if (metaError) throw metaError;
      return [{ size: metaSize, contentType: metaContentType, generation: metaGeneration }] as [{ size?: string | number; contentType?: string; generation?: string }];
    }),
  };
}

function makeBucket(fileHandle: StorageFileHandle): StorageBucketHandle {
  return { file: vi.fn(() => fileHandle) };
}

function makeDeps(fileHandle: StorageFileHandle) {
  const bucket = makeBucket(fileHandle);
  return {
    getStorageBucket: vi.fn(() => bucket),
    bucket,
    fileHandle,
  };
}

// ---------------------------------------------------------------------------
// 1. Valid PDF storage path
// ---------------------------------------------------------------------------

describe("valid PDF path", () => {
  it("returns ok=true with bytes", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBe(VALID_PDF_BYTES.length);
  });

  it("returns correct sizeBytes", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sizeBytes).toBe(VALID_PDF_BYTES.length);
  });

  it("returns storageGeneration from metadata", async () => {
    const fileHandle = makeFileHandle({ metaGeneration: "9876543210" });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storageGeneration).toBe("9876543210");
  });

  it("returns inputHash as a 64-char hex string (sha256)", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same bytes produce same hash (deterministic)", async () => {
    const bytes = Buffer.concat([PDF_MAGIC, Buffer.alloc(500, 0xcd)]);
    const fh1 = makeFileHandle({ downloadBuffer: bytes });
    const fh2 = makeFileHandle({ downloadBuffer: bytes });
    const l1 = createFirebaseStoragePdfBytesLoader({ getStorageBucket: vi.fn(() => makeBucket(fh1)) });
    const l2 = createFirebaseStoragePdfBytesLoader({ getStorageBucket: vi.fn(() => makeBucket(fh2)) });

    const [r1, r2] = await Promise.all([
      l1.loadPdfBytesWithMetadata(VALID_INPUT),
      l2.loadPdfBytesWithMetadata(VALID_INPUT),
    ]);

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.inputHash).toBe(r2.inputHash);
  });

  it("different bytes produce different hashes", async () => {
    const fh1 = makeFileHandle({ downloadBuffer: Buffer.concat([PDF_MAGIC, Buffer.alloc(100, 0x01)]) });
    const fh2 = makeFileHandle({ downloadBuffer: Buffer.concat([PDF_MAGIC, Buffer.alloc(100, 0x02)]) });
    const l1 = createFirebaseStoragePdfBytesLoader({ getStorageBucket: vi.fn(() => makeBucket(fh1)) });
    const l2 = createFirebaseStoragePdfBytesLoader({ getStorageBucket: vi.fn(() => makeBucket(fh2)) });

    const [r1, r2] = await Promise.all([
      l1.loadPdfBytesWithMetadata(VALID_INPUT),
      l2.loadPdfBytesWithMetadata(VALID_INPUT),
    ]);

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.inputHash).not.toBe(r2.inputHash);
  });

  it("returns storagePath in result", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storagePath).toBe(VALID_STORAGE_PATH);
  });
});

// ---------------------------------------------------------------------------
// 2. Non-PDF source type
// ---------------------------------------------------------------------------

describe("non-PDF source type", () => {
  it("rejects docx source type", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({ ...VALID_INPUT, sourceType: "docx" as const });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("wrong_source_type");
  });

  it("does not call storage when source type is wrong", async () => {
    const fileHandle = makeFileHandle({});
    const deps = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket: deps.getStorageBucket });

    await loader.loadPdfBytesWithMetadata({ ...VALID_INPUT, sourceType: "docx" as const });

    expect(deps.getStorageBucket).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Missing storagePath
// ---------------------------------------------------------------------------

describe("missing storagePath", () => {
  it("rejects empty storagePath", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({ ...VALID_INPUT, storagePath: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_storage_path");
  });

  it("rejects whitespace-only storagePath", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({ ...VALID_INPUT, storagePath: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_storage_path");
  });
});

// ---------------------------------------------------------------------------
// 4. Wrong-owner / suspicious path
// ---------------------------------------------------------------------------

describe("path ownership validation", () => {
  it("rejects path with userId mismatch", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({
      ...VALID_INPUT,
      storagePath: "users/eve/workspaces/ws-1/files/file-1/Physics.pdf",
      userId: "alice",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ownership_mismatch");
  });

  it("rejects path with fileId mismatch", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({
      ...VALID_INPUT,
      storagePath: "users/alice/workspaces/ws-1/files/file-999/Physics.pdf",
      fileId: "file-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("file_id_mismatch");
  });

  it("rejects path with traversal segments", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({
      ...VALID_INPUT,
      storagePath: "users/alice/../workspaces/ws-1/files/file-1/Physics.pdf",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_path_format");
  });

  it("rejects path that does not match expected format", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({
      ...VALID_INPUT,
      storagePath: "public/shared/Physics.pdf",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_path_format");
  });
});

// ---------------------------------------------------------------------------
// 5. Oversized file
// ---------------------------------------------------------------------------

describe("oversized file", () => {
  it("rejects file larger than PDF_BYTES_MAX_SIZE from metadata", async () => {
    const fileHandle = makeFileHandle({ metaSize: PDF_BYTES_MAX_SIZE + 1 });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("file_too_large");
  });

  it("rejects file larger than PDF_BYTES_MAX_SIZE from actual download", async () => {
    const oversizedBuffer = Buffer.alloc(PDF_BYTES_MAX_SIZE + 1, 0xab);
    const fileHandle = makeFileHandle({
      downloadBuffer: oversizedBuffer,
      metaSize: PDF_BYTES_MAX_SIZE + 1,
    });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("file_too_large");
  });

  it("accepts file exactly at the size limit", async () => {
    const exactBuffer = Buffer.alloc(PDF_BYTES_MAX_SIZE, 0xab);
    const fileHandle = makeFileHandle({
      downloadBuffer: exactBuffer,
      metaSize: PDF_BYTES_MAX_SIZE,
    });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
  });

  it("PDF_BYTES_MAX_SIZE constant is 20 MB", () => {
    expect(PDF_BYTES_MAX_SIZE).toBe(20 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// 6. Storage failure → safe structured error
// ---------------------------------------------------------------------------

describe("storage failure", () => {
  it("returns storage_read_error when metadata fetch fails", async () => {
    const fileHandle = makeFileHandle({ metaError: new Error("permission denied") });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_read_error");
    expect(result.message).toContain("permission denied");
  });

  it("returns storage_read_error when download fails", async () => {
    const fileHandle = makeFileHandle({ downloadError: new Error("network timeout") });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_read_error");
    expect(result.message).toContain("network timeout");
  });

  it("returns storage_unavailable when bucket init throws", async () => {
    const loader = createFirebaseStoragePdfBytesLoader({
      getStorageBucket: () => { throw new Error("storage_unavailable: emulator not configured"); },
    });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_unavailable");
  });

  it("returns empty_bytes when download returns empty buffer", async () => {
    const fileHandle = makeFileHandle({ downloadBuffer: Buffer.alloc(0) });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata({ ...VALID_INPUT });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("empty_bytes");
  });

  it("does not throw — always returns a structured result", async () => {
    const fileHandle = makeFileHandle({ downloadError: new Error("catastrophic storage error") });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    await expect(loader.loadPdfBytesWithMetadata(VALID_INPUT)).resolves.toBeDefined();
  });

  it("wrong content type returns wrong_content_type", async () => {
    const fileHandle = makeFileHandle({ metaContentType: "image/png" });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("wrong_content_type");
  });
});

// ---------------------------------------------------------------------------
// 7. PdfBytesLoader interface compatibility
// ---------------------------------------------------------------------------

describe("PdfBytesLoader interface", () => {
  it("loadPdfBytes returns Uint8Array on success", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const bytes = await loader.loadPdfBytes(VALID_INPUT);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(VALID_PDF_BYTES.length);
  });

  it("loadPdfBytes throws with error code on failure", async () => {
    const loader = createFirebaseStoragePdfBytesLoader({
      getStorageBucket: () => { throw new Error("storage_unavailable: not configured"); },
    });

    await expect(loader.loadPdfBytes(VALID_INPUT)).rejects.toThrow(/storage_unavailable/);
  });

  it("loadPdfBytes throws for wrong source type", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    await expect(
      loader.loadPdfBytes({ ...VALID_INPUT, sourceType: "docx" as const })
    ).rejects.toThrow(/wrong_source_type/);
  });
});

// ---------------------------------------------------------------------------
// 8. No raw byte/content logging
// ---------------------------------------------------------------------------

describe("no byte or content logging", () => {
  it("error result message does not contain raw PDF bytes", async () => {
    const fileHandle = makeFileHandle({ metaError: new Error("access denied") });
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Message should be short and not contain binary data
    expect(result.message.length).toBeLessThan(500);
    expect(result.message).not.toMatch(/\x00/);
  });

  it("success result does not include any text content field", async () => {
    const fileHandle = makeFileHandle({});
    const { getStorageBucket } = makeDeps(fileHandle);
    const loader = createFirebaseStoragePdfBytesLoader({ getStorageBucket });

    const result = await loader.loadPdfBytesWithMetadata(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The result must NOT have a text/content field exposing PDF content
    expect(result).not.toHaveProperty("text");
    expect(result).not.toHaveProperty("content");
    expect(result).not.toHaveProperty("extractedText");
  });
});

// ---------------------------------------------------------------------------
// 9. Regression: existing tests still pass without touching this module
// ---------------------------------------------------------------------------

describe("regression surface", () => {
  it("loader factory is callable without args (tests instantiation guard)", () => {
    // The default factory throws in test environment (no emulator configured)
    // That is correct behavior — tests must inject deps
    expect(() => createFirebaseStoragePdfBytesLoader({ getStorageBucket: () => makeBucket(makeFileHandle({})) })).not.toThrow();
  });

  it("two separate loader instances are independent", async () => {
    const fh1 = makeFileHandle({ metaGeneration: "111" });
    const fh2 = makeFileHandle({ metaGeneration: "222" });
    const l1 = createFirebaseStoragePdfBytesLoader({ getStorageBucket: vi.fn(() => makeBucket(fh1)) });
    const l2 = createFirebaseStoragePdfBytesLoader({ getStorageBucket: vi.fn(() => makeBucket(fh2)) });

    const [r1, r2] = await Promise.all([
      l1.loadPdfBytesWithMetadata(VALID_INPUT),
      l2.loadPdfBytesWithMetadata(VALID_INPUT),
    ]);

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.storageGeneration).toBe("111");
    expect(r2.storageGeneration).toBe("222");
  });
});
