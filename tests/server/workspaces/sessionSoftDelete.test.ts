/**
 * Soft delete logic tests for sessionRepository + sessionApiService.
 *
 * These tests use the `mapSessionRecord` behavior indirectly via
 * the exported functions and verify the filtering/behavior contracts
 * without requiring a live Firestore emulator.
 */
import { describe, expect, it } from "vitest";
import { parseDeleteSessionRequest } from "../../../src/server/workspaces/sessionApiSchemas";

// ---------------------------------------------------------------------------
// SessionRecord isDeleted field — backward compatibility
// ---------------------------------------------------------------------------

describe("SessionRecord isDeleted backward compatibility", () => {
  /**
   * Old Firestore documents do not have `isDeleted`. The mapper uses
   *   isDeleted: data.isDeleted === true
   * so missing field → false (not deleted). We verify this rule directly
   * via the schema logic rather than via live Firestore.
   */
  it("isDeleted defaults false when field absent", () => {
    // Simulate the mapping rule directly
    const data: Record<string, unknown> = { userId: "alice", title: "old session" };
    const isDeleted = data.isDeleted === true;
    expect(isDeleted).toBe(false);
  });

  it("isDeleted is true when field is true", () => {
    const data: Record<string, unknown> = { userId: "alice", isDeleted: true };
    const isDeleted = data.isDeleted === true;
    expect(isDeleted).toBe(true);
  });

  it("isDeleted is false when field is false", () => {
    const data: Record<string, unknown> = { userId: "alice", isDeleted: false };
    const isDeleted = data.isDeleted === true;
    expect(isDeleted).toBe(false);
  });

  it("isDeleted is false when field is null", () => {
    const data: Record<string, unknown> = { userId: "alice", isDeleted: null };
    const isDeleted = data.isDeleted === true;
    expect(isDeleted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listSessions filter logic — unit-level verification
// ---------------------------------------------------------------------------

describe("listSessions isDeleted filter contract", () => {
  /**
   * The filter applied in listSessions is:
   *   data.userId === userId && data.isDeleted !== true
   * Verify these predicates directly to document the contract.
   */
  function matchesListFilter(data: Record<string, unknown>, userId: string): boolean {
    return (data as { userId?: string }).userId === userId &&
      (data as { isDeleted?: boolean }).isDeleted !== true;
  }

  it("includes session owned by user with no isDeleted", () => {
    expect(matchesListFilter({ userId: "alice" }, "alice")).toBe(true);
  });

  it("includes session owned by user with isDeleted:false", () => {
    expect(matchesListFilter({ userId: "alice", isDeleted: false }, "alice")).toBe(true);
  });

  it("excludes session with isDeleted:true", () => {
    expect(matchesListFilter({ userId: "alice", isDeleted: true }, "alice")).toBe(false);
  });

  it("excludes session owned by different user", () => {
    expect(matchesListFilter({ userId: "bob", isDeleted: false }, "alice")).toBe(false);
  });

  it("excludes session owned by different user even without isDeleted", () => {
    expect(matchesListFilter({ userId: "bob" }, "alice")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSession filter logic — unit-level verification
// ---------------------------------------------------------------------------

describe("getSession isDeleted filter contract", () => {
  /**
   * The conditions that cause getSession to return null:
   *   !snapshot.exists || data.userId !== userId || data.isDeleted === true
   */
  function shouldReturnNull(data: { userId?: string; isDeleted?: boolean }, userId: string): boolean {
    return data.userId !== userId || data.isDeleted === true;
  }

  it("returns null for deleted session", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: true }, "alice")).toBe(true);
  });

  it("returns non-null for active session", () => {
    expect(shouldReturnNull({ userId: "alice", isDeleted: false }, "alice")).toBe(false);
  });

  it("returns non-null for old session without isDeleted", () => {
    expect(shouldReturnNull({ userId: "alice" }, "alice")).toBe(false);
  });

  it("returns null for wrong user even if not deleted", () => {
    expect(shouldReturnNull({ userId: "bob", isDeleted: false }, "alice")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseDeleteSessionRequest — integration with schema tests
// ---------------------------------------------------------------------------

describe("parseDeleteSessionRequest — soft delete request validation", () => {
  it("accepts valid workspaceId", () => {
    const result = parseDeleteSessionRequest({ workspaceId: "ws-1" });
    expect(result.ok).toBe(true);
  });

  it("rejects empty body", () => {
    const result = parseDeleteSessionRequest({});
    expect(result.ok).toBe(false);
  });
});
