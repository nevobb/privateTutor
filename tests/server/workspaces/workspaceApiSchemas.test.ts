import { describe, expect, it } from "vitest";
import {
  toWorkspaceApiResponse,
  validateCreateWorkspaceRequest,
  validateMoveWorkspaceRequest,
} from "../../../src/server/workspaces/workspaceApiSchemas";
import type { WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";

describe("validateCreateWorkspaceRequest", () => {
  it("accepts minimal valid request with name only", () => {
    const result = validateCreateWorkspaceRequest({ name: "My Workspace" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.name).toBe("My Workspace");
      expect(result.input.description).toBeUndefined();
      expect(result.input.path).toBeUndefined();
    }
  });

  it("accepts full valid request with all fields", () => {
    const result = validateCreateWorkspaceRequest({
      name: "Full Workspace",
      description: "A full workspace",
      path: ["root", "math"],
      parentWorkspaceId: "parent-1",
      stableIdentityNote: "Keep stable.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.name).toBe("Full Workspace");
      expect(result.input.description).toBe("A full workspace");
      expect(result.input.path).toEqual(["root", "math"]);
      expect(result.input.parentWorkspaceId).toBe("parent-1");
      expect(result.input.stableIdentityNote).toBe("Keep stable.");
    }
  });

  it("trims whitespace from name", () => {
    const result = validateCreateWorkspaceRequest({ name: "  trimmed  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.name).toBe("trimmed");
    }
  });

  it("rejects null body", () => {
    const result = validateCreateWorkspaceRequest(null);
    expect(result.ok).toBe(false);
  });

  it("rejects array body", () => {
    const result = validateCreateWorkspaceRequest([{ name: "x" }]);
    expect(result.ok).toBe(false);
  });

  it("rejects missing name", () => {
    const result = validateCreateWorkspaceRequest({ description: "no name" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("name");
  });

  it("rejects empty name", () => {
    const result = validateCreateWorkspaceRequest({ name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("name");
  });

  it("rejects non-string name", () => {
    const result = validateCreateWorkspaceRequest({ name: 42 });
    expect(result.ok).toBe(false);
  });

  it("rejects non-string description", () => {
    const result = validateCreateWorkspaceRequest({ name: "ok", description: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("description");
  });

  it("rejects path with non-string items", () => {
    const result = validateCreateWorkspaceRequest({ name: "ok", path: ["root", 42] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("path");
  });

  it("rejects non-array path", () => {
    const result = validateCreateWorkspaceRequest({ name: "ok", path: "root/math" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("path");
  });

  it("rejects non-string parentWorkspaceId", () => {
    const result = validateCreateWorkspaceRequest({ name: "ok", parentWorkspaceId: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("parentWorkspaceId");
  });

  it("rejects non-string stableIdentityNote", () => {
    const result = validateCreateWorkspaceRequest({ name: "ok", stableIdentityNote: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("stableIdentityNote");
  });

  it("ignores client-supplied userId field", () => {
    // userId must never be read from client body — validation result has no userId field
    const result = validateCreateWorkspaceRequest({ name: "ok", userId: "attacker" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.input)).not.toContain("userId");
    }
  });
});

describe("toWorkspaceApiResponse", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  const record: WorkspaceRecord = {
    id: "ws-1",
    userId: "alice",
    name: "Test Workspace",
    description: "desc",
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    path: ["root"],
    currentPath: "root / Test Workspace",
    previousPaths: ["root / Old Workspace"],
    stableIdentityNote: "stable",
  };

  it("maps record fields to ISO strings", () => {
    const response = toWorkspaceApiResponse(record);
    expect(response.id).toBe("ws-1");
    expect(response.userId).toBe("alice");
    expect(response.name).toBe("Test Workspace");
    expect(response.status).toBe("active");
    expect(response.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(response.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(response.lastActivityAt).toBe("2026-01-01T00:00:00.000Z");
    expect(response.path).toEqual(["root"]);
    expect(response.currentPath).toBe("root / Test Workspace");
    expect(response.previousPaths).toEqual(["root / Old Workspace"]);
    expect(response.stableIdentityNote).toBe("stable");
  });

  it("omits optional fields when absent", () => {
    const minRecord: WorkspaceRecord = {
      id: "ws-2",
      userId: "bob",
      name: "Minimal",
      description: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const response = toWorkspaceApiResponse(minRecord);
    expect(response.path).toBeUndefined();
    expect(response.currentPath).toBeUndefined();
    expect(response.previousPaths).toBeUndefined();
    expect(response.lastSessionId).toBeUndefined();
    expect(response.lastActivityAt).toBeUndefined();
    expect(response.stableIdentityNote).toBeUndefined();
  });
});

describe("validateMoveWorkspaceRequest", () => {
  it("accepts a valid move request", () => {
    const result = validateMoveWorkspaceRequest({
      currentPath: " Year 1 / Semester B / Physics 2 ",
      parentWorkspaceId: "parent-1",
      stableIdentityNote: "keep identity",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.currentPath).toBe("Year 1 / Semester B / Physics 2");
      expect(result.input.parentWorkspaceId).toBe("parent-1");
      expect(result.input.stableIdentityNote).toBe("keep identity");
    }
  });

  it("normalizes dense separators and spaces", () => {
    const result = validateMoveWorkspaceRequest({
      currentPath: "  Year 1/  Semester B   /Physics 2  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.currentPath).toBe("Year 1 / Semester B / Physics 2");
    }
  });

  it("rejects missing currentPath", () => {
    const result = validateMoveWorkspaceRequest({});
    expect(result.ok).toBe(false);
  });

  it("rejects empty normalized currentPath", () => {
    const result = validateMoveWorkspaceRequest({ currentPath: " /  /  " });
    expect(result.ok).toBe(false);
  });

  it("rejects non-string parentWorkspaceId", () => {
    const result = validateMoveWorkspaceRequest({
      currentPath: "A / B",
      parentWorkspaceId: 7,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-string stableIdentityNote", () => {
    const result = validateMoveWorkspaceRequest({
      currentPath: "A / B",
      stableIdentityNote: false,
    });
    expect(result.ok).toBe(false);
  });
});
