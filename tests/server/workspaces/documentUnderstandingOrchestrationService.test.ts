import { describe, expect, it, vi } from "vitest";
import {
  createDocumentUnderstandingOrchestrationService,
} from "../../../src/server/workspaces/documentUnderstandingOrchestrationService";
import type { UploadedFileRecord } from "../../../src/server/workspaces/workspaceTypes";
import type {
  DocumentUnderstandingProvider,
  DocumentUnderstandingInput,
  DocumentUnderstandingOutput,
} from "../../../src/server/workspaces/documentUnderstandingProvider";

const baseDate = new Date("2026-06-02T10:00:00.000Z");

function makeFile(overrides: Partial<UploadedFileRecord> = {}): UploadedFileRecord {
  return {
    id: "file-1",
    userId: "alice",
    workspaceId: "ws-1",
    name: "Physics.pdf",
    url: "",
    uploadedAt: baseDate,
    assignmentStatus: "assigned",
    indexingStatus: "indexed",
    sourceType: "pdf",
    storagePath: "users/alice/workspaces/ws-1/files/file-1/Physics.pdf",
    topic: "Physics",
    confidence: 0.9,
    summaryStatus: "not_requested",
    summaryText: null,
    summarySource: "none",
    summaryErrorCode: null,
    summaryUpdatedAt: null,
    extractionStatus: "completed",
    extractedText: "שאלה 1\n\nתוכן ראשון\n\nשאלה 2\n\nתוכן שני",
    extractedTextCharCount: 37,
    understandingStatus: "not_started",
    understandingErrorCode: null,
    understandingUpdatedAt: null,
    pageCount: undefined,
    outlineTitle: undefined,
    detectedQuestionCount: undefined,
    extractionQuality: undefined,
    extractionErrorCode: null,
    extractionUpdatedAt: null,
    chunkingStatus: "completed",
    chunkCount: 2,
    chunkingErrorCode: null,
    chunkingUpdatedAt: null,
    deepPdfStatus: "not_started",
    deepPdfUpdatedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeSuccessProvider(questionCount = 2): DocumentUnderstandingProvider {
  return {
    name: "test_provider",
    mode: "text_only" as const,
    async run(_input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput> {
      return {
        providerName: "test_provider",
        providerMode: "text_only",
        pageCount: 1,
        pages: [
          {
            pageId: "page_0001",
            fileId: _input.fileId,
            pageNumber: 1,
            extractedText: _input.extractedText ?? "",
            textQuality: "good",
            charCount: (_input.extractedText ?? "").length,
            sourceChunkIds: [],
          },
        ],
        outline: {
          outlineId: "v1",
          fileId: _input.fileId,
          sections: Array.from({ length: questionCount }, (_, i) => ({
            sectionId: `q_00${i + 1}`,
            label: `שאלה ${i + 1}`,
            charStart: i * 20,
            charEnd: (i + 1) * 20,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.8,
          })),
          confidence: "high",
        },
        detectedQuestions: Array.from({ length: questionCount }, (_, i) => ({
          questionId: `q_00${i + 1}`,
          fileId: _input.fileId,
          label: `שאלה ${i + 1}`,
          questionNumber: i + 1,
          charStart: i * 20,
          charEnd: (i + 1) * 20,
          sourceChunkIds: [],
          subsections: [],
          confidence: 0.8,
        })),
        qualitySignals: {
          hasExtractedText: true,
          extractedTextCharCount: 37,
          likelyHasMath: false,
          likelyHasVisualContent: false,
          textQuality: "good",
        },
        extractionQuality: "good",
        confidence: "high",
        warnings: [],
        errors: [],
      };
    },
  };
}

function makeFailingProvider(): DocumentUnderstandingProvider {
  return {
    name: "failing_provider",
    mode: "text_only" as const,
    async run(_input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput> {
      throw new Error("provider_internal_error");
    },
  };
}

function makeDeps(fileOverride?: Partial<UploadedFileRecord>, provider?: DocumentUnderstandingProvider) {
  const file = makeFile(fileOverride);
  const stored: Record<string, Partial<UploadedFileRecord>> = {};

  const getUploadedFile = vi.fn(async (_userId: string, _fileId: string) => {
    const merged = { ...file, ...stored };
    return merged as UploadedFileRecord;
  });

  const updateUploadedFile = vi.fn(async (_userId: string, _fileId: string, updates: Partial<UploadedFileRecord>) => {
    Object.assign(stored, updates);
    return { ...file, ...stored } as UploadedFileRecord;
  });

  const replaceDocumentPages = vi.fn(async () => []);
  const saveDocumentOutline = vi.fn(async () => ({} as never));
  const replaceDetectedQuestions = vi.fn(async () => []);

  return {
    getUploadedFile,
    updateUploadedFile,
    replaceDocumentPages,
    saveDocumentOutline,
    replaceDetectedQuestions,
    textOnlyProvider: provider ?? makeSuccessProvider(),
  };
}

// ---------------------------------------------------------------------------
// Lifecycle tests
// ---------------------------------------------------------------------------

describe("DocumentUnderstandingOrchestrationService", () => {
  it("transitions pending → completed on success", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pendingCall = deps.updateUploadedFile.mock.calls.find(
      ([, , updates]) => updates.understandingStatus === "pending"
    );
    const completedCall = deps.updateUploadedFile.mock.calls.find(
      ([, , updates]) => updates.understandingStatus === "completed"
    );

    expect(pendingCall).toBeDefined();
    expect(completedCall).toBeDefined();
  });

  it("transitions pending → failed when provider throws", async () => {
    const deps = makeDeps(undefined, makeFailingProvider());
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider_error");

    const failedCall = deps.updateUploadedFile.mock.calls.find(
      ([, , updates]) => updates.understandingStatus === "failed"
    );
    expect(failedCall).toBeDefined();
    expect(failedCall?.[2].understandingErrorCode).toBe("understanding_lifecycle_failed");
  });

  it("returns file_not_found when file does not exist", async () => {
    const deps = makeDeps();
    deps.getUploadedFile.mockResolvedValue(null as never);
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "missing-file");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("file_not_found");
  });

  it("returns invalid_transition when understandingStatus is pending", async () => {
    const deps = makeDeps({ understandingStatus: "pending" });
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_transition");
  });

  it("returns invalid_transition when understandingStatus is completed", async () => {
    const deps = makeDeps({ understandingStatus: "completed" });
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_transition");
  });

  it("updates uploaded file metadata after success", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    await service.runTextOnlyUnderstanding("alice", "file-1");

    const completedCall = deps.updateUploadedFile.mock.calls.find(
      ([, , updates]) => updates.understandingStatus === "completed"
    );

    expect(completedCall).toBeDefined();
    const updates = completedCall?.[2];
    expect(updates?.detectedQuestionCount).toBe(2);
    expect(updates?.extractionQuality).toBe("good");
    expect(updates?.pageCount).toBe(1);
    expect(updates?.understandingUpdatedAt).toBeInstanceOf(Date);
  });

  it("persists pages via documentArtifactRepository", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(deps.replaceDocumentPages).toHaveBeenCalledOnce();
    const pagesCall = deps.replaceDocumentPages.mock.calls[0] as unknown as [string, string, unknown[]];
    const [pagesUserId, pagesFileId, pages] = pagesCall;
    expect(pagesUserId).toBe("alice");
    expect(pagesFileId).toBe("file-1");
    expect(pages.length).toBeGreaterThan(0);
  });

  it("persists outline via documentArtifactRepository", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(deps.saveDocumentOutline).toHaveBeenCalledOnce();
    const outlineCall = deps.saveDocumentOutline.mock.calls[0] as unknown as [string, string, { outlineId: string }];
    const [outlineUserId, outlineFileId, outline] = outlineCall;
    expect(outlineUserId).toBe("alice");
    expect(outlineFileId).toBe("file-1");
    expect(outline.outlineId).toBe("v1");
  });

  it("persists detectedQuestions via documentArtifactRepository", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(deps.replaceDetectedQuestions).toHaveBeenCalledOnce();
    const questionsCall = deps.replaceDetectedQuestions.mock.calls[0] as unknown as [string, string, unknown[]];
    const [questionsUserId, questionsFileId, questions] = questionsCall;
    expect(questionsUserId).toBe("alice");
    expect(questionsFileId).toBe("file-1");
    expect(questions.length).toBe(2);
  });

  it("old files with understandingStatus not_started can run", async () => {
    const deps = makeDeps({ understandingStatus: "not_started" });
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(result.ok).toBe(true);
  });

  it("failed status files can re-run", async () => {
    const deps = makeDeps({ understandingStatus: "failed" });
    const service = createDocumentUnderstandingOrchestrationService(deps);
    const result = await service.runTextOnlyUnderstanding("alice", "file-1");

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regression: existing file inventory behavior unaffected
// ---------------------------------------------------------------------------

describe("DocumentUnderstandingOrchestrationService regression", () => {
  it("does not call getWorkspace or touch file extraction/chunking", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    await service.runTextOnlyUnderstanding("alice", "file-1");

    // Only updateUploadedFile is called, not createUploadedFile or chunking operations
    expect(deps.replaceDocumentPages).toHaveBeenCalled();
    // No extraction or chunking side effects
    expect(deps.updateUploadedFile.mock.calls.every(([, , u]) =>
      !("extractionStatus" in u) && !("chunkingStatus" in u)
    )).toBe(true);
  });

  it("does not change extractionStatus or chunkingStatus on the file", async () => {
    const deps = makeDeps();
    const service = createDocumentUnderstandingOrchestrationService(deps);
    await service.runTextOnlyUnderstanding("alice", "file-1");

    for (const [, , updates] of deps.updateUploadedFile.mock.calls) {
      expect(updates).not.toHaveProperty("extractionStatus");
      expect(updates).not.toHaveProperty("chunkingStatus");
    }
  });
});
