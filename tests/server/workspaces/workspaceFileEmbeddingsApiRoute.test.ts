import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/fileChunkEmbeddingService", () => ({
  fileChunkEmbeddingService: {
    runEmbeddingLifecycleForFile: vi.fn(),
  },
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createWorkspaceFileEmbeddingsPostHandler } from "../../../src/app/api/workspaces/[workspaceId]/files/[fileId]/embeddings/route";
import { fileChunkEmbeddingService } from "../../../src/server/workspaces/fileChunkEmbeddingService";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockRunEmbeddings = vi.mocked(fileChunkEmbeddingService.runEmbeddingLifecycleForFile);
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

describe("POST /api/workspaces/[workspaceId]/files/[fileId]/embeddings", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFileEmbeddingsPostHandler(failAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/embeddings", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 for missing file/workspace", async () => {
    mockRunEmbeddings.mockResolvedValueOnce({ ok: false, code: "file_not_found" });
    const handler = createWorkspaceFileEmbeddingsPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/embeddings", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid lifecycle state", async () => {
    mockRunEmbeddings.mockResolvedValueOnce({ ok: false, code: "chunking_not_completed" });
    const handler = createWorkspaceFileEmbeddingsPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/embeddings", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns embedding run counts on success", async () => {
    mockRunEmbeddings.mockResolvedValueOnce({
      ok: true,
      embeddedChunkCount: 3,
      failedChunkCount: 1,
    });

    const handler = createWorkspaceFileEmbeddingsPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/embeddings", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ embeddedChunkCount: 3, failedChunkCount: 1 });
  });
});
