import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SESSION_API_SERVICE_FILE = resolve(process.cwd(), "src/server/workspaces/sessionApiService.ts");
const hasSessionApiService = existsSync(SESSION_API_SERVICE_FILE);
const describeSessionApiService = hasSessionApiService ? describe : describe.skip;

type SessionApiServiceModule = {
  createSessionApiService: (
    repositories?: {
      getWorkspace: (userId: string, workspaceId: string) => Promise<Record<string, unknown> | null>;
      createSession: (userId: string, workspaceId: string, input?: Record<string, unknown>) => Promise<Record<string, unknown>>;
      listSessions?: (userId: string, workspaceId: string) => Promise<Record<string, unknown>[]>;
    }
  ) => {
    createSessionForUser: (userId: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    listSessionsForUser: (userId: string, workspaceId: string) => Promise<Record<string, unknown>[]>;
  };
};

let sessionApiServiceModule: SessionApiServiceModule;

describeSessionApiService("sessionApiService", () => {
  beforeAll(async () => {
    sessionApiServiceModule = (await import("../../../src/server/workspaces/sessionApiService")) as unknown as SessionApiServiceModule;
  });

  it("createSessionForUser uses trusted userId and checks ownership before creating", async () => {
    const getWorkspace = vi.fn(async (userId: string, workspaceId: string) =>
      userId === "alice" && workspaceId === "ws-1"
        ? { id: "ws-1", userId: "alice", name: "Alice workspace" }
        : null
    );

    const createSession = vi.fn(async (userId: string, workspaceId: string, input?: Record<string, unknown>) => ({
      id: "s-1",
      workspaceId,
      userId,
      title: String(input?.title ?? "Untitled"),
      status: "active",
      startedAt: new Date("2026-05-13T00:00:00.000Z"),
      lastActiveAt: new Date("2026-05-13T00:00:00.000Z"),
      workMode: "Learning",
      costMode: "Normal Learning",
    }));

    const service = sessionApiServiceModule.createSessionApiService({ getWorkspace, createSession });

    await service.createSessionForUser("alice", {
      workspaceId: "ws-1",
      title: "Session title",
      userId: "attacker",
    });

    expect(getWorkspace).toHaveBeenCalledWith("alice", "ws-1");
    expect(createSession).toHaveBeenCalledWith(
      "alice",
      "ws-1",
      expect.objectContaining({ title: "Session title" })
    );
    expect(createSession).not.toHaveBeenCalledWith("attacker", expect.anything(), expect.anything());
  });

  it("createSessionForUser throws when workspace is missing for user", async () => {
    const getWorkspace = vi.fn(async () => null);
    const createSession = vi.fn();
    const service = sessionApiServiceModule.createSessionApiService({ getWorkspace, createSession });

    await expect(
      service.createSessionForUser("alice", {
        workspaceId: "missing-workspace",
      })
    ).rejects.toThrow("Workspace not found");

    expect(createSession).not.toHaveBeenCalled();
  });

  it("listSessionsForUser returns sessions for owned workspace", async () => {
    const getWorkspace = vi.fn(async (userId: string, workspaceId: string) =>
      userId === "alice" && workspaceId === "ws-1"
        ? { id: "ws-1", userId: "alice", name: "Alice workspace" }
        : null
    );

    const listSessions = vi.fn(async (userId: string, workspaceId: string) => [
      {
        id: "s-1",
        userId,
        workspaceId,
        title: "Session 1",
        status: "active",
        startedAt: new Date("2026-05-13T00:00:00.000Z"),
        lastActiveAt: new Date("2026-05-13T00:05:00.000Z"),
      },
    ]);

    const service = sessionApiServiceModule.createSessionApiService({
      getWorkspace,
      createSession: vi.fn(),
      listSessions,
    });

    const result = await service.listSessionsForUser("alice", "ws-1");

    expect(getWorkspace).toHaveBeenCalledWith("alice", "ws-1");
    expect(listSessions).toHaveBeenCalledWith("alice", "ws-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s-1");
  });

  it("listSessionsForUser throws when workspace is not owned by user", async () => {
    const getWorkspace = vi.fn(async () => null);
    const listSessions = vi.fn();

    const service = sessionApiServiceModule.createSessionApiService({
      getWorkspace,
      createSession: vi.fn(),
      listSessions,
    });

    await expect(service.listSessionsForUser("bob", "ws-alice")).rejects.toThrow("Workspace not found");
    expect(listSessions).not.toHaveBeenCalled();
  });
});
