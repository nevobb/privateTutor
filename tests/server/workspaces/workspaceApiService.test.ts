import { describe, expect, it, vi } from "vitest";
import { createWorkspaceApiService } from "../../../src/server/workspaces/workspaceApiService";
import type { WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";

const alice: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const bob: AuthenticatedUser = { userId: "bob", email: "bob@test.example" };

const aliceWorkspace: WorkspaceRecord = {
  id: "ws-alice-1",
  userId: "alice",
  name: "Alice's Workspace",
  description: "",
  status: "active",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const bobWorkspace: WorkspaceRecord = {
  id: "ws-bob-1",
  userId: "bob",
  name: "Bob's Workspace",
  description: "",
  status: "active",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function makeRepositories(overrides: Partial<{
  createWorkspace: (userId: string, input: { name: string }) => Promise<WorkspaceRecord>;
  listWorkspaces: (userId: string) => Promise<WorkspaceRecord[]>;
  getWorkspace: (userId: string, workspaceId: string) => Promise<WorkspaceRecord | null>;
}> = {}) {
  return {
    createWorkspace: vi.fn(async (userId: string) =>
      userId === "alice" ? aliceWorkspace : bobWorkspace
    ),
    listWorkspaces: vi.fn(async (userId: string) =>
      userId === "alice" ? [aliceWorkspace] : []
    ),
    getWorkspace: vi.fn(async (userId: string, workspaceId: string) =>
      userId === "alice" && workspaceId === "ws-alice-1" ? aliceWorkspace : null
    ),
    ...overrides,
  };
}

describe("workspaceApiService.createWorkspaceForUser", () => {
  it("passes trusted userId from auth, not from client body", async () => {
    const repos = makeRepositories();
    const service = createWorkspaceApiService(repos);

    await service.createWorkspaceForUser(alice, { name: "Test" });

    expect(repos.createWorkspace).toHaveBeenCalledWith("alice", expect.objectContaining({ name: "Test" }));
    expect(repos.createWorkspace).not.toHaveBeenCalledWith("bob", expect.anything());
  });

  it("returns created workspace record", async () => {
    const service = createWorkspaceApiService(makeRepositories());
    const result = await service.createWorkspaceForUser(alice, { name: "New" });
    expect(result.id).toBe("ws-alice-1");
    expect(result.userId).toBe("alice");
  });
});

describe("workspaceApiService.listWorkspacesForUser", () => {
  it("queries by trusted userId", async () => {
    const repos = makeRepositories();
    const service = createWorkspaceApiService(repos);

    await service.listWorkspacesForUser(alice);

    expect(repos.listWorkspaces).toHaveBeenCalledWith("alice");
  });

  it("returns only owner's workspaces", async () => {
    const service = createWorkspaceApiService(makeRepositories());
    const result = await service.listWorkspacesForUser(alice);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("alice");
  });

  it("bob gets empty list when no workspaces", async () => {
    const service = createWorkspaceApiService(makeRepositories());
    const result = await service.listWorkspacesForUser(bob);
    expect(result).toHaveLength(0);
  });
});

describe("workspaceApiService.getWorkspaceForUser", () => {
  it("queries by trusted userId and workspaceId", async () => {
    const repos = makeRepositories();
    const service = createWorkspaceApiService(repos);

    await service.getWorkspaceForUser(alice, "ws-alice-1");

    expect(repos.getWorkspace).toHaveBeenCalledWith("alice", "ws-alice-1");
  });

  it("returns workspace when found", async () => {
    const service = createWorkspaceApiService(makeRepositories());
    const result = await service.getWorkspaceForUser(alice, "ws-alice-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("ws-alice-1");
  });

  it("returns null when not found for owner", async () => {
    const service = createWorkspaceApiService(makeRepositories());
    const result = await service.getWorkspaceForUser(alice, "does-not-exist");
    expect(result).toBeNull();
  });

  it("returns null when accessed by non-owner (repository enforces ownership)", async () => {
    const service = createWorkspaceApiService(makeRepositories());
    const result = await service.getWorkspaceForUser(bob, "ws-alice-1");
    expect(result).toBeNull();
  });
});
