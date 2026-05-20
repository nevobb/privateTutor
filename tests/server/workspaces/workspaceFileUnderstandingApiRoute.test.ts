import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/fileDocumentUnderstandingService", () => ({
  fileDocumentUnderstandingService: {
    runDocumentUnderstandingLifecycleForFile: vi.fn(),
  },
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createWorkspaceFileUnderstandingPostHandler } from "../../../src/app/api/workspaces/[workspaceId]/files/[fileId]/understanding/route";
import { fileDocumentUnderstandingService } from "../../../src/server/workspaces/fileDocumentUnderstandingService";

const mockRun = vi.mocked(fileDocumentUnderstandingService.runDocumentUnderstandingLifecycleForFile);

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
});

describe("POST /api/workspaces/[workspaceId]/files/[fileId]/understanding", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFileUnderstandingPostHandler(failAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/understanding", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for extraction not completed", async () => {
    mockRun.mockResolvedValueOnce({ ok: false, code: "extraction_not_completed" });
    const handler = createWorkspaceFileUnderstandingPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/understanding", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns summary on success", async () => {
    mockRun.mockResolvedValueOnce({
      ok: true,
      understandingStatus: "completed",
      materialType: "exam",
      detectedQuestionCount: 3,
      outlineSectionCount: 2,
    });
    const handler = createWorkspaceFileUnderstandingPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/understanding", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      understandingStatus: "completed",
      materialType: "exam",
      detectedQuestionCount: 3,
      outlineSectionCount: 2,
    });
  });
});
