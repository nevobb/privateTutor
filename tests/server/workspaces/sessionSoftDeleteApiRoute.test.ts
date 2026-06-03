import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";
import type { WorkMode, CostMode } from "../../../src/types";

vi.mock("../../../src/server/workspaces/sessionApiService", () => ({
  sessionApiService: {
    createSessionForUser: vi.fn(),
    listSessionsForUser: vi.fn(),
    renameSessionForUser: vi.fn(),
    softDeleteSessionForUser: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/sessionApiSchemas", () => ({
  parseDeleteSessionRequest: vi.fn(),
  parseRenameSessionRequest: vi.fn(),
  serializeSession: vi.fn((r: unknown) => r),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createSessionDeleteHandler } from "../../../src/app/api/sessions/[sessionId]/route";
import { sessionApiService } from "../../../src/server/workspaces/sessionApiService";
import { parseDeleteSessionRequest } from "../../../src/server/workspaces/sessionApiSchemas";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockSoftDelete = vi.mocked(sessionApiService.softDeleteSessionForUser);
const mockParse = vi.mocked(parseDeleteSessionRequest);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);

function okAuth(userId = "alice"): (r: Request) => Promise<AuthResult> {
  return async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function failAuth(): (r: Request) => Promise<AuthResult> {
  return async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

function context(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

function deleteRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/sess-1", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseSession = {
  id: "sess-1",
  userId: "alice",
  workspaceId: "ws-1",
  title: "Physics session",
  workMode: "Learning" as WorkMode,
  costMode: "Normal Learning" as CostMode,
  status: "active" as const,
  startedAt: new Date(),
  lastActiveAt: new Date(),
  updatedAt: new Date(),
  messageCount: 2,
  isDeleted: true,
  deletedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("DELETE /api/sessions/[sessionId] — soft delete", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createSessionDeleteHandler(failAuth());
    const res = await handler(deleteRequest({ workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing sessionId", async () => {
    const handler = createSessionDeleteHandler(okAuth());
    const res = await handler(deleteRequest({ workspaceId: "ws-1" }), context(""));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("sessionId");
  });

  it("returns 400 for invalid JSON body", async () => {
    const handler = createSessionDeleteHandler(okAuth());
    const req = new Request("http://localhost/api/sessions/sess-1", {
      method: "DELETE",
      body: "not-json",
    });
    const res = await handler(req, context("sess-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema validation fails (missing workspaceId)", async () => {
    mockParse.mockReturnValueOnce({ ok: false, error: "workspaceId is required." });
    const handler = createSessionDeleteHandler(okAuth());
    const res = await handler(deleteRequest({}), context("sess-1"));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("workspaceId");
  });

  it("returns 404 when session not found", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockSoftDelete.mockResolvedValueOnce(null);
    const handler = createSessionDeleteHandler(okAuth());
    const res = await handler(deleteRequest({ workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when workspace not found", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-bad" } });
    mockSoftDelete.mockRejectedValueOnce(new Error("Workspace not found."));
    const handler = createSessionDeleteHandler(okAuth());
    const res = await handler(deleteRequest({ workspaceId: "ws-bad" }), context("sess-1"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with deleted:true on success", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockSoftDelete.mockResolvedValueOnce(baseSession);
    const handler = createSessionDeleteHandler(okAuth());
    const res = await handler(deleteRequest({ workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted?: boolean; sessionId?: string };
    expect(body.deleted).toBe(true);
    expect(body.sessionId).toBe("sess-1");
  });

  it("returns 503 on Firestore unavailable", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockSoftDelete.mockRejectedValueOnce(new Error("emulator unavailable"));
    mockIsUnavailable.mockReturnValue(true);
    const handler = createSessionDeleteHandler(okAuth());
    const res = await handler(deleteRequest({ workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(503);
  });

  it("passes correct user and sessionId to service", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockSoftDelete.mockResolvedValueOnce(baseSession);
    const handler = createSessionDeleteHandler(okAuth("bob"));
    await handler(deleteRequest({ workspaceId: "ws-1" }), context("sess-99"));
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bob" }),
      "sess-99",
      { workspaceId: "ws-1" }
    );
  });
});
