import { describe, expect, it } from "vitest";
import {
  parseUploadedFileApiResponse,
  parseCreateUploadedFileRequest,
  toUploadedFileApiResponse,
} from "../../../src/server/workspaces/uploadedFileApiSchemas";
import type { UploadedFileRecord } from "../../../src/server/workspaces/workspaceTypes";

describe("uploadedFileApiSchemas", () => {
  it("validates a correct payload", () => {
    const result = parseCreateUploadedFileRequest({
      fileName: "Mechanics_Intro.pdf",
      sourceType: "pdf",
      storagePath: "uploads/alice/mechanics.pdf",
      topicHint: "Mechanics",
    });

    expect(result).toEqual({
      ok: true,
      input: {
        fileName: "Mechanics_Intro.pdf",
        sourceType: "pdf",
        storagePath: "uploads/alice/mechanics.pdf",
        topicHint: "Mechanics",
      },
    });
  });

  it("rejects unsupported sourceType", () => {
    const result = parseCreateUploadedFileRequest({
      fileName: "lesson.txt",
      sourceType: "txt",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("sourceType");
    }
  });

  it("rejects missing fileName", () => {
    const result = parseCreateUploadedFileRequest({ sourceType: "pdf" });
    expect(result.ok).toBe(false);
  });

  it("rejects sourceType/extension mismatch", () => {
    const result = parseCreateUploadedFileRequest({
      fileName: "lesson.docx",
      sourceType: "pdf",
    });
    expect(result).toEqual({
      ok: false,
      error: "sourceType must match fileName extension (.pdf or .docx).",
    });
  });

  it("rejects fileName path traversal or separators", () => {
    const result = parseCreateUploadedFileRequest({
      fileName: "../lesson.pdf",
      sourceType: "pdf",
    });
    expect(result).toEqual({
      ok: false,
      error: "fileName must not contain path separators or traversal segments.",
    });
  });

  it("serializes response shape", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");
    const record: UploadedFileRecord = {
      id: "file-1",
      userId: "alice",
      workspaceId: "ws-1",
      name: "Lecture 1.pdf",
      url: "",
      uploadedAt: now,
      assignmentStatus: "assigned",
      indexingStatus: "indexed",
      sourceType: "pdf",
      topic: "Physics",
      confidence: 0.9,
      storagePath: "uploads/alice/lecture-1.pdf",
      summaryStatus: "ready",
      summaryText: "Summary placeholder; content extraction not enabled yet.",
      summarySource: "placeholder",
      summaryErrorCode: null,
      summaryUpdatedAt: now,
      understandingStatus: "not_started",
      understandingErrorCode: null,
      understandingUpdatedAt: now,
      pageCount: 7,
      outlineTitle: "מבוא למכניקה",
      detectedQuestionCount: 4,
      extractionQuality: "partial",
      deepPdfStatus: "recommended",
      deepPdfProviderName: "gemini_pdf_understanding",
      deepPdfModel: "gemini-2.5-pro",
      deepPdfInputHash: "hash-v1",
      deepPdfStorageGeneration: "gen-v1",
      deepPdfArtifactVersion: "deep_pdf_artifacts_v1",
      deepPdfCompletedAt: now,
      deepPdfErrorCode: null,
      deepPdfUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const response = toUploadedFileApiResponse(record);
    expect(response.fileName).toBe("Lecture 1.pdf");
    expect(response.assignmentStatus).toBe("assigned");
    expect(response.indexingStatus).toBe("indexed");
    expect(response.summaryStatus).toBe("ready");
    expect(response.summarySource).toBe("placeholder");
    expect(response.summaryErrorCode).toBeNull();
    expect(response.summaryUpdatedAt).toBe(now.toISOString());
    expect(response.understandingStatus).toBe("not_started");
    expect(response.understandingErrorCode).toBeNull();
    expect(response.understandingUpdatedAt).toBe(now.toISOString());
    expect(response.pageCount).toBe(7);
    expect(response.outlineTitle).toBe("מבוא למכניקה");
    expect(response.detectedQuestionCount).toBe(4);
    expect(response.extractionQuality).toBe("partial");
    expect(response.deepPdfStatus).toBe("recommended");
    expect(response.deepPdfProviderName).toBe("gemini_pdf_understanding");
    expect(response.deepPdfModel).toBe("gemini-2.5-pro");
    expect(response.deepPdfInputHash).toBe("hash-v1");
    expect(response.deepPdfStorageGeneration).toBe("gen-v1");
    expect(response.deepPdfArtifactVersion).toBe("deep_pdf_artifacts_v1");
    expect(response.deepPdfCompletedAt).toBe(now.toISOString());
    expect(response.deepPdfErrorCode).toBeNull();
    expect(response.deepPdfUpdatedAt).toBe(now.toISOString());
    expect(response.uploadedAt).toBe(now.toISOString());
  });

  it("parses legacy response objects without new document-understanding fields", () => {
    const result = parseUploadedFileApiResponse({
      id: "file-1",
      userId: "alice",
      workspaceId: "ws-1",
      fileName: "Lecture 1.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "indexed",
      summaryStatus: "not_requested",
      summaryText: null,
      summarySource: "none",
      summaryErrorCode: null,
      summaryUpdatedAt: null,
      extractionStatus: "not_started",
      extractionErrorCode: null,
      extractionUpdatedAt: null,
      chunkingStatus: "not_started",
      chunkingErrorCode: null,
      chunkingUpdatedAt: null,
      embeddingStatus: "not_started",
      embeddingUpdatedAt: null,
      uploadedAt: "2026-05-19T08:00:00.000Z",
      createdAt: "2026-05-19T08:00:00.000Z",
      updatedAt: "2026-05-19T08:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: "file-1",
        extractionStatus: "not_started",
      }),
    });
  });

  it("rejects invalid understandingStatus when supplied", () => {
    const result = parseUploadedFileApiResponse({ understandingStatus: "unknown" });
    expect(result).toEqual({
      ok: false,
      error: "understandingStatus must be one of: not_started, pending, completed, failed.",
    });
  });

  it("rejects invalid extractionQuality when supplied", () => {
    const result = parseUploadedFileApiResponse({ extractionQuality: "excellent" });
    expect(result).toEqual({
      ok: false,
      error: "extractionQuality must be one of: good, partial, poor.",
    });
  });

  it("rejects invalid deepPdfStatus when supplied", () => {
    const result = parseUploadedFileApiResponse({ deepPdfStatus: "later" });
    expect(result).toEqual({
      ok: false,
      error: "deepPdfStatus must be one of: not_started, recommended, pending, completed, failed, skipped.",
    });
  });

  it("parses legacy response objects without new deep PDF cache metadata", () => {
    const result = parseUploadedFileApiResponse({
      id: "file-1",
      userId: "alice",
      workspaceId: "ws-1",
      fileName: "Lecture 1.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "indexed",
      summaryStatus: "not_requested",
      summaryText: null,
      summarySource: "none",
      summaryErrorCode: null,
      summaryUpdatedAt: null,
      extractionStatus: "not_started",
      extractionErrorCode: null,
      extractionUpdatedAt: null,
      chunkingStatus: "not_started",
      chunkingErrorCode: null,
      chunkingUpdatedAt: null,
      deepPdfStatus: "completed",
      deepPdfUpdatedAt: null,
      embeddingStatus: "not_started",
      embeddingUpdatedAt: null,
      uploadedAt: "2026-05-19T08:00:00.000Z",
      createdAt: "2026-05-19T08:00:00.000Z",
      updatedAt: "2026-05-19T08:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        deepPdfStatus: "completed",
      }),
    });
  });
});
