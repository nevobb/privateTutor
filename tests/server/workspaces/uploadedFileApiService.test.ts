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
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeRepositories() {
  const createUploadedFile = vi.fn(async () => createRecord());
  const updateUploadedFile = vi.fn(
    async (_userId: string, _fileId: string, updates: Partial<Pick<UploadedFileRecord, "indexingStatus">>) => {
      if (updates.indexingStatus === "indexing") {
        return createRecord({ indexingStatus: "indexing" });
      }
      if (updates.indexingStatus === "indexed") {
        return createRecord({ indexingStatus: "indexed" });
      }
      if (updates.indexingStatus === "failed") {
        return createRecord({ indexingStatus: "failed" });
      }
      return createRecord();
    }
  );

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
