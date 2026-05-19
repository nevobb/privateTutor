import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/uploadedFileApiService", () => ({
  uploadedFileApiService: {
    runChunkingLifecycleForFile: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/uploadedFileApiSchemas", () => ({
  toUploadedFileApiResponse: vi.fn((record: unknown) => record),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createWorkspaceFileChunksPostHandler } from "../../../src/app/api/workspaces/[workspaceId]/files/[fileId]/chunks/route";
import { uploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import { toUploadedFileApiResponse } from "../../../src/server/workspaces/uploadedFileApiSchemas";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockRunChunking = vi.mocked(uploadedFileApiService.runChunkingLifecycleForFile);
const mockSerialize = vi.mocked(toUploadedFileApiResponse);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);

function okAuth(userId = "alice"): (request: Request) => Promise<AuthResult> {
  return async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function failAuth(): (request: Request) => Promise<AuthResult> {
  return async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

function context(workspaceId: string, fileId: string) {
  return { params: Promise.resolve({ workspaceId, fileId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("POST /api/workspaces/[workspaceId]/files/[fileId]/chunks", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFileChunksPostHandler(failAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/chunks", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid state", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: false, code: "extraction_not_completed" });
    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/chunks", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 for missing file/workspace", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: false, code: "file_not_found" });
    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/chunks", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(404);
  });

  it("returns chunkCount on success", async () => {
    const now = new Date();
    mockRunChunking.mockResolvedValueOnce({
      ok: true,
      chunkCount: 3,
      file: {
        id: "file-1",
        userId: "alice",
        workspaceId: "ws-1",
        name: "doc.pdf",
        url: "",
        uploadedAt: now,
        assignmentStatus: "assigned",
        indexingStatus: "indexed",
        sourceType: "pdf",
        createdAt: now,
        updatedAt: now,
      },
    } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/chunks", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ file: { id: "file-1" }, chunkCount: 3 });
  });
});
