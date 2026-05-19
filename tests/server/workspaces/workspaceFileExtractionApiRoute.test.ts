import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/uploadedFileApiService", () => ({
  uploadedFileApiService: {
    runExtractionLifecycleForFile: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/uploadedFileApiSchemas", () => ({
  toUploadedFileApiResponse: vi.fn((record: unknown) => record),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createWorkspaceFileExtractPostHandler } from "../../../src/app/api/workspaces/[workspaceId]/files/[fileId]/extract/route";
import { uploadedFileApiService } from "../../../src/server/workspaces/uploadedFileApiService";
import { toUploadedFileApiResponse } from "../../../src/server/workspaces/uploadedFileApiSchemas";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockRunExtraction = vi.mocked(uploadedFileApiService.runExtractionLifecycleForFile);
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

describe("POST /api/workspaces/[workspaceId]/files/[fileId]/extract", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createWorkspaceFileExtractPostHandler(failAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/extract", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for missing params", async () => {
    const handler = createWorkspaceFileExtractPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/extract", { method: "POST" }),
      context("", "")
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when workspace or file is missing", async () => {
    mockRunExtraction.mockResolvedValueOnce({ ok: false, code: "file_not_found" });

    const handler = createWorkspaceFileExtractPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/extract", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid transition", async () => {
    mockRunExtraction.mockResolvedValueOnce({ ok: false, code: "invalid_transition" });

    const handler = createWorkspaceFileExtractPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/extract", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 503 when emulator unavailable", async () => {
    mockRunExtraction.mockRejectedValueOnce(new Error("down"));
    mockIsUnavailable.mockReturnValueOnce(true);

    const handler = createWorkspaceFileExtractPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/extract", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(503);
  });

  it("returns 200 and serialized updated file", async () => {
    const now = new Date();
    mockRunExtraction.mockResolvedValueOnce({
      ok: true,
      file: {
        id: "file-1",
        userId: "alice",
        workspaceId: "ws-1",
        name: "a.pdf",
        url: "",
        uploadedAt: now,
        assignmentStatus: "assigned",
        indexingStatus: "indexed",
        sourceType: "pdf",
        extractionStatus: "completed",
        extractedText: "placeholder text",
        extractedTextPreview: "placeholder text",
        extractedTextCharCount: 16,
        extractionSource: "deterministic_test_parser",
        extractionErrorCode: null,
        extractionUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    } as never);
    mockSerialize.mockReturnValueOnce({ id: "file-1", extractionStatus: "completed" } as never);

    const handler = createWorkspaceFileExtractPostHandler(okAuth());
    const response = await handler(
      new Request("http://localhost/api/workspaces/ws-1/files/file-1/extract", { method: "POST" }),
      context("ws-1", "file-1")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "file-1", extractionStatus: "completed" });
    expect(mockRunExtraction).toHaveBeenCalledWith(expect.objectContaining({ userId: "alice" }), "ws-1", "file-1");
  });
});
