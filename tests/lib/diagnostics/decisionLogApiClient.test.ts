import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DecisionLogApiError,
  fetchDecisionLogEntries,
} from "../../../src/lib/diagnostics/decisionLogApiClient";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("decisionLogApiClient", () => {
  it("calls decision-log endpoint with workspace/session/limit", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [{ id: "d1", decisionType: "model_provider", title: "t", decision: "x", rationale: "r", date: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z" }] }), { status: 200 })
    );

    const entries = await fetchDecisionLogEntries("tok-1", {
      workspaceId: "ws-1",
      sessionId: "s-1",
      limit: 10,
    });

    expect(entries).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/decision-log?workspaceId=ws-1&sessionId=s-1&limit=10",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer tok-1" }),
      })
    );
  });

  it("uses default limit=20", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    await fetchDecisionLogEntries("tok-1", { workspaceId: "ws-1", sessionId: "s-1" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("limit=20");
  });

  it("throws DecisionLogApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "failed" }), { status: 500 }));
    await expect(
      fetchDecisionLogEntries("tok-1", { workspaceId: "ws-1", sessionId: "s-1" })
    ).rejects.toMatchObject({ status: 500, message: "failed" });
  });

  it("fails fast with safe timeout message", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));
    await expect(
      fetchDecisionLogEntries("tok-1", { workspaceId: "ws-1", sessionId: "s-1" })
    ).rejects.toMatchObject({ status: 503 });
  });

  it("validates input fields", async () => {
    await expect(
      fetchDecisionLogEntries("", { workspaceId: "ws-1", sessionId: "s-1" })
    ).rejects.toBeInstanceOf(DecisionLogApiError);
    await expect(
      fetchDecisionLogEntries("tok-1", { workspaceId: "", sessionId: "s-1" })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      fetchDecisionLogEntries("tok-1", { workspaceId: "ws-1", sessionId: "s-1", limit: 999 })
    ).rejects.toMatchObject({ status: 400 });
  });
});
