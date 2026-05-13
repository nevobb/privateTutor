import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSessionsGetHandler,
  createSessionsPostHandler,
} from "../../../src/app/api/sessions/route";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/sessionApiService", () => ({
  sessionApiService: {
    createSessionForUser: vi.fn(),
    listSessionsForUser: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/sessionApiSchemas", () => ({
  parseCreateSessionRequest: vi.fn(),
  parseListSessionsQuery: vi.fn(),
  serializeSession: vi.fn(),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";
import {
  parseCreateSessionRequest,
  parseListSessionsQuery,
  serializeSession,
} from "../../../src/server/workspaces/sessionApiSchemas";
import { sessionApiService } from "../../../src/server/workspaces/sessionApiService";

const mockCreateSession = vi.mocked(sessionApiService.createSessionForUser);
const mockListSessions = vi.mocked(sessionApiService.listSessionsForUser);
const mockParseCreateSessionRequest = vi.mocked(parseCreateSessionRequest);
const mockParseListSessionsQuery = vi.mocked(parseListSessionsQuery);
const mockSerializeSession = vi.mocked(serializeSession);
const mockIsUnavailableError = vi.mocked(isFirestoreEmulatorUnavailableError);

const baseSession = {
  id: "sess-1",
  workspaceId: "ws-1",
  title: "My Session",
  workMode: "Learning",
  costMode: "Normal Learning",
  status: "active",
  startedAt: new Date("2026-05-13T12:00:00.000Z"),
  lastActiveAt: new Date("2026-05-13T12:00:00.000Z"),
};

const serializedSession = {
  ...baseSession,
  startedAt: "2026-05-13T12:00:00.000Z",
  lastActiveAt: "2026-05-13T12:00:00.000Z",
};

function makeAuthResolver(userId = "alice"): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function makeFailingAuthResolver(status: 401 | 403 = 401): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: false, status, error: { error: "Unauthorized." } });
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(query = "workspaceId=ws-1"): Request {
  return new Request(`http://localhost/api/sessions?${query}`, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailableError.mockReturnValue(false);
  mockSerializeSession.mockReturnValue(serializedSession);
});

describe("POST /api/sessions", () => {
  it("returns 400 for invalid JSON", async () => {
    const handler = createSessionsPostHandler(makeAuthResolver());
    const response = await handler(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("returns 401 when auth fails", async () => {
    const handler = createSessionsPostHandler(makeFailingAuthResolver());
    const response = await handler(makePostRequest({ workspaceId: "ws-1" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 400 when request body fails schema parsing", async () => {
    mockParseCreateSessionRequest.mockReturnValue({
      ok: false,
      error: "workspaceId is required and must be a non-empty string.",
    });

    const handler = createSessionsPostHandler(makeAuthResolver());
    const response = await handler(makePostRequest({ title: "No workspace id" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "workspaceId is required and must be a non-empty string.",
    });
  });

  it("returns 201 with created session for valid request", async () => {
    mockParseCreateSessionRequest.mockReturnValue({
      ok: true,
      input: {
        workspaceId: "ws-1",
        title: "My Session",
        workMode: "Learning",
        costMode: "Normal Learning",
      },
    });
    mockCreateSession.mockResolvedValue(baseSession as never);

    const handler = createSessionsPostHandler(makeAuthResolver("alice"));
    const response = await handler(
      makePostRequest({
        workspaceId: "ws-1",
        title: "My Session",
        workMode: "Learning",
        costMode: "Normal Learning",
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ session: serializedSession });
    expect(mockCreateSession).toHaveBeenCalledWith(
      { userId: "alice", email: "alice@test.example" },
      expect.objectContaining({ workspaceId: "ws-1" })
    );
  });

  it("uses trusted auth user and strips client userId before service call", async () => {
    mockParseCreateSessionRequest.mockReturnValue({
      ok: true,
      input: {
        workspaceId: "ws-1",
        title: "Trusted User Session",
        userId: "attacker",
      },
    });
    mockCreateSession.mockResolvedValue(baseSession as never);

    const handler = createSessionsPostHandler(makeAuthResolver("alice"));
    const response = await handler(
      makePostRequest({
        workspaceId: "ws-1",
        title: "Trusted User Session",
        userId: "attacker",
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateSession).toHaveBeenCalledWith(
      { userId: "alice", email: "alice@test.example" },
      expect.not.objectContaining({ userId: expect.anything() })
    );
  });

  it("returns 404 when workspace does not exist for user", async () => {
    mockParseCreateSessionRequest.mockReturnValue({
      ok: true,
      input: { workspaceId: "missing-workspace" },
    });
    mockCreateSession.mockRejectedValue(new Error("Workspace not found."));

    const handler = createSessionsPostHandler(makeAuthResolver("alice"));
    const response = await handler(makePostRequest({ workspaceId: "missing-workspace" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Workspace not found." });
  });

  it("returns 503 when Firestore emulator is unavailable", async () => {
    mockParseCreateSessionRequest.mockReturnValue({
      ok: true,
      input: { workspaceId: "ws-1" },
    });
    mockCreateSession.mockRejectedValue(new Error("down"));
    mockIsUnavailableError.mockReturnValue(true);

    const handler = createSessionsPostHandler(makeAuthResolver("alice"));
    const response = await handler(makePostRequest({ workspaceId: "ws-1" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Firestore emulator is unavailable." });
  });
});

describe("GET /api/sessions", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createSessionsGetHandler(makeFailingAuthResolver());
    const response = await handler(makeGetRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 400 when query fails schema parsing", async () => {
    mockParseListSessionsQuery.mockReturnValue({
      ok: false,
      error: "workspaceId query parameter is required.",
    });

    const handler = createSessionsGetHandler(makeAuthResolver());
    const response = await handler(makeGetRequest(""));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "workspaceId query parameter is required." });
  });

  it("returns 200 with sessions for owned workspace", async () => {
    mockParseListSessionsQuery.mockReturnValue({
      ok: true,
      input: { workspaceId: "ws-1" },
    });
    mockListSessions.mockResolvedValue([baseSession] as never);

    const handler = createSessionsGetHandler(makeAuthResolver("alice"));
    const response = await handler(makeGetRequest("workspaceId=ws-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sessions: [serializedSession] });
    expect(mockListSessions).toHaveBeenCalledWith({ userId: "alice", email: "alice@test.example" }, "ws-1");
  });

  it("ignores client userId query and uses trusted auth user", async () => {
    mockParseListSessionsQuery.mockReturnValue({
      ok: true,
      input: { workspaceId: "ws-1", userId: "attacker" },
    });
    mockListSessions.mockResolvedValue([] as never);

    const handler = createSessionsGetHandler(makeAuthResolver("alice"));
    const response = await handler(makeGetRequest("workspaceId=ws-1&userId=attacker"));

    expect(response.status).toBe(200);
    expect(mockListSessions).toHaveBeenCalledWith({ userId: "alice", email: "alice@test.example" }, "ws-1");
  });

  it("returns 404 when workspace is missing", async () => {
    mockParseListSessionsQuery.mockReturnValue({
      ok: true,
      input: { workspaceId: "missing-workspace" },
    });
    mockListSessions.mockRejectedValue(new Error("Workspace not found."));

    const handler = createSessionsGetHandler(makeAuthResolver());
    const response = await handler(makeGetRequest("workspaceId=missing-workspace"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Workspace not found." });
  });

  it("returns 503 when Firestore emulator is unavailable", async () => {
    mockParseListSessionsQuery.mockReturnValue({
      ok: true,
      input: { workspaceId: "ws-1" },
    });
    mockListSessions.mockRejectedValue(new Error("down"));
    mockIsUnavailableError.mockReturnValue(true);

    const handler = createSessionsGetHandler(makeAuthResolver());
    const response = await handler(makeGetRequest("workspaceId=ws-1"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Firestore emulator is unavailable." });
  });
});
