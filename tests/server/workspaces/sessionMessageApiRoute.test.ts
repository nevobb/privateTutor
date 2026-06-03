import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/sessionMessageApiService", () => ({
  isSessionMessageValidationError: vi.fn((error: unknown) => error instanceof Error && error.name === "SessionMessageValidationError"),
  sessionMessageApiService: {
    listMessagesForUser: vi.fn(),
    sendMessageForUser: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/sessionMessageApiSchemas", () => ({
  parseGetMessagesQuery: vi.fn(),
  parsePostMessageRequest: vi.fn(),
  serializeMessage: vi.fn((r: unknown) => r),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import {
  createMessagesGetHandler,
  createMessagesPostHandler,
} from "../../../src/app/api/sessions/[sessionId]/messages/route";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";
import {
  parseGetMessagesQuery,
  parsePostMessageRequest,
  serializeMessage,
} from "../../../src/server/workspaces/sessionMessageApiSchemas";
import {
  isSessionMessageValidationError,
  sessionMessageApiService,
} from "../../../src/server/workspaces/sessionMessageApiService";

const mockList = vi.mocked(sessionMessageApiService.listMessagesForUser);
const mockSend = vi.mocked(sessionMessageApiService.sendMessageForUser);
const mockParseGet = vi.mocked(parseGetMessagesQuery);
const mockParsePost = vi.mocked(parsePostMessageRequest);
const mockSerialize = vi.mocked(serializeMessage);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);
const mockIsValidationError = vi.mocked(isSessionMessageValidationError as unknown as (error: unknown) => boolean);

const okAuth =
  (userId = "alice"): ((req: Request) => Promise<AuthResult>) =>
  async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });

const failAuth =
  (): ((req: Request) => Promise<AuthResult>) =>
  async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });

function makeGetRequest(
  sessionId: string,
  workspaceId: string
): [Request, { params: Promise<{ sessionId: string }> }] {
  const url = `http://test/api/sessions/${sessionId}/messages?workspaceId=${workspaceId}`;
  return [new Request(url), { params: Promise.resolve({ sessionId }) }];
}

function makePostRequest(
  sessionId: string,
  body: unknown
): [Request, { params: Promise<{ sessionId: string }> }] {
  return [
    new Request(`http://test/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ sessionId }) },
  ];
}

const baseMessage = { id: "m1", role: "user", content: "hi" };
const postResponse = {
  userMessage: baseMessage,
  assistantMessage: { id: "m2", role: "tutor", content: "resp" },
  internalUpdate: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
  mockIsValidationError.mockImplementation((error: unknown) => error instanceof Error && error.name === "SessionMessageValidationError");
});

describe("GET /api/sessions/[sessionId]/messages", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createMessagesGetHandler(failAuth());
    const [req, ctx] = makeGetRequest("sess-1", "ws-1");
    const res = await handler(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 when query validation fails", async () => {
    mockParseGet.mockReturnValueOnce({ ok: false, error: "workspaceId is required." });
    const handler = createMessagesGetHandler(okAuth());
    const [req, ctx] = makeGetRequest("sess-1", "");
    const res = await handler(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockParseGet.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockList.mockRejectedValueOnce(new Error("Session not found."));
    const handler = createMessagesGetHandler(okAuth());
    const [req, ctx] = makeGetRequest("sess-1", "ws-1");
    const res = await handler(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 404 when workspace not found", async () => {
    mockParseGet.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockList.mockRejectedValueOnce(new Error("Workspace not found."));
    const handler = createMessagesGetHandler(okAuth());
    const [req, ctx] = makeGetRequest("sess-1", "ws-1");
    const res = await handler(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 200 with messages on success", async () => {
    mockParseGet.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockList.mockResolvedValueOnce([baseMessage] as never);
    mockSerialize.mockReturnValue(baseMessage as never);
    const handler = createMessagesGetHandler(okAuth());
    const [req, ctx] = makeGetRequest("sess-1", "ws-1");
    const res = await handler(req, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: unknown[] };
    expect(body.messages).toHaveLength(1);
  });

  it("returns 503 when Firestore unavailable", async () => {
    mockParseGet.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1" } });
    mockList.mockRejectedValueOnce(new Error("emulator unavailable"));
    mockIsUnavailable.mockReturnValueOnce(true);
    const handler = createMessagesGetHandler(okAuth());
    const [req, ctx] = makeGetRequest("sess-1", "ws-1");
    const res = await handler(req, ctx);
    expect(res.status).toBe(503);
  });
});

describe("POST /api/sessions/[sessionId]/messages", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createMessagesPostHandler(failAuth());
    const [req, ctx] = makePostRequest("sess-1", {});
    const res = await handler(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const handler = createMessagesPostHandler(okAuth());
    const req = new Request("http://test/api/sessions/sess-1/messages", {
      method: "POST",
      body: "not-json",
    });
    const ctx = { params: Promise.resolve({ sessionId: "sess-1" }) };
    const res = await handler(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body validation fails", async () => {
    mockParsePost.mockReturnValueOnce({ ok: false, error: "userMessage is required." });
    const handler = createMessagesPostHandler(okAuth());
    const [req, ctx] = makePostRequest("sess-1", { workspaceId: "ws-1" });
    const res = await handler(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockParsePost.mockReturnValueOnce({
      ok: true,
      input: {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      },
    });
    mockSend.mockRejectedValueOnce(new Error("Session not found."));
    const handler = createMessagesPostHandler(okAuth());
    const [req, ctx] = makePostRequest("sess-1", {});
    const res = await handler(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 201 with userMessage + assistantMessage + internalUpdate on success", async () => {
    mockParsePost.mockReturnValueOnce({
      ok: true,
      input: {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      },
    });
    mockSend.mockResolvedValueOnce(postResponse as never);
    const handler = createMessagesPostHandler(okAuth());
    const [req, ctx] = makePostRequest("sess-1", {});
    const res = await handler(req, ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as typeof postResponse;
    expect(body.userMessage).toBeDefined();
    expect(body.assistantMessage).toBeDefined();
    expect(body.internalUpdate).toBeDefined();
  });

  it("returns 400 when attachment validation fails", async () => {
    mockParsePost.mockReturnValueOnce({
      ok: true,
      input: {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
        attachedFileIds: ["file-1"],
      },
    });
    const error = new Error('Attached file "file-1" does not belong to the current workspace.');
    error.name = "SessionMessageValidationError";
    mockSend.mockRejectedValueOnce(error);
    const handler = createMessagesPostHandler(okAuth());
    const [req, ctx] = makePostRequest("sess-1", {});
    const res = await handler(req, ctx);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Attached file "file-1" does not belong to the current workspace.',
    });
  });
});
