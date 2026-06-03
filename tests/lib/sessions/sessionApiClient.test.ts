import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  createSession,
  deleteSession,
  fetchSessions,
  renameSession,
  SessionApiError,
} from "../../../src/lib/sessions/sessionApiClient";
import type { SessionApiSession } from "../../../src/lib/sessions/sessionApiTypes";

const CLIENT_FILE =
  "/Users/nevobiton/private-tutor-project/privateTutor/src/lib/sessions/sessionApiClient.ts";

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

describe("sessionApiClient — timeout budget", () => {
  it("REQUEST_TIMEOUT_MS is at least 25000 to avoid false late-success rename failures", () => {
    const source = readFileSync(CLIENT_FILE, "utf-8");
    const match = /const REQUEST_TIMEOUT_MS\s*=\s*(\d+)/.exec(source);

    expect(match, "REQUEST_TIMEOUT_MS constant must be defined in the source file").not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(25000);
  });
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

  it("fails fast with a safe message on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(fetchSessions(TOKEN, "ws-1")).rejects.toMatchObject({ status: 503 });
    await expect(fetchSessions(TOKEN, "ws-1")).rejects.toThrow("שירות השיחות לא הגיב בזמן. נסה שוב.");
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

  it("fails fast with a safe message on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(createSession(TOKEN, { workspaceId: "ws-1" })).rejects.toMatchObject({ status: 503 });
    await expect(createSession(TOKEN, { workspaceId: "ws-1" })).rejects.toThrow(
      "שירות השיחות לא הגיב בזמן. נסה שוב."
    );
  });
});

describe("renameSession", () => {
  it("sends PATCH with correct sessionId URL and Authorization header", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { session: sampleSession }));

    await renameSession(TOKEN, "sess-abc", { title: "New name", workspaceId: "ws-1" });

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sessions/sess-abc");
    expect(opts.method).toBe("PATCH");
    expect(opts.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("sends title and workspaceId in body", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { session: sampleSession }));

    await renameSession(TOKEN, "sess-1", { title: "My title", workspaceId: "ws-2" });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(opts.body)) as Record<string, unknown>;
    expect(body.title).toBe("My title");
    expect(body.workspaceId).toBe("ws-2");
  });

  it("returns updated session on success", async () => {
    const renamed = { ...sampleSession, title: "Renamed" };
    mockFetch.mockResolvedValue(makeJsonResponse(200, { session: renamed }));

    const result = await renameSession(TOKEN, "sess-1", { title: "Renamed", workspaceId: "ws-1" });

    expect(result.title).toBe("Renamed");
  });

  it("throws SessionApiError for empty token", async () => {
    await expect(
      renameSession("", "sess-1", { title: "X", workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 401 });
  });

  it("throws SessionApiError for empty sessionId", async () => {
    await expect(
      renameSession(TOKEN, "", { title: "X", workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws SessionApiError on 404", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(404, { error: "Session not found." }));

    await expect(
      renameSession(TOKEN, "sess-missing", { title: "X", workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(
      renameSession(TOKEN, "sess-1", { title: "X", workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("deleteSession", () => {
  it("sends DELETE to /api/sessions/{sessionId}", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { deleted: true, sessionId: "sess-1" }));

    await deleteSession(TOKEN, "sess-1", { workspaceId: "ws-1" });

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sessions/sess-1");
    expect(opts.method).toBe("DELETE");
    expect(opts.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("sends workspaceId in body", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { deleted: true, sessionId: "sess-1" }));

    await deleteSession(TOKEN, "sess-1", { workspaceId: "ws-2" });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(opts.body)) as Record<string, unknown>;
    expect(body.workspaceId).toBe("ws-2");
  });

  it("returns deleted:true on success", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { deleted: true, sessionId: "sess-x" }));

    const result = await deleteSession(TOKEN, "sess-x", { workspaceId: "ws-1" });
    expect(result.deleted).toBe(true);
    expect(result.sessionId).toBe("sess-x");
  });

  it("throws SessionApiError for empty token", async () => {
    await expect(
      deleteSession("", "sess-1", { workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 401 });
  });

  it("throws SessionApiError for empty sessionId", async () => {
    await expect(
      deleteSession(TOKEN, "", { workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws SessionApiError on 404", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(404, { error: "Session not found." }));

    await expect(
      deleteSession(TOKEN, "sess-missing", { workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(
      deleteSession(TOKEN, "sess-1", { workspaceId: "ws-1" })
    ).rejects.toMatchObject({ status: 503 });
  });
});
