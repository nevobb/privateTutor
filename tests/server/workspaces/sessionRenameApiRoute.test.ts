import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";
import type { WorkMode, CostMode } from "../../../src/types";

vi.mock("../../../src/server/workspaces/sessionApiService", () => ({
  sessionApiService: {
    createSessionForUser: vi.fn(),
    listSessionsForUser: vi.fn(),
    renameSessionForUser: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/sessionApiSchemas", () => ({
  parseRenameSessionRequest: vi.fn(),
  serializeSession: vi.fn((r: unknown) => r),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createSessionPatchHandler } from "../../../src/app/api/sessions/[sessionId]/route";
import { sessionApiService } from "../../../src/server/workspaces/sessionApiService";
import { parseRenameSessionRequest } from "../../../src/server/workspaces/sessionApiSchemas";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockRename = vi.mocked(sessionApiService.renameSessionForUser);
const mockParse = vi.mocked(parseRenameSessionRequest);
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

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/sess-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseSession = {
  id: "sess-1",
  userId: "alice",
  workspaceId: "ws-1",
  title: "Renamed Session",
  workMode: "Learning" as WorkMode,
  costMode: "Normal Learning" as CostMode,
  status: "active" as const,
  startedAt: new Date(),
  lastActiveAt: new Date(),
  updatedAt: new Date(),
  messageCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("PATCH /api/sessions/[sessionId] — rename conversation", () => {
  it("returns 401 on auth failure", async () => {
    const handler = createSessionPatchHandler(failAuth());
    const res = await handler(patchRequest({ title: "New", workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing sessionId", async () => {
    const handler = createSessionPatchHandler(okAuth());
    const res = await handler(patchRequest({ title: "New", workspaceId: "ws-1" }), context(""));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("sessionId");
  });

  it("returns 400 for invalid JSON body", async () => {
    const handler = createSessionPatchHandler(okAuth());
    const req = new Request("http://localhost/api/sessions/sess-1", {
      method: "PATCH",
      body: "not-json",
    });
    const res = await handler(req, context("sess-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema validation fails", async () => {
    mockParse.mockReturnValueOnce({ ok: false, error: "title must not be empty." });
    const handler = createSessionPatchHandler(okAuth());
    const res = await handler(patchRequest({ title: "", workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("title");
  });

  it("returns 404 when session not found", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { title: "New", workspaceId: "ws-1" } });
    mockRename.mockResolvedValueOnce(null);
    const handler = createSessionPatchHandler(okAuth());
    const res = await handler(patchRequest({ title: "New", workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when workspace not found", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { title: "New", workspaceId: "ws-bad" } });
    mockRename.mockRejectedValueOnce(new Error("Workspace not found."));
    const handler = createSessionPatchHandler(okAuth());
    const res = await handler(patchRequest({ title: "New", workspaceId: "ws-bad" }), context("sess-1"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with updated session on success", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { title: "Renamed", workspaceId: "ws-1" } });
    mockRename.mockResolvedValueOnce(baseSession);
    const handler = createSessionPatchHandler(okAuth());
    const res = await handler(patchRequest({ title: "Renamed", workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as { session?: typeof baseSession };
    expect(body.session).toBeDefined();
  });

  it("returns 503 on Firestore unavailable", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { title: "New", workspaceId: "ws-1" } });
    mockRename.mockRejectedValueOnce(new Error("emulator unavailable"));
    mockIsUnavailable.mockReturnValue(true);
    const handler = createSessionPatchHandler(okAuth());
    const res = await handler(patchRequest({ title: "New", workspaceId: "ws-1" }), context("sess-1"));
    expect(res.status).toBe(503);
  });

  it("passes correct user and sessionId to service", async () => {
    mockParse.mockReturnValueOnce({ ok: true, input: { title: "Renamed", workspaceId: "ws-1" } });
    mockRename.mockResolvedValueOnce(baseSession);
    const handler = createSessionPatchHandler(okAuth("bob"));
    await handler(patchRequest({ title: "Renamed", workspaceId: "ws-1" }), context("sess-99"));
    expect(mockRename).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bob" }),
      "sess-99",
      { title: "Renamed", workspaceId: "ws-1" }
    );
  });
});
