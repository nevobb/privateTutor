import { AuthenticatedUser, UserIdMatchResult } from "./authTypes";

const FORBIDDEN = { error: "Forbidden." };

function hasUserId(value: unknown): value is { userId?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertRequestUserMatchesAuthUser(input: unknown, user: AuthenticatedUser): UserIdMatchResult {
  if (!hasUserId(input) || input.userId === undefined) {
    return { ok: true };
  }

  if (typeof input.userId === "string" && input.userId === user.userId) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: FORBIDDEN,
  };
}
