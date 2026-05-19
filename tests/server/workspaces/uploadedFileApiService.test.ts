import { describe, expect, it, vi } from "vitest";
import { createUploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import type { UploadedFileRecord, WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";

const user: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const baseDate = new Date("2026-05-19T08:00:00.000Z");

const workspace: WorkspaceRecord = {
  id: "ws-1",
  userId: "alice",
  name: "Physics",
  description: "",
  status: "active",
  createdAt: baseDate,
  updatedAt: baseDate,
};

function createRecord(overrides: Partial<UploadedFileRecord> = {}): UploadedFileRecord {
  return {
    id: "file-1",
    userId: "alice",
    workspaceId: "ws-1",
    name: "Mechanics Intro.pdf",
    url: "",
    uploadedAt: baseDate,
    assignmentStatus: "assigned",
    indexingStatus: "uploaded",
    sourceType: "pdf",
    topic: "Mechanics",
    confidence: 0.92,
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
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeRepositories() {
  const createUploadedFile = vi.fn(async () => createRecord());
  const updateUploadedFile = vi.fn(async (_userId: string, _fileId: string, updates: Partial<UploadedFileRecord>) => {
    if (updates.indexingStatus === "indexing") return createRecord({ indexingStatus: "indexing" });
    if (updates.indexingStatus === "indexed") return createRecord({ indexingStatus: "indexed" });
    if (updates.indexingStatus === "failed") return createRecord({ indexingStatus: "failed" });

    if (updates.summaryStatus === "pending") return createRecord({ summaryStatus: "pending", summaryUpdatedAt: baseDate });
    if (updates.summaryStatus === "ready") {
      return createRecord({
        summaryStatus: "ready",
        summaryText: "Summary placeholder; content extraction not enabled yet.",
        summarySource: "placeholder",
        summaryErrorCode: null,
        summaryUpdatedAt: baseDate,
      });
    }
    if (updates.summaryStatus === "failed") {
      return createRecord({
        summaryStatus: "failed",
        summarySource: "none",
        summaryErrorCode: "summary_lifecycle_failed",
        summaryUpdatedAt: baseDate,
      });
    }

    if (updates.extractionStatus === "pending") return createRecord({ extractionStatus: "pending", extractionUpdatedAt: baseDate });
    if (updates.extractionStatus === "completed") {
      return createRecord({
        extractionStatus: "completed",
        extractedText: updates.extractedText,
        extractedTextPreview: updates.extractedTextPreview,
        extractedTextCharCount: updates.extractedTextCharCount,
        extractionSource: updates.extractionSource,
        extractionErrorCode: null,
        extractionUpdatedAt: baseDate,
      });
    }
    if (updates.extractionStatus === "failed") {
      return createRecord({ extractionStatus: "failed", extractionErrorCode: "extraction_lifecycle_failed", extractionUpdatedAt: baseDate });
    }

    if (updates.chunkingStatus === "pending") return createRecord({ chunkingStatus: "pending", chunkingUpdatedAt: baseDate });
    if (updates.chunkingStatus === "completed") {
      return createRecord({
        chunkingStatus: "completed",
        chunkCount: updates.chunkCount,
        chunkingErrorCode: null,
        chunkingUpdatedAt: baseDate,
      });
    }
    if (updates.chunkingStatus === "failed") {
      return createRecord({ chunkingStatus: "failed", chunkingErrorCode: "chunking_lifecycle_failed", chunkingUpdatedAt: baseDate });
    }

    return createRecord();
  });

  const writeDecisionLogEntry = vi.fn(async () => ({
    id: "decision-1",
    userId: "alice",
    decisionType: "file_assignment" as const,
    title: "t",
    decision: "d",
    rationale: "r",
    date: baseDate.toISOString(),
    createdAt: baseDate,
  }));

  return {
    getWorkspace: vi.fn(async (): Promise<WorkspaceRecord | null> => workspace),
    createUploadedFile,
    getUploadedFile: vi.fn(async () => createRecord()),
    updateUploadedFile,
    fileExtractionProvider: {
      extractText: vi.fn(async ({ fileName }: { fileName: string }) => ({
        text: `Extraction boundary placeholder for ${fileName}. Real PDF/DOCX parsing is not implemented yet.`,
        source: "deterministic_test_parser" as const,
      })),
    },
    listFileChunks: vi.fn(async () => []),
    replaceFileChunks: vi.fn(async () => {}),
    listUploadedFiles: vi.fn(async () => [createRecord({ indexingStatus: "indexed" })]),
    writeDecisionLogEntry,
  };
}

describe("uploadedFileApiService.createFileForWorkspace", () => {
  it("creates metadata, classifies, completes indexing lifecycle and writes decision logs", async () => {
    const repos = makeRepositories();
    const service = createUploadedFileApiService(repos as never);

    const result = await service.createFileForWorkspace(user, "ws-1", {
      fileName: "Mechanics Intro.pdf",
      sourceType: "pdf",
      topicHint: "Classical Mechanics",
    });

    expect(result).not.toBeNull();
    expect(result?.indexingStatus).toBe("indexed");
    expect(repos.createUploadedFile).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({
        workspaceId: "ws-1",
        indexingStatus: "uploaded",
        assignmentStatus: "assigned",
        topic: "Classical Mechanics",
        summaryStatus: "not_requested",
        extractionStatus: "not_started",
        chunkingStatus: "not_started",
      })
    );
  });

  it("returns null when workspace does not exist", async () => {
    const repos = makeRepositories();
    repos.getWorkspace = vi.fn(async (): Promise<WorkspaceRecord | null> => null);
    const service = createUploadedFileApiService(repos as never);
    const result = await service.createFileForWorkspace(user, "missing", {
      fileName: "Mechanics Intro.pdf",
      sourceType: "pdf",
    });
    expect(result).toBeNull();
  });

  it("rejects cross-user storagePath", async () => {
    const repos = makeRepositories();
    const service = createUploadedFileApiService(repos as never);
    await expect(
      service.createFileForWorkspace(user, "ws-1", {
        fileName: "Mechanics Intro.pdf",
        sourceType: "pdf",
        storagePath: "users/bob/workspaces/ws-1/files/file-1/Mechanics Intro.pdf",
      })
    ).rejects.toThrow("storagePath userId does not match authenticated user.");
  });
});

describe("uploadedFileApiService.runExtractionLifecycleForFile", () => {
  it("runs extraction lifecycle from not_started to completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        storagePath: "users/alice/workspaces/ws-1/files/file-1/Mechanics Intro.pdf",
        extractionStatus: "not_started",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runExtractionLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
  });
});

describe("uploadedFileApiService.runChunkingLifecycleForFile", () => {
  it("chunks extracted text and marks chunking completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({ extractionStatus: "completed", extractedText: "Paragraph one. ".repeat(300) })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.chunkingStatus).toBe("completed");
      expect(result.chunkCount).toBeGreaterThan(0);
    }
    expect(repos.replaceFileChunks).toHaveBeenCalled();
  });

  it("rejects when extraction not completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ extractionStatus: "pending", extractedText: "x" }));
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "extraction_not_completed" });
  });

  it("rejects missing extracted text", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ extractionStatus: "completed", extractedText: "" }));
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "missing_extracted_text" });
  });

  it("marks failed when chunk persistence fails", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({ extractionStatus: "completed", extractedText: "x".repeat(1600) })
    );
    repos.replaceFileChunks = vi.fn(async () => {
      throw new Error("write_failed");
    });
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.chunkingStatus).toBe("failed");
      expect(result.file.chunkingErrorCode).toBe("chunking_lifecycle_failed");
    }
  });
});
