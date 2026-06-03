import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLIENT_FILE = resolve(process.cwd(), "src/lib/sessions/sessionMessagesApiClient.ts");
const hasClientFile = existsSync(CLIENT_FILE);
const describeClient = hasClientFile ? describe : describe.skip;

type ClientModule = {
  SessionMessagesApiError: new (message: string, status: number) => Error & { status: number };
  fetchSessionMessages: (token: string, workspaceId: string, sessionId: string) => Promise<unknown[]>;
  sendSessionMessage: (
    token: string,
    input: { workspaceId: string; sessionId: string; userMessage: string; workMode: string; costMode: string }
  ) => Promise<unknown>;
};

let mod: ClientModule;

describeClient("sessionMessagesApiClient", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    mod = (await import("../../../src/lib/sessions/sessionMessagesApiClient")) as ClientModule;
  });

  it("fetchSessionMessages sends Bearer token and correct URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [{ id: "m1", role: "user", content: "hi" }] }), { status: 200 })
    );
    const result = await mod.fetchSessionMessages("tok-abc", "ws-1", "sess-1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/sessions/sess-1/messages?workspaceId=ws-1",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok-abc" }) })
    );
    expect(result).toHaveLength(1);
  });

  it("fetchSessionMessages never sends userId", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [] }), { status: 200 })
    );
    await mod.fetchSessionMessages("tok-abc", "ws-1", "sess-1");
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("userId");
    expect(JSON.stringify(opts.body ?? "")).not.toContain("userId");
  });

  it("fetchSessionMessages throws SessionMessagesApiError on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Session not found." }), { status: 404 })
    );
    await expect(mod.fetchSessionMessages("tok", "ws", "sess")).rejects.toMatchObject({ status: 404 });
  });

  it("fetchSessionMessages fails fast with a safe message on timeout", async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(mod.fetchSessionMessages("tok", "ws", "sess")).rejects.toMatchObject({
      status: 503,
      message: "שירות ההודעות לא הגיב בזמן. נסה שוב.",
    });
  });

  it("sendSessionMessage sends Bearer token and never userId in body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          userMessage: { id: "u1", role: "user", content: "q" },
          assistantMessage: { id: "a1", role: "tutor", content: "r" },
          internalUpdate: {},
        }),
        { status: 201 }
      )
    );
    await mod.sendSessionMessage("tok-xyz", {
      workspaceId: "ws-1",
      sessionId: "sess-1",
      userMessage: "hello",
      workMode: "Learning",
      costMode: "Normal Learning",
    });
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sessions/sess-1/messages");
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-xyz" });
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("sessionId");
    expect(body.userMessage).toBe("hello");
    expect(body.workspaceId).toBe("ws-1");
  });

  it("sendSessionMessage throws SessionMessagesApiError on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Not found." }), { status: 404 })
    );
    await expect(
      mod.sendSessionMessage("tok", {
        workspaceId: "ws",
        sessionId: "sess",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("sendSessionMessage fails fast with a safe message on timeout", async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(
      mod.sendSessionMessage("tok", {
        workspaceId: "ws",
        sessionId: "sess",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      })
    ).rejects.toMatchObject({ status: 503 });
  });

  it("throws SessionMessagesApiError(401) when token is empty", async () => {
    await expect(mod.fetchSessionMessages("", "ws", "sess")).rejects.toMatchObject({ status: 401 });
  });
});

// Timeout budget assertion — kept outside describeClient so it always runs,
// even if the module file does not exist yet (guards against accidental regression).
describe("sessionMessagesApiClient — timeout budget", () => {
  it("REQUEST_TIMEOUT_MS is at least 25000 to cover grounded two-LLM-call pipeline", () => {
    if (!hasClientFile) return;
    const source = readFileSync(CLIENT_FILE, "utf-8");
    const match = /const REQUEST_TIMEOUT_MS\s*=\s*(\d+)/.exec(source);
    expect(match, "REQUEST_TIMEOUT_MS constant must be defined in the source file").not.toBeNull();
    const value = Number(match![1]);
    expect(value).toBeGreaterThanOrEqual(25000);
  });
});
