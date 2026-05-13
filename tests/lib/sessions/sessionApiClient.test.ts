import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  fetchSessions,
  SessionApiError,
} from "../../../src/lib/sessions/sessionApiClient";
import type { SessionApiSession } from "../../../src/lib/sessions/sessionApiTypes";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const TOKEN = "test-bearer-token";

const sampleSession: SessionApiSession = {
  id: "session-1",
  workspaceId: "ws-1",
  title: "שיחה ראשונה",
  workMode: "Learning",
  costMode: "Normal Learning",
  activeTopic: "linear algebra",
  status: "active",
  startedAt: "2026-05-01T00:00:00.000Z",
  lastActiveAt: "2026-05-01T00:00:00.000Z",
};

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchSessions", () => {
  it("sends GET with Authorization header", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { sessions: [sampleSession] }));

    const result = await fetchSessions(TOKEN, "ws-1");

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sessions?workspaceId=ws-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });

  it("throws SessionApiError for missing token", async () => {
    await expect(fetchSessions("", "ws-1")).rejects.toThrow(SessionApiError);
    await expect(fetchSessions("", "ws-1")).rejects.toMatchObject({ status: 401 });
  });

  it("throws SessionApiError on non-OK response", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(401, { error: "Unauthorized." }));

    await expect(fetchSessions(TOKEN, "ws-1")).rejects.toThrow(SessionApiError);
    await expect(fetchSessions(TOKEN, "ws-1")).rejects.toMatchObject({ status: 401 });
  });
});

describe("createSession", () => {
  it("sends POST with Authorization header", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(201, { session: sampleSession }));

    await createSession(TOKEN, {
      workspaceId: "ws-1",
      title: "New session",
      workMode: "Learning",
      costMode: "Normal Learning",
      activeTopic: "vectors",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("does not send client userId in body", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(201, { session: sampleSession }));

    await createSession(
      TOKEN,
      {
        workspaceId: "ws-1",
        title: "No userId",
        userId: "attacker-uid",
      } as never
    );

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(options.body)) as Record<string, unknown>;

    expect(parsedBody.workspaceId).toBe("ws-1");
    expect(parsedBody).not.toHaveProperty("userId");
  });

  it("throws SessionApiError for missing token", async () => {
    await expect(createSession("", { workspaceId: "ws-1" })).rejects.toThrow(SessionApiError);
    await expect(createSession("", { workspaceId: "ws-1" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("throws fallback error when response is not JSON", async () => {
    mockFetch.mockResolvedValue(new Response("not-json", { status: 500 }));

    await expect(createSession(TOKEN, { workspaceId: "ws-1" })).rejects.toThrow(SessionApiError);
  });
});
