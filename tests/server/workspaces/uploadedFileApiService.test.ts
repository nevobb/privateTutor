import { describe, expect, it, vi } from "vitest";
import { createUploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import type { UploadedFileRecord, WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";
import type { DocumentUnderstandingOrchestrationService } from "../../../src/server/workspaces/documentUnderstandingOrchestrationService";
import type { DocumentQualityGateOutput } from "../../../src/server/workspaces/documentQualityGate";

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
    understandingStatus: "not_started",
    understandingErrorCode: null,
    understandingUpdatedAt: null,
    pageCount: undefined,
    outlineTitle: undefined,
    detectedQuestionCount: undefined,
    extractionQuality: undefined,
    extractionErrorCode: null,
    extractionUpdatedAt: null,
    chunkingStatus: "not_started",
    chunkingErrorCode: null,
    chunkingUpdatedAt: null,
    deepPdfStatus: "not_started",
    deepPdfUpdatedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeRepositories() {
  const defaultRunTextOnlyUnderstanding: DocumentUnderstandingOrchestrationService["runTextOnlyUnderstanding"] =
    async (_userId: string, _fileId: string) => ({
      ok: true as const,
      file: createRecord({
        extractionStatus: "completed",
        extractedText: "שאלה 1\n\nתוכן ראשון\n\nשאלה 2\n\nתוכן שני",
        extractedTextCharCount: 37,
        chunkingStatus: "completed",
        chunkCount: 2,
        understandingStatus: "completed",
        understandingErrorCode: null,
        understandingUpdatedAt: baseDate,
        pageCount: 1,
        outlineTitle: "שאלה 1",
        detectedQuestionCount: 2,
        extractionQuality: "good",
        deepPdfStatus: "not_started",
      }),
      output: {
        providerName: "pdf_parse_outline",
        providerMode: "text_only" as const,
        pageCount: 1,
        pages: [],
        outline: {
          outlineId: "v1",
          fileId: "file-1",
          sections: [],
          confidence: "high" as const,
        },
        detectedQuestions: [],
        qualitySignals: {
          hasExtractedText: true,
          extractedTextCharCount: 37,
          likelyHasMath: false,
          likelyHasVisualContent: false,
          textQuality: "good" as const,
        },
        extractionQuality: "good" as const,
        confidence: "high" as const,
        warnings: [],
        errors: [],
      },
    });

  const documentUnderstandingOrchestrationService: DocumentUnderstandingOrchestrationService = {
    runTextOnlyUnderstanding: vi.fn(defaultRunTextOnlyUnderstanding),
  };

  const defaultQualityGateResult: DocumentQualityGateOutput = {
    decision: "use_text_only",
    recommendedProviderMode: "text_only",
    reasons: ["clean_text"],
    confidence: "high",
    extractionQuality: "good",
    shouldRunAutomatically: false,
    shouldShowUserNoticeLater: false,
    safeFallbackProviderMode: "text_only",
  };

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

    if (updates.understandingStatus === "pending") {
      return createRecord({
        understandingStatus: "pending",
        understandingErrorCode: null,
        understandingUpdatedAt: updates.understandingUpdatedAt ?? baseDate,
      });
    }
    if (updates.understandingStatus === "completed") {
      return createRecord({
        understandingStatus: "completed",
        understandingErrorCode: null,
        understandingUpdatedAt: updates.understandingUpdatedAt ?? baseDate,
        pageCount: updates.pageCount,
        outlineTitle: updates.outlineTitle,
        detectedQuestionCount: updates.detectedQuestionCount,
        extractionQuality: updates.extractionQuality,
      });
    }
    if (updates.understandingStatus === "failed") {
      return createRecord({
        understandingStatus: "failed",
        understandingErrorCode: updates.understandingErrorCode ?? "understanding_lifecycle_failed",
        understandingUpdatedAt: updates.understandingUpdatedAt ?? baseDate,
      });
    }

    if (updates.deepPdfStatus) {
      return createRecord({
        deepPdfStatus: updates.deepPdfStatus,
        deepPdfUpdatedAt: updates.deepPdfUpdatedAt ?? baseDate,
      });
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
    documentUnderstandingOrchestrationService,
    evaluateDocumentQualityGate: vi.fn(() => defaultQualityGateResult),
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
        understandingStatus: "not_started",
        understandingErrorCode: null,
        understandingUpdatedAt: null,
        deepPdfStatus: "not_started",
        deepPdfUpdatedAt: null,
      })
    );
    expect(result).toMatchObject({
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
      understandingErrorCode: null,
      deepPdfUpdatedAt: null,
    });
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

  it("rejects extraction when status is already completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        storagePath: "users/alice/workspaces/ws-1/files/file-1/Mechanics Intro.pdf",
        extractionStatus: "completed",
        extractedText: "Some extracted text.",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runExtractionLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "invalid_transition" });
  });

  it("rejects extraction when status is pending", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        storagePath: "users/alice/workspaces/ws-1/files/file-1/Mechanics Intro.pdf",
        extractionStatus: "pending",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runExtractionLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "invalid_transition" });
  });

  it("allows retry when status is failed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        storagePath: "users/alice/workspaces/ws-1/files/file-1/Mechanics Intro.pdf",
        extractionStatus: "failed",
        extractionErrorCode: "extraction_lifecycle_failed",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runExtractionLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
  });

  it("rejects when file has no storagePath", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        storagePath: undefined,
        extractionStatus: "not_started",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runExtractionLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "missing_storage_path" });
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
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).toHaveBeenCalledWith(
      "alice",
      "file-1"
    );
  });

  it("rejects when extraction not completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ extractionStatus: "pending", extractedText: "x" }));
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "extraction_not_completed" });
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("rejects missing extracted text", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ extractionStatus: "completed", extractedText: "" }));
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "missing_extracted_text" });
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
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
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("blocks chunking when chunkingStatus is pending", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        extractionStatus: "completed",
        extractedText: "Some text.",
        chunkingStatus: "pending",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "invalid_transition" });
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("allows re-chunking when chunkingStatus is completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        extractionStatus: "completed",
        extractedText: "Paragraph one. ".repeat(200),
        chunkingStatus: "completed",
        chunkCount: 3,
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.chunkingStatus).toBe("completed");
      expect(result.chunkCount).toBeGreaterThan(0);
    }
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).toHaveBeenCalledOnce();
  });

  it("blocks chunking when extraction is not_started", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({ extractionStatus: "not_started", extractedText: undefined })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "extraction_not_completed" });
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("persists text-only understanding metadata after successful chunking", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        extractionStatus: "completed",
        extractedText: "שאלה 1\n\nתוכן ראשון\n\nשאלה 2\n\nתוכן שני",
        extractedTextCharCount: 37,
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.understandingStatus).toBe("completed");
    expect(result.file.pageCount).toBe(1);
    expect(result.file.outlineTitle).toBe("שאלה 1");
    expect(result.file.detectedQuestionCount).toBe(2);
    expect(result.file.extractionQuality).toBe("good");
  });

  it("marks understanding failed without failing chunking when text-only understanding fails", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi
      .fn()
      .mockResolvedValueOnce(
        createRecord({
          sourceType: "pdf",
          extractionStatus: "completed",
          extractedText: "Paragraph one. ".repeat(150),
        })
      )
      .mockResolvedValueOnce(
        createRecord({
          sourceType: "pdf",
          extractionStatus: "completed",
          extractedText: "Paragraph one. ".repeat(150),
          chunkingStatus: "completed",
          chunkCount: 2,
          understandingStatus: "failed",
          understandingErrorCode: "understanding_lifecycle_failed",
          understandingUpdatedAt: baseDate,
        })
      );
    repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding = vi.fn(
      async (_userId: string, _fileId: string) => ({
        ok: false as const,
        code: "provider_error" as const,
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.chunkingStatus).toBe("completed");
    expect(result.file.understandingStatus).toBe("failed");
    expect(repos.evaluateDocumentQualityGate).not.toHaveBeenCalled();
  });

  it("does not run text-only understanding for unsupported sourceType", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "note",
        extractionStatus: "completed",
        extractedText: "Paragraph one. ".repeat(120),
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("does not run text-only understanding when understandingStatus is pending", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        extractionStatus: "completed",
        extractedText: "Paragraph one. ".repeat(120),
        understandingStatus: "pending",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("does not run text-only understanding when understandingStatus is completed", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        extractionStatus: "completed",
        extractedText: "Paragraph one. ".repeat(120),
        understandingStatus: "completed",
      })
    );
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).not.toHaveBeenCalled();
  });

  it("marks deepPdfStatus recommended from quality gate metadata only", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        extractionStatus: "completed",
        extractedText: "שאלה 1\n\nחשב את האינטגרל ∫f(x)dx",
        extractedTextCharCount: 28,
      })
    );
    repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding = vi.fn(
      async (_userId: string, _fileId: string) => ({
        ok: true as const,
        file: createRecord({
          sourceType: "pdf",
          extractionStatus: "completed",
          extractedText: "שאלה 1\n\nחשב את האינטגרל ∫f(x)dx",
          extractedTextCharCount: 28,
          chunkingStatus: "completed",
          chunkCount: 1,
          understandingStatus: "completed",
          understandingUpdatedAt: baseDate,
          pageCount: 1,
          outlineTitle: "שאלה 1",
          detectedQuestionCount: 1,
          extractionQuality: "partial",
          deepPdfStatus: "not_started",
        }),
        output: {
          providerName: "pdf_parse_outline",
          providerMode: "text_only" as const,
          pageCount: 1,
          pages: [],
          outline: null,
          detectedQuestions: [],
          qualitySignals: {
            hasExtractedText: true,
            extractedTextCharCount: 28,
            likelyHasMath: true,
            likelyHasVisualContent: false,
            textQuality: "partial" as const,
          },
          extractionQuality: "partial" as const,
          confidence: "medium" as const,
          warnings: [],
          errors: [],
        },
      })
    );
    vi.mocked(repos.evaluateDocumentQualityGate).mockReturnValue({
      decision: "recommend_advanced_understanding",
      recommendedProviderMode: "deep_pdf",
      reasons: ["math_heavy"],
      confidence: "high",
      extractionQuality: "partial",
      shouldRunAutomatically: false,
      shouldShowUserNoticeLater: true,
      safeFallbackProviderMode: "text_only",
    });
    const service = createUploadedFileApiService(repos as never);

    const result = await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    expect(repos.evaluateDocumentQualityGate).toHaveBeenCalledOnce();
    expect(result.ok && result.file.deepPdfStatus).toBe("recommended");
  });

  it("does not call Gemini provider from chunking runtime path", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () =>
      createRecord({
        sourceType: "pdf",
        extractionStatus: "completed",
        extractedText: "Paragraph one. ".repeat(120),
      })
    );
    const service = createUploadedFileApiService(repos as never);

    await service.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(repos.documentUnderstandingOrchestrationService.runTextOnlyUnderstanding).toHaveBeenCalledOnce();
    expect(repos.evaluateDocumentQualityGate).toHaveBeenCalledOnce();
  });
});
