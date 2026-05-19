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
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeRepositories() {
  const createUploadedFile = vi.fn(async () => createRecord());
  const updateUploadedFile = vi.fn(async (_userId: string, _fileId: string, updates: Partial<UploadedFileRecord>) => {
      if (updates.indexingStatus === "indexing") {
        return createRecord({ indexingStatus: "indexing" });
      }
      if (updates.indexingStatus === "indexed") {
        return createRecord({ indexingStatus: "indexed" });
      }
      if (updates.indexingStatus === "failed") {
        return createRecord({ indexingStatus: "failed" });
      }
      if (updates.summaryStatus === "pending") {
        return createRecord({ summaryStatus: "pending", summaryUpdatedAt: baseDate });
      }
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
    listUploadedFiles: vi.fn(async () => [createRecord({ indexingStatus: "indexed" })]),
    writeDecisionLogEntry,
  };
}

describe("uploadedFileApiService.createFileForWorkspace", () => {
  it("creates metadata, classifies, completes indexing lifecycle and writes decision logs", async () => {
    const repos = makeRepositories();
    const service = createUploadedFileApiService(repos);

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
        summarySource: "none",
        summaryText: null,
        summaryErrorCode: null,
        summaryUpdatedAt: null,
      })
    );

    expect(repos.updateUploadedFile).toHaveBeenNthCalledWith(
      1,
      "alice",
      "file-1",
      expect.objectContaining({ indexingStatus: "indexing" })
    );
    expect(repos.updateUploadedFile).toHaveBeenNthCalledWith(
      2,
      "alice",
      "file-1",
      expect.objectContaining({ indexingStatus: "indexed" })
    );

    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "file_assignment", workspaceId: "ws-1" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "topic_classification", workspaceId: "ws-1" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "file_indexing", workspaceId: "ws-1" })
    );
  });

  it("uses needs-review for low-confidence classification", async () => {
    const repos = makeRepositories();
    const service = createUploadedFileApiService(repos);

    await service.createFileForWorkspace(user, "ws-1", {
      fileName: "x.pdf",
      sourceType: "pdf",
    });

    expect(repos.createUploadedFile).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ assignmentStatus: "needs-review", confidence: 0.61 })
    );
  });

  it("marks indexing failed on internal transition failure", async () => {
    const repos = makeRepositories();
    repos.updateUploadedFile = vi.fn(async (_userId: string, _fileId: string, updates) => {
      if (updates.indexingStatus === "indexing") {
        throw new Error("transition failure");
      }
      if (updates.indexingStatus === "failed") {
        return createRecord({ indexingStatus: "failed" });
      }
      return createRecord();
    });

    const service = createUploadedFileApiService(repos);

    const result = await service.createFileForWorkspace(user, "ws-1", {
      fileName: "Mechanics Intro.pdf",
      sourceType: "pdf",
    });

    expect(result?.indexingStatus).toBe("failed");
    expect(repos.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ indexingStatus: "failed" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "file_indexing", decision: expect.stringContaining("failed") })
    );
  });

  it("returns null when workspace does not exist", async () => {
    const repos = makeRepositories();
    repos.getWorkspace = vi.fn(async (): Promise<WorkspaceRecord | null> => null);
    const service = createUploadedFileApiService(repos);

    const result = await service.createFileForWorkspace(user, "missing", {
      fileName: "Mechanics Intro.pdf",
      sourceType: "pdf",
    });

    expect(result).toBeNull();
    expect(repos.createUploadedFile).not.toHaveBeenCalled();
  });
});

describe("uploadedFileApiService.runSummaryLifecycleForFile", () => {
  it("runs metadata summary lifecycle from not_requested to ready", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ summaryStatus: "not_requested" }));
    const service = createUploadedFileApiService(repos);

    const result = await service.runSummaryLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.summaryStatus).toBe("ready");
      expect(result.file.summarySource).toBe("placeholder");
      expect(result.file.summaryText).toContain("Summary placeholder");
    }
    expect(repos.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ summaryStatus: "pending" })
    );
    expect(repos.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ summaryStatus: "ready" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "file_summary", decision: "summary_requested" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "file_summary", decision: "summary_completed" })
    );
  });

  it("allows rerun from failed to ready", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ summaryStatus: "failed" }));
    const service = createUploadedFileApiService(repos);

    const result = await service.runSummaryLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.summaryStatus).toBe("ready");
    }
  });

  it("rejects invalid transition when summary is already ready", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ summaryStatus: "ready" }));
    const service = createUploadedFileApiService(repos);

    const result = await service.runSummaryLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "invalid_transition" });
    expect(repos.updateUploadedFile).not.toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ summaryStatus: "pending" })
    );
  });

  it("marks summary failed when ready transition throws", async () => {
    const repos = makeRepositories();
    repos.getUploadedFile = vi.fn(async () => createRecord({ summaryStatus: "not_requested" }));
    repos.updateUploadedFile = vi.fn(async (_userId: string, _fileId: string, updates: Partial<UploadedFileRecord>) => {
      if (updates.summaryStatus === "pending") {
        return createRecord({ summaryStatus: "pending" });
      }
      if (updates.summaryStatus === "ready") {
        throw new Error("boom");
      }
      if (updates.summaryStatus === "failed") {
        return createRecord({ summaryStatus: "failed", summaryErrorCode: "summary_lifecycle_failed" });
      }
      return createRecord();
    });

    const service = createUploadedFileApiService(repos);
    const result = await service.runSummaryLifecycleForFile(user, "ws-1", "file-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.summaryStatus).toBe("failed");
      expect(result.file.summaryErrorCode).toBe("summary_lifecycle_failed");
    }
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "file_summary", decision: "summary_failed" })
    );
  });
});

describe("uploadedFileApiService.listFilesForWorkspace", () => {
  it("returns null for missing workspace", async () => {
    const repos = makeRepositories();
    repos.getWorkspace = vi.fn(async (): Promise<WorkspaceRecord | null> => null);

    const service = createUploadedFileApiService(repos);
    const result = await service.listFilesForWorkspace(user, "missing");

    expect(result).toBeNull();
    expect(repos.listUploadedFiles).not.toHaveBeenCalled();
  });

  it("lists files for existing workspace", async () => {
    const repos = makeRepositories();
    const service = createUploadedFileApiService(repos);

    const result = await service.listFilesForWorkspace(user, "ws-1");

    expect(result).toHaveLength(1);
    expect(repos.listUploadedFiles).toHaveBeenCalledWith("alice", "ws-1");
  });
});
