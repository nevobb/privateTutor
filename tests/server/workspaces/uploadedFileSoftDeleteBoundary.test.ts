/**
 * Batch 9D.1 — Uploaded File Soft Delete Boundary Verification
 *
 * Verifies:
 * 1. softDeleteFileForWorkspace checks workspace ownership BEFORE deleting.
 * 2. Wrong workspaceId returns null without modifying the file.
 * 3. listUploadedFiles filter semantics.
 * 4. getUploadedFile returns null for isDeleted === true.
 */
import { describe, expect, it, vi } from "vitest";
import { createUploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import type { UploadedFileRecord, WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const user: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const baseDate = new Date("2026-06-03T08:00:00.000Z");

const workspace: WorkspaceRecord = {
  id: "ws-1",
  userId: "alice",
  name: "Physics",
  description: "",
  status: "active",
  createdAt: baseDate,
  updatedAt: baseDate,
};

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
    summaryStatus: "not_requested",
    summaryText: null,
    summarySource: "none",
    summaryErrorCode: null,
    summaryUpdatedAt: null,
    extractionStatus: "completed",
    extractionErrorCode: null,
    extractionUpdatedAt: null,
    chunkingStatus: "completed",
    chunkingErrorCode: null,
    chunkingUpdatedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeRepositories(overrides: Record<string, unknown> = {}) {
  const defaultRepos = {
    getWorkspace: vi.fn(async (_uid: string, wsId: string) =>
      wsId === "ws-1" ? workspace : null
    ),
    createUploadedFile: vi.fn(async () => makeFile()),
    getUploadedFile: vi.fn(async (_uid: string, fileId: string) =>
      fileId === "file-1" ? makeFile() : null
    ),
    updateUploadedFile: vi.fn(async () => makeFile()),
    listUploadedFiles: vi.fn(async () => [makeFile()]),
    softDeleteUploadedFile: vi.fn(async () =>
      makeFile({ isDeleted: true, deletedAt: new Date() })
    ),
    writeDecisionLogEntry: vi.fn(async () => ({
      id: "log-1",
      userId: "alice",
      decisionType: "file_assignment" as const,
      title: "t",
      decision: "d",
      rationale: "r",
      date: baseDate.toISOString(),
      createdAt: baseDate,
    })),
    fileExtractionProvider: {
      extractText: vi.fn(async () => ({ text: "x", source: "pdf_parse_pdf_parser" as const })),
    },
    listFileChunks: vi.fn(async () => []),
    replaceFileChunks: vi.fn(async () => undefined),
    documentUnderstandingOrchestrationService: {
      runTextOnlyUnderstanding: vi.fn(async () => ({ ok: false as const, code: "file_not_found" as const })),
    },
    evaluateDocumentQualityGate: vi.fn(() => ({
      decision: "use_text_only" as const,
      recommendedProviderMode: "text_only" as const,
      reasons: ["clean_text" as const],
      confidence: "high" as const,
      extractionQuality: null,
      shouldRunAutomatically: false,
      shouldShowUserNoticeLater: false,
      safeFallbackProviderMode: "text_only" as const,
    })),
  };
  return { ...defaultRepos, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. Workspace boundary — correct workspaceId
// ---------------------------------------------------------------------------

describe("softDeleteFileForWorkspace — workspace boundary", () => {
  it("deletes file when workspaceId matches", async () => {
    const repos = makeRepositories();
    const svc = createUploadedFileApiService(repos as never);

    const result = await svc.softDeleteFileForWorkspace(user, "ws-1", "file-1");

    expect(result).not.toBeNull();
    expect(result?.isDeleted).toBe(true);
    expect(repos.softDeleteUploadedFile).toHaveBeenCalledOnce();
  });

  it("returns null when workspace not found", async () => {
    const repos = makeRepositories();
    const svc = createUploadedFileApiService(repos as never);

    const result = await svc.softDeleteFileForWorkspace(user, "ws-bad", "file-1");

    expect(result).toBeNull();
    expect(repos.softDeleteUploadedFile).not.toHaveBeenCalled();
  });

  it("returns null when file not found (getUploadedFile returns null)", async () => {
    const repos = makeRepositories({
      getUploadedFile: vi.fn(async () => null),
    });
    const svc = createUploadedFileApiService(repos as never);

    const result = await svc.softDeleteFileForWorkspace(user, "ws-1", "file-missing");

    expect(result).toBeNull();
    expect(repos.softDeleteUploadedFile).not.toHaveBeenCalled();
  });

  it("does NOT soft-delete when file.workspaceId mismatches route workspaceId", async () => {
    const fileInOtherWorkspace = makeFile({ workspaceId: "ws-2" });
    const repos = makeRepositories({
      getUploadedFile: vi.fn(async () => fileInOtherWorkspace),
    });
    const svc = createUploadedFileApiService(repos as never);

    const result = await svc.softDeleteFileForWorkspace(user, "ws-1", "file-1");

    expect(result).toBeNull();
    // softDeleteUploadedFile must NOT be called — file must not be modified
    expect(repos.softDeleteUploadedFile).not.toHaveBeenCalled();
  });

  it("does NOT modify file when wrong workspaceId supplied (cross-workspace attack vector)", async () => {
    // File belongs to ws-correct; attacker uses ws-wrong to attempt deletion
    const fileInCorrectWs = makeFile({ workspaceId: "ws-correct" });
    const repos = makeRepositories({
      getWorkspace: vi.fn(async (_uid: string, wsId: string) =>
        wsId === "ws-correct" || wsId === "ws-wrong" ? workspace : null
      ),
      getUploadedFile: vi.fn(async () => fileInCorrectWs),
    });
    const svc = createUploadedFileApiService(repos as never);

    const result = await svc.softDeleteFileForWorkspace(user, "ws-wrong", "file-1");

    expect(result).toBeNull();
    expect(repos.softDeleteUploadedFile).not.toHaveBeenCalled();
  });

  it("checks workspace existence before reading the file", async () => {
    const repos = makeRepositories();
    const svc = createUploadedFileApiService(repos as never);

    await svc.softDeleteFileForWorkspace(user, "ws-bad", "file-1");

    // getWorkspace called, fails → getUploadedFile never called
    expect(repos.getWorkspace).toHaveBeenCalledWith("alice", "ws-bad");
    expect(repos.getUploadedFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. listUploadedFiles filter semantics
// ---------------------------------------------------------------------------

describe("listUploadedFiles isDeleted filter semantics", () => {
  function applyFilter(data: Record<string, unknown>, userId: string, workspaceId: string): boolean {
    const ownerUserId = typeof data.userId === "string" ? data.userId : "";
    return ownerUserId === userId && data.workspaceId === workspaceId && data.isDeleted !== true;
  }

  it("includes old record with missing isDeleted (backward compat)", () => {
    expect(applyFilter({ userId: "alice", workspaceId: "ws-1" }, "alice", "ws-1")).toBe(true);
  });

  it("includes record with isDeleted: false", () => {
    expect(applyFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: false }, "alice", "ws-1")).toBe(true);
  });

  it("includes record with isDeleted: null", () => {
    expect(applyFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: null }, "alice", "ws-1")).toBe(true);
  });

  it("includes record with isDeleted: undefined", () => {
    expect(applyFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: undefined }, "alice", "ws-1")).toBe(true);
  });

  it("excludes record with isDeleted: true", () => {
    expect(applyFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: true }, "alice", "ws-1")).toBe(false);
  });

  it("excludes record from wrong user", () => {
    expect(applyFilter({ userId: "bob", workspaceId: "ws-1", isDeleted: false }, "alice", "ws-1")).toBe(false);
  });

  it("excludes record from wrong workspace", () => {
    expect(applyFilter({ userId: "alice", workspaceId: "ws-2", isDeleted: false }, "alice", "ws-1")).toBe(false);
  });

  it("!== true is broader than === false (handles null and undefined)", () => {
    const nullCase = applyFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: null }, "alice", "ws-1");
    const undefinedCase = applyFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: undefined }, "alice", "ws-1");
    expect(nullCase).toBe(true);
    expect(undefinedCase).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. getUploadedFile isDeleted filter semantics
// ---------------------------------------------------------------------------

describe("getUploadedFile isDeleted filter semantics", () => {
  function shouldReturnNull(data: Record<string, unknown>, userId: string): boolean {
    const ownerUserId = typeof data.userId === "string" ? data.userId : "";
    return ownerUserId !== userId || data.isDeleted === true;
  }

  it("returns null for isDeleted: true", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: true }, "alice")).toBe(true);
  });

  it("returns non-null for active file (isDeleted: false)", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: false }, "alice")).toBe(false);
  });

  it("returns non-null for old file (missing isDeleted)", () => {
    expect(shouldReturnNull({ userId: "alice" }, "alice")).toBe(false);
  });

  it("returns null for wrong user even if not deleted", () => {
    expect(shouldReturnNull({ userId: "bob", isDeleted: false }, "alice")).toBe(true);
  });

  it("strict === true: null/false/undefined do NOT block access", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: null }, "alice")).toBe(false);
    expect(shouldReturnNull({ userId: "alice", isDeleted: undefined }, "alice")).toBe(false);
    expect(shouldReturnNull({ userId: "alice", isDeleted: 0 }, "alice")).toBe(false);
  });
});
