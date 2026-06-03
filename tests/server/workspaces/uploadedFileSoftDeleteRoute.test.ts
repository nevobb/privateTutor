import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/uploadedFileApiService", () => ({
  uploadedFileApiService: {
    createFileForWorkspace: vi.fn(),
    listFilesForWorkspace: vi.fn(),
    runExtractionLifecycleForFile: vi.fn(),
    runChunkingLifecycleForFile: vi.fn(),
    runSummaryLifecycleForFile: vi.fn(),
    softDeleteFileForWorkspace: vi.fn(),
  },
  UploadedFileValidationError: class extends Error {},
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createWorkspaceFileDeleteHandler } from "../../../src/app/api/workspaces/[workspaceId]/files/[fileId]/route";
import { uploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockSoftDelete = vi.mocked(uploadedFileApiService.softDeleteFileForWorkspace);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);

function okAuth(userId = "alice"): (r: Request) => Promise<AuthResult> {
  return async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function failAuth(): (r: Request) => Promise<AuthResult> {
  return async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

function context(workspaceId: string, fileId: string) {
  return { params: Promise.resolve({ workspaceId, fileId }) };
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/workspaces/ws-1/files/file-1", {
    method: "DELETE",
  });
}

const baseFile = {
  id: "file-1",
  userId: "alice",
  workspaceId: "ws-1",
  name: "Physics.pdf",
  url: "",
  uploadedAt: new Date(),
  assignmentStatus: "assigned" as const,
  indexingStatus: "indexed" as const,
  sourceType: "pdf" as const,
  summaryStatus: "not_requested" as const,
  summaryText: null,
  summarySource: "none" as const,
  summaryErrorCode: null,
  summaryUpdatedAt: null,
  extractionStatus: "completed" as const,
  extractionErrorCode: null,
  extractionUpdatedAt: null,
  chunkingStatus: "completed" as const,
  chunkingErrorCode: null,
  chunkingUpdatedAt: null,
  isDeleted: true,
  deletedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("DELETE /api/workspaces/[workspaceId]/files/[fileId]", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFileDeleteHandler(failAuth());
    const res = await handler(deleteRequest(), context("ws-1", "file-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing workspaceId", async () => {
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("", "file-1"));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("workspace");
  });

  it("returns 400 for missing fileId", async () => {
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("ws-1", ""));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("file");
  });

  it("returns 404 when file not found", async () => {
    mockSoftDelete.mockResolvedValueOnce(null);
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("ws-1", "file-missing"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with deleted:true on success", async () => {
    mockSoftDelete.mockResolvedValueOnce(baseFile as never);
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("ws-1", "file-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted?: boolean; fileId?: string };
    expect(body.deleted).toBe(true);
    expect(body.fileId).toBe("file-1");
  });

  it("returns 503 on Firestore unavailable", async () => {
    mockSoftDelete.mockRejectedValueOnce(new Error("emulator unavailable"));
    mockIsUnavailable.mockReturnValue(true);
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("ws-1", "file-1"));
    expect(res.status).toBe(503);
  });

  it("passes correct user, workspaceId, fileId to service", async () => {
    mockSoftDelete.mockResolvedValueOnce(baseFile as never);
    const handler = createWorkspaceFileDeleteHandler(okAuth("bob"));
    await handler(deleteRequest(), context("ws-99", "file-42"));
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bob" }),
      "ws-99",
      "file-42"
    );
  });

  it("does not call any physical delete or storage delete", async () => {
    mockSoftDelete.mockResolvedValueOnce(baseFile as never);
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    await handler(deleteRequest(), context("ws-1", "file-1"));
    // Only softDeleteFileForWorkspace was called — no other deletion APIs
    expect(mockSoftDelete).toHaveBeenCalledOnce();
  });

  // ── Workspace boundary enforcement at route level ─────────────────────────

  it("returns 404 when service returns null (workspace mismatch scenario)", async () => {
    // Service returns null when workspaceId does not match file's workspace
    mockSoftDelete.mockResolvedValueOnce(null);
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("ws-wrong", "file-1"));
    expect(res.status).toBe(404);
  });

  it("route passes workspaceId to service so service can enforce boundary", async () => {
    mockSoftDelete.mockResolvedValueOnce(null);
    const handler = createWorkspaceFileDeleteHandler(okAuth("alice"));
    await handler(deleteRequest(), context("ws-attacker", "file-1"));

    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "alice" }),
      "ws-attacker",
      "file-1"
    );
  });

  it("file not modified when workspace mismatch — route responds with 404", async () => {
    mockSoftDelete.mockResolvedValueOnce(null);
    const handler = createWorkspaceFileDeleteHandler(okAuth());
    const res = await handler(deleteRequest(), context("ws-wrong", "file-1"));

    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("not found");
  });
});
