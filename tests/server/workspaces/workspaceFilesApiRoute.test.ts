import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/uploadedFileApiService", () => ({
  UploadedFileValidationError: class UploadedFileValidationError extends Error {},
  uploadedFileApiService: {
    createFileForWorkspace: vi.fn(),
    listFilesForWorkspace: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/uploadedFileApiSchemas", () => ({
  parseCreateUploadedFileRequest: vi.fn(),
  toUploadedFileApiResponse: vi.fn((record: unknown) => record),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import {
  createWorkspaceFilesGetHandler,
  createWorkspaceFilesPostHandler,
} from "../../../src/app/api/workspaces/[workspaceId]/files/route";
import { uploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import {
  parseCreateUploadedFileRequest,
  toUploadedFileApiResponse,
} from "../../../src/server/workspaces/uploadedFileApiSchemas";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";
import { UploadedFileValidationError } from "../../../src/server/workspaces/uploadedFileApiService";

const mockCreate = vi.mocked(uploadedFileApiService.createFileForWorkspace);
const mockList = vi.mocked(uploadedFileApiService.listFilesForWorkspace);
const mockParse = vi.mocked(parseCreateUploadedFileRequest);
const mockSerialize = vi.mocked(toUploadedFileApiResponse);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);

function okAuth(userId = "alice"): (request: Request) => Promise<AuthResult> {
  return async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function failAuth(): (request: Request) => Promise<AuthResult> {
  return async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

function context(workspaceId: string) {
  return { params: Promise.resolve({ workspaceId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("GET /api/workspaces/[workspaceId]/files", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFilesGetHandler(failAuth());
    const response = await handler(new Request("http://localhost/api/workspaces/ws-1/files"), context("ws-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when workspace is missing or cross-user", async () => {
    mockList.mockResolvedValueOnce(null);
    const handler = createWorkspaceFilesGetHandler(okAuth());
    const response = await handler(new Request("http://localhost/api/workspaces/ws-1/files"), context("ws-1"));
    expect(response.status).toBe(404);
  });

  it("returns 503 when emulator unavailable", async () => {
    mockList.mockRejectedValueOnce(new Error("down"));
    mockIsUnavailable.mockReturnValueOnce(true);
    const handler = createWorkspaceFilesGetHandler(okAuth());
    const response = await handler(new Request("http://localhost/api/workspaces/ws-1/files"), context("ws-1"));
    expect(response.status).toBe(503);
  });

  it("returns serialized files", async () => {
    const now = new Date().toISOString();
    mockList.mockResolvedValueOnce([
      {
        id: "file-1",
        userId: "alice",
        workspaceId: "ws-1",
        name: "doc.pdf",
        url: "",
        uploadedAt: new Date(now),
        assignmentStatus: "assigned",
        indexingStatus: "indexed",
        sourceType: "pdf",
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    ] as never);

    mockSerialize.mockReturnValueOnce({ id: "file-1" } as never);

    const handler = createWorkspaceFilesGetHandler(okAuth());
    const response = await handler(new Request("http://localhost/api/workspaces/ws-1/files"), context("ws-1"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { files: Array<{ id: string }> };
    expect(body.files).toEqual([{ id: "file-1" }]);
  });
});

describe("POST /api/workspaces/[workspaceId]/files", () => {
  it("returns 400 for invalid JSON", async () => {
    const handler = createWorkspaceFilesPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json",
      }),
      context("ws-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFilesPostHandler(failAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "a.pdf", sourceType: "pdf" }),
      }),
      context("ws-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    mockParse.mockReturnValueOnce({ ok: false, error: "sourceType invalid" });
    const handler = createWorkspaceFilesPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "a.txt", sourceType: "txt" }),
      }),
      context("ws-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid storagePath validation from service", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { fileName: "a.pdf", sourceType: "pdf" } });
    mockCreate.mockRejectedValueOnce(new UploadedFileValidationError("bad path"));

    const handler = createWorkspaceFilesPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "a.pdf", sourceType: "pdf" }),
      }),
      context("ws-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when workspace is missing or cross-user", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { fileName: "a.pdf", sourceType: "pdf" } });
    mockCreate.mockResolvedValueOnce(null);

    const handler = createWorkspaceFilesPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "a.pdf", sourceType: "pdf" }),
      }),
      context("ws-1")
    );

    expect(response.status).toBe(404);
  });

  it("returns 201 and serialized file metadata", async () => {
    const now = new Date();
    mockParse.mockReturnValueOnce({
      ok: true,
      input: { fileName: "a.pdf", sourceType: "pdf", topicHint: "Physics" },
    });

    mockCreate.mockResolvedValueOnce({
      id: "file-1",
      userId: "alice",
      workspaceId: "ws-1",
      name: "a.pdf",
      url: "",
      uploadedAt: now,
      assignmentStatus: "assigned",
      indexingStatus: "indexed",
      sourceType: "pdf",
      topic: "Physics",
      confidence: 0.92,
      createdAt: now,
      updatedAt: now,
    } as never);

    mockSerialize.mockReturnValueOnce({ id: "file-1", fileName: "a.pdf" } as never);

    const handler = createWorkspaceFilesPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "a.pdf", sourceType: "pdf" }),
      }),
      context("ws-1")
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: "file-1", fileName: "a.pdf" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "alice" }),
      "ws-1",
      expect.objectContaining({ fileName: "a.pdf", sourceType: "pdf" })
    );
  });
});
