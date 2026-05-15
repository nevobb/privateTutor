import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchWorkspaces,
  createWorkspace,
  WorkspaceApiError,
} from "../../../src/lib/workspaces/workspaceApiClient";
import type { WorkspaceListItem } from "../../../src/lib/workspaces/workspaceApiTypes";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const TOKEN = "test-bearer-token";

const sampleWorkspace: WorkspaceListItem = {
  id: "ws-1",
  name: "Hebrew Literature",
  description: "Test workspace",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeCreatedResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, errorMessage: string): Response {
  return new Response(JSON.stringify({ error: errorMessage }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchWorkspaces", () => {
  it("returns workspace list on 200", async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ workspaces: [sampleWorkspace] }));

    const result = await fetchWorkspaces(TOKEN);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ws-1");
    expect(result[0].name).toBe("Hebrew Literature");
  });

  it("sends Authorization header", async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ workspaces: [] }));

    await fetchWorkspaces(TOKEN);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });

  it("returns empty array when no workspaces", async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ workspaces: [] }));

    const result = await fetchWorkspaces(TOKEN);

    expect(result).toHaveLength(0);
  });

  it("throws WorkspaceApiError on 401", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(401, "Unauthorized."));

    await expect(fetchWorkspaces(TOKEN)).rejects.toThrow(WorkspaceApiError);
    await expect(fetchWorkspaces(TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it("throws WorkspaceApiError on 503 with server message", async () => {
    mockFetch.mockResolvedValue(
      makeErrorResponse(503, "Firestore emulator is unavailable.")
    );

    await expect(fetchWorkspaces(TOKEN)).rejects.toThrow(
      "Firestore emulator is unavailable."
    );
  });

  it("uses fallback message when error body has no message", async () => {
    mockFetch.mockResolvedValue(
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })
    );

    await expect(fetchWorkspaces(TOKEN)).rejects.toThrow("שגיאה בטעינת המרחבים.");
  });

  it("fails fast with a safe message on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(fetchWorkspaces(TOKEN)).rejects.toMatchObject({ status: 503 });
    await expect(fetchWorkspaces(TOKEN)).rejects.toThrow("שירות הנושאים לא הגיב בזמן. נסה שוב.");
  });
});

describe("createWorkspace", () => {
  it("returns created workspace on 201", async () => {
    mockFetch.mockResolvedValue(makeCreatedResponse(sampleWorkspace));

    const result = await createWorkspace(TOKEN, { name: "Hebrew Literature" });

    expect(result.id).toBe("ws-1");
    expect(result.name).toBe("Hebrew Literature");
  });

  it("sends name in body", async () => {
    mockFetch.mockResolvedValue(makeCreatedResponse(sampleWorkspace));

    await createWorkspace(TOKEN, { name: "New Workspace" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/workspaces",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "New Workspace" }),
      })
    );
  });

  it("sends Authorization and Content-Type headers", async () => {
    mockFetch.mockResolvedValue(makeCreatedResponse(sampleWorkspace));

    await createWorkspace(TOKEN, { name: "Test" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("throws WorkspaceApiError on 400", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(400, "name is required."));

    await expect(createWorkspace(TOKEN, { name: "" })).rejects.toThrow(WorkspaceApiError);
    await expect(createWorkspace(TOKEN, { name: "" })).rejects.toMatchObject({ status: 400 });
  });

  it("throws WorkspaceApiError on 401", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(401, "Unauthorized."));

    await expect(createWorkspace(TOKEN, { name: "Test" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("uses fallback message when error body unparseable", async () => {
    mockFetch.mockResolvedValue(new Response("not-json", { status: 500 }));

    await expect(createWorkspace(TOKEN, { name: "Test" })).rejects.toThrow(
      "יצירת מרחב נכשלה."
    );
  });

  it("fails fast with a safe message on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(createWorkspace(TOKEN, { name: "Test" })).rejects.toMatchObject({ status: 503 });
    await expect(createWorkspace(TOKEN, { name: "Test" })).rejects.toThrow(
      "שירות הנושאים לא הגיב בזמן. נסה שוב."
    );
  });
});
