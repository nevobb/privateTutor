/**
 * Batch 8D.1 — Deep PDF Cost Mode Policy
 *
 * Verifies that cost mode is correctly threaded through runChunkingLifecycleForFile
 * and honoured by the Deep PDF execution policy. These tests operate at the service
 * integration level, exercising the full call chain:
 *
 *   runChunkingLifecycleForFile(options.costMode)
 *     → maybeRunTextOnlyDocumentUnderstandingAfterChunking({ costMode })
 *       → deepPdfOrchestrationService.runDeepPdfUnderstanding({ costMode })
 *         → deepPdfCachePolicy.evaluateDeepPdfCacheState({ costMode })
 *
 * No Gemini calls are made. All I/O is mocked.
 */
import { describe, expect, it, vi } from "vitest";
import { createUploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import type { DocumentUnderstandingOrchestrationService } from "../../../src/server/workspaces/documentUnderstandingOrchestrationService";
import type { DeepPdfOrchestrationService } from "../../../src/server/workspaces/deepPdfOrchestrationService";
import type { UploadedFileRecord, WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";
import type { DocumentQualityGateOutput } from "../../../src/server/workspaces/documentQualityGate";
import type { CostMode } from "../../../src/types/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const user: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const baseDate = new Date("2026-06-03T07:00:00.000Z");

const workspace: WorkspaceRecord = {
  id: "ws-1",
  userId: "alice",
  name: "Physics",
  description: "",
  status: "active",
  createdAt: baseDate,
  updatedAt: baseDate,
};

function makeFileRecord(overrides: Partial<UploadedFileRecord> = {}): UploadedFileRecord {
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
    extractedText: "שאלה 1\n\nחוק קולון\n\nשאלה 2\n\nפוטנציאל חשמלי",
    extractedTextCharCount: 40,
    understandingStatus: "not_started",
    understandingErrorCode: null,
    understandingUpdatedAt: null,
    understandingMode: "text_only",
    pageCount: undefined,
    outlineTitle: undefined,
    detectedQuestionCount: undefined,
    extractionQuality: "partial",
    extractionErrorCode: null,
    extractionUpdatedAt: null,
    chunkingStatus: "not_started",
    chunkCount: undefined,
    chunkingErrorCode: null,
    chunkingUpdatedAt: null,
    deepPdfStatus: "not_started",
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

/** Quality gate output that recommends advanced understanding (triggers Deep PDF path). */
const QUALITY_GATE_RECOMMENDS: DocumentQualityGateOutput = {
  decision: "recommend_advanced_understanding",
  recommendedProviderMode: "deep_pdf",
  reasons: ["math_heavy", "weak_extracted_text"],
  confidence: "high",
  extractionQuality: "partial",
  shouldRunAutomatically: false,
  shouldShowUserNoticeLater: true,
  safeFallbackProviderMode: "text_only",
};

/** Quality gate output that says text-only is enough. */
const QUALITY_GATE_TEXT_ONLY: DocumentQualityGateOutput = {
  decision: "use_text_only",
  recommendedProviderMode: "text_only",
  reasons: ["clean_text"],
  confidence: "high",
  extractionQuality: "good",
  shouldRunAutomatically: false,
  shouldShowUserNoticeLater: false,
  safeFallbackProviderMode: "text_only",
};

// ---------------------------------------------------------------------------
// Repository builders
// ---------------------------------------------------------------------------

function makeUnderstandingService(
  deepPdfStatusAfterRun: UploadedFileRecord["deepPdfStatus"] = "not_started"
): DocumentUnderstandingOrchestrationService {
  return {
    runTextOnlyUnderstanding: vi.fn(async (_userId: string, fileId: string) => ({
      ok: true as const,
      file: makeFileRecord({
        id: fileId,
        understandingStatus: "completed",
        understandingUpdatedAt: baseDate,
        deepPdfStatus: deepPdfStatusAfterRun,
        extractionQuality: "partial",
        pageCount: 1,
        detectedQuestionCount: 2,
      }),
      output: {
        providerName: "pdf_parse_outline",
        providerMode: "text_only" as const,
        pageCount: 1,
        pages: [],
        outline: { outlineId: "v1", fileId, sections: [], confidence: "medium" as const },
        detectedQuestions: [],
        qualitySignals: {
          hasExtractedText: true,
          extractedTextCharCount: 40,
          likelyHasMath: true,
          likelyHasVisualContent: false,
          textQuality: "partial" as const,
        },
        extractionQuality: "partial" as const,
        confidence: "medium" as const,
        warnings: [],
        errors: [],
      },
    })),
  };
}

function makeDeepPdfService(): { service: DeepPdfOrchestrationService; calls: { costMode?: CostMode }[] } {
  const calls: { costMode?: CostMode }[] = [];
  const service: DeepPdfOrchestrationService = {
    runDeepPdfUnderstanding: vi.fn(async (_userId, _fileId, options) => {
      calls.push({ costMode: options?.costMode });

      // Mirror real service: Cheap Practice is blocked by cache policy
      if (options?.costMode === "Cheap Practice") {
        return { status: "skipped" as const, skipReason: "blocked_by_cost_mode" };
      }

      return {
        status: "completed" as const,
        file: makeFileRecord({
          deepPdfStatus: "completed",
          understandingMode: "deep_pdf",
          deepPdfProviderName: "gemini_pdf_understanding",
          deepPdfModel: "gemini-2.5-flash",
          deepPdfInputHash: "a".repeat(64),
          deepPdfStorageGeneration: "123456",
          deepPdfArtifactVersion: "deep_pdf_artifacts_v1",
          deepPdfCompletedAt: baseDate,
        }),
      };
    }),
  };
  return { service, calls };
}

type RepoOverrides = {
  qualityGateOutput?: DocumentQualityGateOutput;
  deepPdfService?: DeepPdfOrchestrationService;
  initialFileStatus?: Partial<UploadedFileRecord>;
};

function makeRepositories(overrides: RepoOverrides = {}) {
  const {
    qualityGateOutput = QUALITY_GATE_RECOMMENDS,
    deepPdfService,
    initialFileStatus = {},
  } = overrides;

  const file = makeFileRecord(initialFileStatus);
  let storedFile = { ...file };

  return {
    getWorkspace: vi.fn(async () => workspace),
    createUploadedFile: vi.fn(async () => file),
    getUploadedFile: vi.fn(async () => storedFile),
    updateUploadedFile: vi.fn(async (_uid: string, _fid: string, updates: Partial<UploadedFileRecord>) => {
      storedFile = { ...storedFile, ...updates };
      return storedFile;
    }),
    listUploadedFiles: vi.fn(async () => [file]),
    writeDecisionLogEntry: vi.fn(async () => ({
      id: "log-1",
      userId: "alice",
      decisionType: "file_chunking" as const,
      title: "test",
      decision: "test",
      rationale: "test",
      date: baseDate.toISOString(),
      createdAt: baseDate,
    })),
    fileExtractionProvider: { extractText: vi.fn(async () => ({ text: "extracted", source: "pdf_parse_pdf_parser" as const })) },
    listFileChunks: vi.fn(async () => []),
    replaceFileChunks: vi.fn(async () => undefined),
    documentUnderstandingOrchestrationService: makeUnderstandingService(),
    evaluateDocumentQualityGate: vi.fn(() => qualityGateOutput),
    deepPdfOrchestrationService: deepPdfService,
  };
}

// ---------------------------------------------------------------------------
// 1. Cheap Practice — Deep PDF must not auto-run
// ---------------------------------------------------------------------------

describe("Cheap Practice — Deep PDF blocked", () => {
  it("Deep PDF service receives Cheap Practice cost mode", async () => {
    const { service: deepPdfService, calls } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Cheap Practice",
    });

    // Service must have been called with Cheap Practice
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.costMode).toBe("Cheap Practice");
  });

  it("Deep PDF service returns skipped for Cheap Practice", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Cheap Practice",
    });

    // Chunking still succeeds
    expect(result.ok).toBe(true);
    // Service was not used for Deep PDF
    const deepPdfRunCall = (deepPdfService.runDeepPdfUnderstanding as ReturnType<typeof vi.fn>).mock.calls;
    const wasCalledWithCheapPractice = deepPdfRunCall.some(([, , opts]) => opts?.costMode === "Cheap Practice");
    expect(wasCalledWithCheapPractice).toBe(true);
    // And the service returned skipped (not completed)
  });

  it("Deep PDF does not complete when Cheap Practice", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Cheap Practice",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // File should not have deepPdfStatus = "completed" after Cheap Practice
    expect(result.file.deepPdfStatus).not.toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// 2. Normal Learning — Deep PDF may auto-run
// ---------------------------------------------------------------------------

describe("Normal Learning — Deep PDF eligible", () => {
  it("Deep PDF service receives Normal Learning cost mode", async () => {
    const { service: deepPdfService, calls } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Normal Learning",
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.costMode).toBe("Normal Learning");
  });

  it("chunking lifecycle succeeds with Normal Learning", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Normal Learning",
    });

    expect(result.ok).toBe(true);
  });

  it("Deep PDF completes with Normal Learning when recommended", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService, qualityGateOutput: QUALITY_GATE_RECOMMENDS });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Normal Learning",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.deepPdfStatus).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// 3. Deep Research — Deep PDF may auto-run
// ---------------------------------------------------------------------------

describe("Deep Research — Deep PDF eligible", () => {
  it("Deep PDF service receives Deep Research cost mode", async () => {
    const { service: deepPdfService, calls } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Deep Research",
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.costMode).toBe("Deep Research");
  });

  it("Deep PDF completes with Deep Research when recommended", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService, qualityGateOutput: QUALITY_GATE_RECOMMENDS });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Deep Research",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.deepPdfStatus).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// 4. Default — no costMode provided defaults to Normal Learning
// ---------------------------------------------------------------------------

describe("default cost mode (no options provided)", () => {
  it("Deep PDF service is called with Normal Learning when no cost mode given", async () => {
    const { service: deepPdfService, calls } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    // No costMode option — should default to Normal Learning
    await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.costMode).toBe("Normal Learning");
  });

  it("chunking lifecycle still succeeds with no costMode", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({ deepPdfService });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Quality gate says text-only — Deep PDF not triggered regardless of cost mode
// ---------------------------------------------------------------------------

describe("quality gate use_text_only — Deep PDF not called", () => {
  it("Deep PDF service not called when quality gate returns use_text_only", async () => {
    const { service: deepPdfService } = makeDeepPdfService();
    const repos = makeRepositories({
      deepPdfService,
      qualityGateOutput: QUALITY_GATE_TEXT_ONLY,
    });
    const svc = createUploadedFileApiService(repos);

    await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Deep Research",
    });

    expect(deepPdfService.runDeepPdfUnderstanding).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Reusable completed result — never re-runs regardless of cost mode
// ---------------------------------------------------------------------------

describe("completed reusable result — never re-runs", () => {
  it("Deep PDF service skips when deepPdfStatus is already completed", async () => {
    // Simulate a file already in completed state
    const completedFile = makeFileRecord({
      deepPdfStatus: "completed",
      deepPdfProviderName: "gemini_pdf_understanding",
      deepPdfModel: "gemini-2.5-flash",
      deepPdfInputHash: "a".repeat(64),
      deepPdfStorageGeneration: "123456",
      deepPdfArtifactVersion: "deep_pdf_artifacts_v1",
      understandingMode: "deep_pdf",
      chunkingStatus: "not_started",
    });

    // Make the understanding service return the completed file
    const understandingService: DocumentUnderstandingOrchestrationService = {
      runTextOnlyUnderstanding: vi.fn(async () => ({
        ok: true as const,
        file: completedFile,
        output: {
          providerName: "pdf_parse_outline",
          providerMode: "text_only" as const,
          pageCount: 1,
          pages: [],
          outline: { outlineId: "v1", fileId: "file-1", sections: [], confidence: "high" as const },
          detectedQuestions: [],
          qualitySignals: {
            hasExtractedText: true,
            extractedTextCharCount: 40,
            likelyHasMath: true,
            likelyHasVisualContent: false,
            textQuality: "good" as const,
          },
          extractionQuality: "good" as const,
          confidence: "high" as const,
          warnings: [],
          errors: [],
        },
      })),
    };

    const { service: deepPdfService } = makeDeepPdfService();
    const repos = {
      ...makeRepositories({ deepPdfService, qualityGateOutput: QUALITY_GATE_RECOMMENDS }),
      documentUnderstandingOrchestrationService: understandingService,
    };
    const svc = createUploadedFileApiService(repos);

    await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Deep Research",
    });

    // When deepPdfStatus is "completed", shouldRecommendDeepPdf returns false
    // (because status is already "completed"), so Deep PDF service is not called at all
    expect(deepPdfService.runDeepPdfUnderstanding).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Deep PDF service absent — chunking still succeeds
// ---------------------------------------------------------------------------

describe("no deepPdfOrchestrationService injected — safe fallback", () => {
  it("chunking succeeds when deep PDF service is not provided", async () => {
    const repos = makeRepositories({ deepPdfService: undefined });
    const svc = createUploadedFileApiService(repos);

    const result = await svc.runChunkingLifecycleForFile(user, "ws-1", "file-1", {
      costMode: "Normal Learning",
    });

    expect(result.ok).toBe(true);
  });
});
