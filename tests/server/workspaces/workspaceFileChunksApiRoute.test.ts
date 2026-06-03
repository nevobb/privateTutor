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

function jsonRequest(url: string, body?: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

function emptyRequest(url: string): Request {
  return new Request(url, { method: "POST" });
}

const CHUNKS_URL = "http://localhost/api/workspaces/ws-1/files/file-1/chunks";

const SUCCESS_FILE = {
  id: "file-1",
  userId: "alice",
  workspaceId: "ws-1",
  name: "doc.pdf",
  url: "",
  uploadedAt: new Date(),
  assignmentStatus: "assigned",
  indexingStatus: "indexed",
  sourceType: "pdf",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("POST /api/workspaces/[workspaceId]/files/[fileId]/chunks", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFileChunksPostHandler(failAuth());
    const response = await handler(emptyRequest(CHUNKS_URL), context("ws-1", "file-1"));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid state", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: false, code: "extraction_not_completed" });
    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    const response = await handler(emptyRequest(CHUNKS_URL), context("ws-1", "file-1"));

    expect(response.status).toBe(400);
  });

  it("returns 404 for missing file/workspace", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: false, code: "file_not_found" });
    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    const response = await handler(emptyRequest(CHUNKS_URL), context("ws-1", "file-1"));

    expect(response.status).toBe(404);
  });

  it("returns chunkCount on success", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: true, chunkCount: 3, file: SUCCESS_FILE } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    const response = await handler(emptyRequest(CHUNKS_URL), context("ws-1", "file-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ file: { id: "file-1" }, chunkCount: 3 });
  });

  // ── Cost mode forwarding ────────────────────────────────────────────────────

  it("forwards Cheap Practice costMode to runChunkingLifecycleForFile", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: true, chunkCount: 1, file: SUCCESS_FILE } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    await handler(jsonRequest(CHUNKS_URL, { costMode: "Cheap Practice" }), context("ws-1", "file-1"));

    expect(mockRunChunking).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "file-1",
      { costMode: "Cheap Practice" }
    );
  });

  it("forwards Normal Learning costMode to runChunkingLifecycleForFile", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: true, chunkCount: 1, file: SUCCESS_FILE } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    await handler(jsonRequest(CHUNKS_URL, { costMode: "Normal Learning" }), context("ws-1", "file-1"));

    expect(mockRunChunking).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "file-1",
      { costMode: "Normal Learning" }
    );
  });

  it("forwards Deep Research costMode to runChunkingLifecycleForFile", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: true, chunkCount: 1, file: SUCCESS_FILE } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    await handler(jsonRequest(CHUNKS_URL, { costMode: "Deep Research" }), context("ws-1", "file-1"));

    expect(mockRunChunking).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "file-1",
      { costMode: "Deep Research" }
    );
  });

  it("passes undefined costMode when no body is sent (old client compat)", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: true, chunkCount: 1, file: SUCCESS_FILE } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    await handler(emptyRequest(CHUNKS_URL), context("ws-1", "file-1"));

    expect(mockRunChunking).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "file-1",
      { costMode: undefined }
    );
  });

  it("passes undefined costMode for unknown/invalid costMode value (falls back safely)", async () => {
    mockRunChunking.mockResolvedValueOnce({ ok: true, chunkCount: 1, file: SUCCESS_FILE } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFileChunksPostHandler(okAuth());
    await handler(jsonRequest(CHUNKS_URL, { costMode: "InvalidMode" }), context("ws-1", "file-1"));

    expect(mockRunChunking).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "file-1",
      { costMode: undefined }
    );
  });
});
