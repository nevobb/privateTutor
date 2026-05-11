import { describe, expect, it } from "vitest";
import { assertRequestUserMatchesAuthUser } from "../../../src/server/auth/assertRequestUserMatchesAuthUser";
import { extractBearerToken } from "../../../src/server/auth/extractBearerToken";
import { resolveAuthenticatedUser } from "../../../src/server/auth/resolveAuthenticatedUser";

function requestWithAuthorization(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/tutor", { headers });
}

describe("Firebase auth boundary helpers", () => {
  it("rejects a missing Authorization header", () => {
    const result = extractBearerToken(requestWithAuthorization());

    expect(result).toEqual({ ok: false, status: 401, error: { error: "Unauthorized." } });
  });

  it("rejects malformed Authorization headers", () => {
    expect(extractBearerToken(requestWithAuthorization("Token abc"))).toEqual({
      ok: false,
      status: 401,
      error: { error: "Unauthorized." },
    });
    expect(extractBearerToken(requestWithAuthorization("Bearer"))).toEqual({
      ok: false,
      status: 401,
      error: { error: "Unauthorized." },
    });
    expect(extractBearerToken(requestWithAuthorization("Bearer abc extra"))).toEqual({
      ok: false,
      status: 401,
      error: { error: "Unauthorized." },
    });
  });

  it("extracts a valid bearer token", () => {
    expect(extractBearerToken(requestWithAuthorization("Bearer local-token"))).toEqual({
      ok: true,
      token: "local-token",
    });
  });

  it("rejects invalid tokens through the injectable verifier", async () => {
    const result = await resolveAuthenticatedUser(requestWithAuthorization("Bearer bad-token"), async () => {
      throw new Error("invalid token");
    });

    expect(result).toEqual({ ok: false, status: 401, error: { error: "Unauthorized." } });
  });

  it("rejects verified tokens without a uid", async () => {
    const result = await resolveAuthenticatedUser(requestWithAuthorization("Bearer missing-uid"), async () => ({
      email: "alice@example.test",
    }));

    expect(result).toEqual({ ok: false, status: 401, error: { error: "Unauthorized." } });
  });

  it("resolves an authenticated user from a verified token", async () => {
    const result = await resolveAuthenticatedUser(requestWithAuthorization("Bearer good-token"), async () => ({
      uid: "alice",
      email: "alice@example.test",
      firebase: { sign_in_provider: "google.com" },
    }));

    expect(result).toEqual({
      ok: true,
      user: {
        userId: "alice",
        email: "alice@example.test",
        authProvider: "google.com",
      },
    });
  });

  it("allows matching or missing body userId", () => {
    const user = { userId: "alice" };

    expect(assertRequestUserMatchesAuthUser({ userId: "alice" }, user)).toEqual({ ok: true });
    expect(assertRequestUserMatchesAuthUser({ message: "hello" }, user)).toEqual({ ok: true });
  });

  it("rejects spoofed body userId", () => {
    const result = assertRequestUserMatchesAuthUser({ userId: "bob" }, { userId: "alice" });

    expect(result).toEqual({ ok: false, status: 403, error: { error: "Forbidden." } });
  });
});
