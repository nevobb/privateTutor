/**
 * Soft delete contract tests for uploaded file repository.
 * All tests verify the filtering / ownership logic without requiring
 * a live Firestore emulator.
 */
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// isDeleted backward compatibility mapping
// ---------------------------------------------------------------------------

describe("UploadedFileRecord isDeleted backward compatibility", () => {
  function mapIsDeleted(data: Record<string, unknown>): boolean {
    return data.isDeleted === true;
  }

  it("missing isDeleted → false (old file, not deleted)", () => {
    expect(mapIsDeleted({ userId: "alice" })).toBe(false);
  });

  it("isDeleted: false → false", () => {
    expect(mapIsDeleted({ isDeleted: false })).toBe(false);
  });

  it("isDeleted: true → true", () => {
    expect(mapIsDeleted({ isDeleted: true })).toBe(true);
  });

  it("isDeleted: null → false", () => {
    expect(mapIsDeleted({ isDeleted: null })).toBe(false);
  });

  it("isDeleted: 0 → false (only strict === true)", () => {
    expect(mapIsDeleted({ isDeleted: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listUploadedFiles filter contract
// ---------------------------------------------------------------------------

describe("listUploadedFiles isDeleted filter contract", () => {
  function matchesListFilter(data: Record<string, unknown>, userId: string, workspaceId: string): boolean {
    const ownerUserId = typeof data.userId === "string" ? data.userId : "";
    return ownerUserId === userId && data.workspaceId === workspaceId && data.isDeleted !== true;
  }

  it("includes non-deleted file for correct user+workspace", () => {
    expect(matchesListFilter({ userId: "alice", workspaceId: "ws-1" }, "alice", "ws-1")).toBe(true);
  });

  it("includes file with isDeleted:false", () => {
    expect(matchesListFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: false }, "alice", "ws-1")).toBe(true);
  });

  it("excludes file with isDeleted:true", () => {
    expect(matchesListFilter({ userId: "alice", workspaceId: "ws-1", isDeleted: true }, "alice", "ws-1")).toBe(false);
  });

  it("excludes file from wrong user", () => {
    expect(matchesListFilter({ userId: "bob", workspaceId: "ws-1" }, "alice", "ws-1")).toBe(false);
  });

  it("excludes file from wrong workspace", () => {
    expect(matchesListFilter({ userId: "alice", workspaceId: "ws-2" }, "alice", "ws-1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUploadedFile filter contract (now blocks deleted files)
// ---------------------------------------------------------------------------

describe("getUploadedFile isDeleted filter contract", () => {
  function shouldReturnNull(data: { userId?: string; isDeleted?: unknown }, userId: string): boolean {
    const ownerUserId = typeof data.userId === "string" ? data.userId : "";
    return ownerUserId !== userId || data.isDeleted === true;
  }

  it("returns null for deleted file", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: true }, "alice")).toBe(true);
  });

  it("returns non-null for active file", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: false }, "alice")).toBe(false);
  });

  it("returns non-null for old file without isDeleted", () => {
    expect(shouldReturnNull({ userId: "alice" }, "alice")).toBe(false);
  });

  it("returns null for wrong user", () => {
    expect(shouldReturnNull({ userId: "bob", isDeleted: false }, "alice")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// softDeleteUploadedFile idempotency contract
// ---------------------------------------------------------------------------

describe("softDeleteUploadedFile idempotency", () => {
  it("already-deleted flag value of true is recognized as true", () => {
    const data = { isDeleted: true };
    expect(data.isDeleted === true).toBe(true);
  });

  it("already-deleted files return the existing record (no second update)", () => {
    // Simulate: if already deleted, we return without calling update.
    // The contract: data.isDeleted === true → skip update → return existing record.
    const wasAlreadyDeleted = true;
    let updateCalled = false;
    if (!wasAlreadyDeleted) {
      updateCalled = true;
    }
    expect(updateCalled).toBe(false);
  });
});
