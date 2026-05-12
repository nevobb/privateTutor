import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createWorkspacesGetHandler,
  createWorkspacesPostHandler,
} from "../../../src/app/api/workspaces/route";
import { createWorkspaceByIdGetHandler } from "../../../src/app/api/workspaces/[workspaceId]/route";
import type { AuthResult } from "../../../src/server/auth/authTypes";
import type { WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";

// Mock the workspace api service
vi.mock("../../../src/server/workspaces/workspaceApiService", () => ({
  workspaceApiService: {
    createWorkspaceForUser: vi.fn(),
    listWorkspacesForUser: vi.fn(),
    getWorkspaceForUser: vi.fn(),
  },
}));

// Mock the Firestore emulator client so import doesn't fail
vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { workspaceApiService } from "../../../src/server/workspaces/workspaceApiService";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockCreateWorkspace = vi.mocked(workspaceApiService.createWorkspaceForUser);
const mockListWorkspaces = vi.mocked(workspaceApiService.listWorkspacesForUser);
const mockGetWorkspace = vi.mocked(workspaceApiService.getWorkspaceForUser);
const mockIsUnavailableError = vi.mocked(isFirestoreEmulatorUnavailableError);

const baseWorkspace: WorkspaceRecord = {
  id: "ws-1",
  userId: "alice",
  name: "Test Workspace",
  description: "desc",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeAuthResolver(userId = "alice"): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function makeFailingAuthResolver(status: 401 | 403 = 401): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: false, status, error: { error: "Unauthorized." } });
}

function makeRequest(body?: unknown, method = "GET"): Request {
  if (body !== undefined) {
    return new Request("http://localhost/api/workspaces", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new Request("http://localhost/api/workspaces", { method });
}

function makeByIdRequest(workspaceId: string): [Request, { params: Promise<{ workspaceId: string }> }] {
  return [
    new Request(`http://localhost/api/workspaces/${workspaceId}`),
    { params: Promise.resolve({ workspaceId }) },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailableError.mockReturnValue(false);
});

// ── GET /api/workspaces ────────────────────────────────────────────────────

describe("GET /api/workspaces", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createWorkspacesGetHandler(makeFailingAuthResolver());
    const response = await handler(makeRequest());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 200 with workspace list for authenticated user", async () => {
    mockListWorkspaces.mockResolvedValue([baseWorkspace]);
    const handler = createWorkspacesGetHandler(makeAuthResolver());
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspaces).toHaveLength(1);
    expect(body.workspaces[0].id).toBe("ws-1");
    expect(body.workspaces[0].userId).toBe("alice");
    expect(mockListWorkspaces).toHaveBeenCalledWith({ userId: "alice", email: "alice@test.example" });
  });

  it("returns 200 with empty list when user has no workspaces", async () => {
    mockListWorkspaces.mockResolvedValue([]);
    const handler = createWorkspacesGetHandler(makeAuthResolver());
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ workspaces: [] });
  });

  it("returns 503 when Firestore emulator is unavailable", async () => {
    const emulatorError = new Error("Emulator down");
    mockListWorkspaces.mockRejectedValue(emulatorError);
    mockIsUnavailableError.mockReturnValue(true);
    const handler = createWorkspacesGetHandler(makeAuthResolver());
    const response = await handler(makeRequest());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Firestore emulator is unavailable." });
  });

  it("returns 500 on unexpected error", async () => {
    mockListWorkspaces.mockRejectedValue(new Error("unexpected"));
    mockIsUnavailableError.mockReturnValue(false);
    const handler = createWorkspacesGetHandler(makeAuthResolver());
    const response = await handler(makeRequest());
    expect(response.status).toBe(500);
  });
});

// ── POST /api/workspaces ───────────────────────────────────────────────────

describe("POST /api/workspaces", () => {
  it("returns 400 for invalid JSON", async () => {
    const handler = createWorkspacesPostHandler(makeAuthResolver());
    const response = await handler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json",
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("returns 401 when auth fails", async () => {
    const handler = createWorkspacesPostHandler(makeFailingAuthResolver());
    const response = await handler(makeRequest({ name: "test" }, "POST"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const handler = createWorkspacesPostHandler(makeAuthResolver());
    const response = await handler(makeRequest({ description: "no name" }, "POST"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("name");
  });

  it("returns 400 when name is empty", async () => {
    const handler = createWorkspacesPostHandler(makeAuthResolver());
    const response = await handler(makeRequest({ name: "" }, "POST"));
    expect(response.status).toBe(400);
  });

  it("returns 201 with created workspace for valid request", async () => {
    mockCreateWorkspace.mockResolvedValue(baseWorkspace);
    const handler = createWorkspacesPostHandler(makeAuthResolver());
    const response = await handler(makeRequest({ name: "New Workspace" }, "POST"));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe("ws-1");
    expect(body.name).toBe("Test Workspace");
  });

  it("uses trusted userId from auth, ignores client userId in body", async () => {
    mockCreateWorkspace.mockResolvedValue(baseWorkspace);
    const handler = createWorkspacesPostHandler(makeAuthResolver("alice"));
    await handler(makeRequest({ name: "test", userId: "attacker" }, "POST"));
    expect(mockCreateWorkspace).toHaveBeenCalledWith(
      { userId: "alice", email: "alice@test.example" },
      expect.not.objectContaining({ userId: expect.anything() })
    );
  });

  it("returns 503 when Firestore emulator is unavailable", async () => {
    mockCreateWorkspace.mockRejectedValue(new Error("down"));
    mockIsUnavailableError.mockReturnValue(true);
    const handler = createWorkspacesPostHandler(makeAuthResolver());
    const response = await handler(makeRequest({ name: "test" }, "POST"));
    expect(response.status).toBe(503);
  });
});

// ── GET /api/workspaces/[workspaceId] ──────────────────────────────────────

describe("GET /api/workspaces/[workspaceId]", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createWorkspaceByIdGetHandler(makeFailingAuthResolver());
    const [req, ctx] = makeByIdRequest("ws-1");
    const response = await handler(req, ctx);
    expect(response.status).toBe(401);
  });

  it("returns 200 with workspace when found", async () => {
    mockGetWorkspace.mockResolvedValue(baseWorkspace);
    const handler = createWorkspaceByIdGetHandler(makeAuthResolver());
    const [req, ctx] = makeByIdRequest("ws-1");
    const response = await handler(req, ctx);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("ws-1");
    expect(mockGetWorkspace).toHaveBeenCalledWith({ userId: "alice", email: "alice@test.example" }, "ws-1");
  });

  it("returns 404 when workspace not found", async () => {
    mockGetWorkspace.mockResolvedValue(null);
    const handler = createWorkspaceByIdGetHandler(makeAuthResolver());
    const [req, ctx] = makeByIdRequest("does-not-exist");
    const response = await handler(req, ctx);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Workspace not found." });
  });

  it("returns 404 for cross-user access (repository returns null for wrong owner)", async () => {
    mockGetWorkspace.mockResolvedValue(null);
    const handler = createWorkspaceByIdGetHandler(makeAuthResolver("bob"));
    const [req, ctx] = makeByIdRequest("ws-1");
    const response = await handler(req, ctx);
    expect(response.status).toBe(404);
    expect(mockGetWorkspace).toHaveBeenCalledWith({ userId: "bob", email: "bob@test.example" }, "ws-1");
  });

  it("returns 503 when Firestore emulator is unavailable", async () => {
    mockGetWorkspace.mockRejectedValue(new Error("down"));
    mockIsUnavailableError.mockReturnValue(true);
    const handler = createWorkspaceByIdGetHandler(makeAuthResolver());
    const [req, ctx] = makeByIdRequest("ws-1");
    const response = await handler(req, ctx);
    expect(response.status).toBe(503);
  });
});
