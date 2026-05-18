import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/workspaceApiService", () => ({
  workspaceApiService: {
    moveWorkspaceForUser: vi.fn(),
  },
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createWorkspaceMovePostHandler } from "../../../src/app/api/workspaces/[workspaceId]/move/route";
import { workspaceApiService } from "../../../src/server/workspaces/workspaceApiService";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockMove = vi.mocked(workspaceApiService.moveWorkspaceForUser);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);

const okAuth =
  (userId = "alice"): ((req: Request) => Promise<AuthResult>) =>
  async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });

const failAuth =
  (): ((req: Request) => Promise<AuthResult>) =>
  async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });

const context = (workspaceId: string) => ({ params: Promise.resolve({ workspaceId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("POST /api/workspaces/[workspaceId]/move", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createWorkspaceMovePostHandler(failAuth());
    const res = await handler(
      new Request("http://test/api/workspaces/ws-1/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "A / B" }),
      }),
      context("ws-1")
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid json", async () => {
    const handler = createWorkspaceMovePostHandler(okAuth());
    const res = await handler(
      new Request("http://test/api/workspaces/ws-1/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad",
      }),
      context("ws-1")
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid move payload", async () => {
    const handler = createWorkspaceMovePostHandler(okAuth());
    const res = await handler(
      new Request("http://test/api/workspaces/ws-1/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "   /  " }),
      }),
      context("ws-1")
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when workspace not found (including cross-user)", async () => {
    mockMove.mockResolvedValueOnce(null);

    const handler = createWorkspaceMovePostHandler(okAuth("bob"));
    const res = await handler(
      new Request("http://test/api/workspaces/ws-1/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "Year 1 / Semester B / Physics 2" }),
      }),
      context("ws-1")
    );

    expect(res.status).toBe(404);
    expect(mockMove).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bob" }),
      "ws-1",
      expect.objectContaining({ currentPath: "Year 1 / Semester B / Physics 2" })
    );
  });

  it("returns 503 when firestore emulator is unavailable", async () => {
    mockMove.mockRejectedValueOnce(new Error("down"));
    mockIsUnavailable.mockReturnValueOnce(true);

    const handler = createWorkspaceMovePostHandler(okAuth());
    const res = await handler(
      new Request("http://test/api/workspaces/ws-1/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "Year 1 / Semester B / Physics 2" }),
      }),
      context("ws-1")
    );

    expect(res.status).toBe(503);
  });

  it("returns 200 with unchanged id and normalized move fields", async () => {
    mockMove.mockResolvedValueOnce({
      id: "ws-1",
      userId: "alice",
      name: "Physics 2",
      description: "",
      status: "active",
      currentPath: "Year 1 / Semester B / Physics 2",
      previousPaths: ["Year 1 / Physics 2"],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-01-02T00:00:00.000Z"),
    } as never);

    const handler = createWorkspaceMovePostHandler(okAuth());
    const res = await handler(
      new Request("http://test/api/workspaces/ws-1/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: " Year 1/ Semester B /Physics 2 " }),
      }),
      context("ws-1")
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      currentPath?: string;
      previousPaths?: string[];
    };
    expect(body.id).toBe("ws-1");
    expect(body.currentPath).toBe("Year 1 / Semester B / Physics 2");
    expect(body.previousPaths).toEqual(["Year 1 / Physics 2"]);
  });
});
