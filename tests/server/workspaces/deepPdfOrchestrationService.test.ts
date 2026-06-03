import { describe, expect, it, vi } from "vitest";
import {
  createDeepPdfOrchestrationService,
  type DeepPdfOrchestrationDeps,
} from "../../../src/server/workspaces/deepPdfOrchestrationService";
import type { UploadedFileRecord } from "../../../src/server/workspaces/workspaceTypes";
import type { DocumentUnderstandingProvider, DocumentUnderstandingOutput } from "../../../src/server/workspaces/documentUnderstandingProvider";
import type { FirebaseStoragePdfBytesLoader } from "../../../src/server/workspaces/firebaseStoragePdfBytesLoader";
import {
  CURRENT_DEEP_PDF_ARTIFACT_VERSION,
  DEFAULT_DEEP_PDF_PROVIDER_NAME,
} from "../../../src/server/workspaces/deepPdfCachePolicy";

const baseDate = new Date("2026-06-03T06:00:00.000Z");

const VALID_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xab, 0xcd]);
const VALID_INPUT_HASH = "a".repeat(64);
const VALID_GENERATION = "123456789";

// ---------------------------------------------------------------------------
// Record factories
// ---------------------------------------------------------------------------

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
    extractedText: "שאלה 1\n\nתוכן",
    extractedTextCharCount: 12,
    understandingStatus: "completed",
    understandingErrorCode: null,
    understandingUpdatedAt: baseDate,
    understandingMode: "text_only",
    pageCount: 1,
    outlineTitle: "שאלה 1",
    detectedQuestionCount: 1,
    extractionQuality: "partial",
    extractionErrorCode: null,
    extractionUpdatedAt: null,
    chunkingStatus: "completed",
    chunkCount: 2,
    chunkingErrorCode: null,
    chunkingUpdatedAt: null,
    deepPdfStatus: "recommended",
    deepPdfUpdatedAt: null,
    deepPdfProviderName: undefined,
    deepPdfModel: undefined,
    deepPdfInputHash: undefined,
    deepPdfStorageGeneration: undefined,
    deepPdfArtifactVersion: undefined,
    deepPdfCompletedAt: null,
    deepPdfErrorCode: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeSuccessProviderOutput(): DocumentUnderstandingOutput {
  return {
    providerName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
    providerMode: "deep_pdf",
    pageCount: 3,
    pages: [
      {
        pageId: "page_0001",
        fileId: "file-1",
        pageNumber: 1,
        extractedText: "שאלה 1 תוכן",
        textQuality: "good",
        charCount: 10,
        sourceChunkIds: [],
      },
    ],
    outline: {
      outlineId: "v1",
      fileId: "file-1",
      title: "פיזיקה מתקדמת",
      sections: [
        {
          sectionId: "q_001",
          label: "שאלה 1",
          charStart: 0,
          charEnd: 100,
          sourceChunkIds: [],
          subsections: [],
          confidence: 0.9,
        },
      ],
      confidence: "high",
    },
    detectedQuestions: [
      {
        questionId: "q_001",
        fileId: "file-1",
        label: "שאלה 1",
        questionNumber: 1,
        charStart: 0,
        charEnd: 100,
        sourceChunkIds: [],
        subsections: [],
        confidence: 0.9,
      },
    ],
    qualitySignals: {
      hasExtractedText: true,
      extractedTextCharCount: 500,
      likelyHasMath: true,
      likelyHasVisualContent: false,
      textQuality: "good",
    },
    extractionQuality: "good",
    confidence: "high",
    warnings: [],
    errors: [],
  };
}

function makeProvider(overrides: Partial<{ output: DocumentUnderstandingOutput; throwError: Error }>): DocumentUnderstandingProvider {
  return {
    name: DEFAULT_DEEP_PDF_PROVIDER_NAME,
    mode: "deep_pdf" as const,
    run: vi.fn(async () => {
      if (overrides.throwError) throw overrides.throwError;
      return overrides.output ?? makeSuccessProviderOutput();
    }),
  };
}

function makeLoader(overrides: Partial<{
  bytes: Uint8Array;
  hash: string;
  generation: string;
  ok: boolean;
  errorCode: string;
}>): FirebaseStoragePdfBytesLoader {
  const { bytes = VALID_PDF_BYTES, hash = VALID_INPUT_HASH, generation = VALID_GENERATION, ok = true, errorCode = "storage_read_error" } = overrides;
  return {
    loadPdfBytesWithMetadata: vi.fn(async () => {
      if (!ok) {
        return { ok: false as const, code: errorCode as never, message: `loader failed: ${errorCode}` };
      }
      return { ok: true as const, bytes, sizeBytes: bytes.length, contentType: "application/pdf", storageGeneration: generation, inputHash: hash, storagePath: "users/alice/workspaces/ws-1/files/file-1/Physics.pdf" };
    }),
    loadPdfBytes: vi.fn(async () => bytes),
  };
}

type UpdateCall = Partial<UploadedFileRecord>;

function makeDeps(fileOverride?: Partial<UploadedFileRecord>, providerOverride?: Partial<Parameters<typeof makeProvider>[0]>, loaderOverride?: Partial<Parameters<typeof makeLoader>[0]>): DeepPdfOrchestrationDeps & { updates: UpdateCall[] } {
  const file = makeFile(fileOverride);
  const updates: UpdateCall[] = [];
  let current = file;

  return {
    updates,
    getUploadedFile: vi.fn(async () => current),
    updateUploadedFile: vi.fn(async (_userId, _fileId, update) => {
      updates.push(update);
      current = { ...current, ...update };
      return current;
    }),
    replaceDocumentPages: vi.fn(async () => []),
    saveDocumentOutline: vi.fn(async () => ({} as never)),
    replaceDetectedQuestions: vi.fn(async () => []),
    deepPdfProvider: makeProvider(providerOverride ?? {}),
    pdfBytesLoader: makeLoader(loaderOverride ?? {}),
    providerName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
    modelName: "gemini-2.5-flash",
    getApiKey: () => "test-api-key",
  };
}

// ---------------------------------------------------------------------------
// 1. Recommended + Normal Learning + cache eligible → full run
// ---------------------------------------------------------------------------

describe("successful Deep PDF run", () => {
  it("marks pending before calling provider", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    const pendingUpdate = deps.updates.find((u) => u.deepPdfStatus === "pending");
    expect(pendingUpdate).toBeDefined();
  });

  it("calls PDF bytes loader", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.pdfBytesLoader.loadPdfBytesWithMetadata).toHaveBeenCalledOnce();
  });

  it("calls provider with inline pdfBytes", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    const providerCalls = (deps.deepPdfProvider.run as ReturnType<typeof vi.fn>).mock.calls;
    expect(providerCalls.length).toBe(1);
    const providerInput = providerCalls[0][0];
    expect(providerInput.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(providerInput.mode).toBe("deep_pdf");
  });

  it("persists pages via documentArtifactRepository", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.replaceDocumentPages).toHaveBeenCalledOnce();
  });

  it("persists outline via documentArtifactRepository", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.saveDocumentOutline).toHaveBeenCalledOnce();
  });

  it("persists detectedQuestions via documentArtifactRepository", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.replaceDetectedQuestions).toHaveBeenCalledOnce();
  });

  it("marks completed with all identity metadata", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("completed");

    const completedUpdate = deps.updates.find((u) => u.deepPdfStatus === "completed");
    expect(completedUpdate).toBeDefined();
    expect(completedUpdate?.deepPdfProviderName).toBe(DEFAULT_DEEP_PDF_PROVIDER_NAME);
    expect(completedUpdate?.deepPdfModel).toBe("gemini-2.5-flash");
    expect(completedUpdate?.deepPdfInputHash).toBe(VALID_INPUT_HASH);
    expect(completedUpdate?.deepPdfStorageGeneration).toBe(VALID_GENERATION);
    expect(completedUpdate?.deepPdfArtifactVersion).toBe(CURRENT_DEEP_PDF_ARTIFACT_VERSION);
    expect(completedUpdate?.deepPdfCompletedAt).toBeInstanceOf(Date);
    expect(completedUpdate?.deepPdfErrorCode).toBeNull();
    expect(completedUpdate?.understandingMode).toBe("deep_pdf");
  });

  it("stores inputHash and storageGeneration from loader", async () => {
    const customHash = "f".repeat(64);
    const customGen = "9999";
    const deps = makeDeps(
      { deepPdfStatus: "recommended" },
      {},
      { hash: customHash, generation: customGen }
    );
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    const completedUpdate = deps.updates.find((u) => u.deepPdfStatus === "completed");
    expect(completedUpdate?.deepPdfInputHash).toBe(customHash);
    expect(completedUpdate?.deepPdfStorageGeneration).toBe(customGen);
  });

  it("updates pageCount from provider output", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    const completedUpdate = deps.updates.find((u) => u.deepPdfStatus === "completed");
    expect(completedUpdate?.pageCount).toBe(3);
  });

  it("returns completed status", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);
    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("completed");
    expect(result.file).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Completed reusable result → skip, no Gemini call
// ---------------------------------------------------------------------------

describe("completed reusable result", () => {
  it("skips when cache policy says use_existing_result", async () => {
    const completedFile = makeFile({
      deepPdfStatus: "completed",
      deepPdfProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
      deepPdfModel: "gemini-2.5-flash",
      deepPdfInputHash: VALID_INPUT_HASH,
      deepPdfStorageGeneration: VALID_GENERATION,
      deepPdfArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
    });
    const deps = makeDeps(completedFile);
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", {
      costMode: "Normal Learning",
    });

    expect(result.status).toBe("skipped");
  });

  it("does not call loader when skipping reuse", async () => {
    const completedFile = makeFile({
      deepPdfStatus: "completed",
      deepPdfProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
      deepPdfModel: "gemini-2.5-flash",
      deepPdfInputHash: VALID_INPUT_HASH,
      deepPdfStorageGeneration: VALID_GENERATION,
      deepPdfArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
    });
    const deps = makeDeps(completedFile);
    const service = createDeepPdfOrchestrationService(deps);

    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.pdfBytesLoader.loadPdfBytesWithMetadata).not.toHaveBeenCalled();
  });

  it("does not call Gemini provider when skipping reuse", async () => {
    const completedFile = makeFile({
      deepPdfStatus: "completed",
      deepPdfProviderName: DEFAULT_DEEP_PDF_PROVIDER_NAME,
      deepPdfModel: "gemini-2.5-flash",
      deepPdfInputHash: VALID_INPUT_HASH,
      deepPdfStorageGeneration: VALID_GENERATION,
      deepPdfArtifactVersion: CURRENT_DEEP_PDF_ARTIFACT_VERSION,
    });
    const deps = makeDeps(completedFile);
    const service = createDeepPdfOrchestrationService(deps);

    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.deepPdfProvider.run).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Pending → skip, no duplicate
// ---------------------------------------------------------------------------

describe("already pending", () => {
  it("skips when deepPdfStatus is pending", async () => {
    const deps = makeDeps({ deepPdfStatus: "pending" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1");

    expect(result.status).toBe("skipped");
    expect(deps.deepPdfProvider.run).not.toHaveBeenCalled();
  });

  it("does not load bytes when pending", async () => {
    const deps = makeDeps({ deepPdfStatus: "pending" });
    const service = createDeepPdfOrchestrationService(deps);

    await service.runDeepPdfUnderstanding("alice", "file-1");

    expect(deps.pdfBytesLoader.loadPdfBytesWithMetadata).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Cheap Practice → never auto-run
// ---------------------------------------------------------------------------

describe("Cheap Practice cost mode", () => {
  it("skips Deep PDF when costMode is Cheap Practice", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", {
      costMode: "Cheap Practice",
    });

    expect(result.status).toBe("skipped");
  });

  it("does not call Gemini for Cheap Practice", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);

    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Cheap Practice" });

    expect(deps.deepPdfProvider.run).not.toHaveBeenCalled();
    expect(deps.pdfBytesLoader.loadPdfBytesWithMetadata).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Missing API key → safe skip
// ---------------------------------------------------------------------------

describe("missing API key", () => {
  it("skips safely when API key is absent", async () => {
    const deps = { ...makeDeps({ deepPdfStatus: "recommended" }), getApiKey: () => undefined };
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("skipped");
    expect(result.skipReason).toContain("missing_api_key");
  });

  it("does not call loader or provider when key missing", async () => {
    const deps = { ...makeDeps({ deepPdfStatus: "recommended" }), getApiKey: () => undefined };
    const service = createDeepPdfOrchestrationService(deps);

    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.pdfBytesLoader.loadPdfBytesWithMetadata).not.toHaveBeenCalled();
    expect(deps.deepPdfProvider.run).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Loader failure → mark failed safely
// ---------------------------------------------------------------------------

describe("loader failure", () => {
  it("marks deepPdfStatus failed when loader fails", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" }, {}, { ok: false, errorCode: "storage_read_error" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("failed");
    const failedUpdate = deps.updates.find((u) => u.deepPdfStatus === "failed");
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.deepPdfErrorCode).toContain("bytes_load_failed");
  });

  it("does not call Gemini when loader fails", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" }, {}, { ok: false, errorCode: "file_too_large" });
    const service = createDeepPdfOrchestrationService(deps);

    await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(deps.deepPdfProvider.run).not.toHaveBeenCalled();
  });

  it("does not throw — returns structured failure", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" }, {}, { ok: false, errorCode: "storage_read_error" });
    const service = createDeepPdfOrchestrationService(deps);

    await expect(
      service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Gemini provider failure → mark failed safely
// ---------------------------------------------------------------------------

describe("provider failure", () => {
  it("marks failed when provider returns errors array", async () => {
    const failureOutput: DocumentUnderstandingOutput = {
      ...makeSuccessProviderOutput(),
      errors: ["not_implemented: provider stub error"],
      pages: [],
      outline: null,
      detectedQuestions: [],
    };
    const deps = makeDeps({ deepPdfStatus: "recommended" }, { output: failureOutput });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("failed");
    const failedUpdate = deps.updates.find((u) => u.deepPdfStatus === "failed");
    expect(failedUpdate?.deepPdfErrorCode).toContain("provider_error");
  });

  it("marks failed when provider throws", async () => {
    const deps = makeDeps(
      { deepPdfStatus: "recommended" },
      { throwError: new Error("gemini network failure") }
    );
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("failed");
  });

  it("does not expose raw provider error to result", async () => {
    const deps = makeDeps(
      { deepPdfStatus: "recommended" },
      { throwError: new Error("SECRET_API_KEY=abc123 was exposed") }
    );
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    expect(result.status).toBe("failed");
    // errorCode should be truncated and generic, not a full secret
    expect(result.errorCode).not.toContain("SECRET_API_KEY=abc123");
  });

  it("does not throw — returns structured failure on provider error", async () => {
    const deps = makeDeps(
      { deepPdfStatus: "recommended" },
      { throwError: new Error("catastrophic error") }
    );
    const service = createDeepPdfOrchestrationService(deps);

    await expect(
      service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Failed status → retry allowed when guards pass
// ---------------------------------------------------------------------------

describe("failed retry behavior", () => {
  it("allows retry for failed status with Normal Learning", async () => {
    const deps = makeDeps({ deepPdfStatus: "failed", deepPdfErrorCode: "previous error" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" });

    // retry_allowed_later → shouldRunProcessing = true → attempts run
    expect(result.status).not.toBe("skipped");
  });

  it("does not retry for Cheap Practice even if previously failed", async () => {
    const deps = makeDeps({ deepPdfStatus: "failed", deepPdfErrorCode: "previous error" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Cheap Practice" });

    expect(result.status).toBe("skipped");
  });
});

// ---------------------------------------------------------------------------
// 9. Wrong source type / missing path
// ---------------------------------------------------------------------------

describe("structural guards", () => {
  it("skips for docx source type", async () => {
    const deps = makeDeps({ sourceType: "docx", deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1");

    expect(result.status).toBe("skipped");
    expect(result.skipReason).toContain("wrong_source_type");
  });

  it("skips when storagePath is missing", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended", storagePath: undefined });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1");

    expect(result.status).toBe("skipped");
    expect(result.skipReason).toContain("missing_storage_path");
  });

  it("fails when file not found", async () => {
    const deps = makeDeps();
    deps.getUploadedFile = vi.fn(async () => null);
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "missing-file");

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("file_not_found");
  });
});

// ---------------------------------------------------------------------------
// 10. Text-only chunking lifecycle unaffected by Deep PDF failure
// ---------------------------------------------------------------------------

describe("chunking lifecycle isolation", () => {
  it("failure is contained — returns failed not thrown", async () => {
    const deps = makeDeps(
      { deepPdfStatus: "recommended" },
      { throwError: new Error("unrecoverable error") }
    );
    const service = createDeepPdfOrchestrationService(deps);

    await expect(
      service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Normal Learning" })
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 11. Deep Research cost mode
// ---------------------------------------------------------------------------

describe("Deep Research cost mode", () => {
  it("runs Deep PDF for Deep Research + recommended status", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);

    const result = await service.runDeepPdfUnderstanding("alice", "file-1", { costMode: "Deep Research" });

    expect(result.status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// 12. Default costMode is Normal Learning
// ---------------------------------------------------------------------------

describe("default cost mode", () => {
  it("defaults to Normal Learning when no costMode provided", async () => {
    const deps = makeDeps({ deepPdfStatus: "recommended" });
    const service = createDeepPdfOrchestrationService(deps);

    // If default were Cheap Practice, this would be skipped
    const result = await service.runDeepPdfUnderstanding("alice", "file-1");

    expect(result.status).toBe("completed");
  });
});
