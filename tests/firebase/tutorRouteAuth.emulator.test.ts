import { beforeAll, describe, expect, it } from "vitest";
import { createTutorPostHandler } from "../../src/app/api/tutor/route";
import { extractBearerToken } from "../../src/server/auth/extractBearerToken";
import type { AuthResult } from "../../src/server/auth/authTypes";
import {
  AUTH_EMULATOR_PROJECT_ID,
  assertAuthEmulatorRunning,
  createOrSignInAuthEmulatorUser,
} from "./authEmulatorTestUtils";

const AUTH_EMULATOR_TEST_ENABLED = process.env.FIREBASE_AUTH_EMULATOR_TEST === "1";
const describeAuthEmulator = AUTH_EMULATOR_TEST_ENABLED ? describe : describe.skip;

const baseBody = {
  workspaceId: "ws-1",
  sessionId: "session-1",
  message: "What is the theme?",
  workMode: "Learning",
  costMode: "Normal Learning",
  activeFileIds: ["f-1"],
};

function makeRequest(body: unknown, authorization?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== undefined) headers.set("authorization", authorization);

  return new Request("http://localhost/api/tutor", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describeAuthEmulator("POST /api/tutor auth boundary with the Auth Emulator", () => {
  let authToken = "";
  let authUserId = "";
  let postTutor: ReturnType<typeof createTutorPostHandler>;

  beforeAll(async () => {
    await assertAuthEmulatorRunning();
    const session = await createOrSignInAuthEmulatorUser();

    authUserId = session.localId;
    authToken = session.idToken;

    postTutor = createTutorPostHandler(async (request): Promise<AuthResult> => {
      const tokenResult = extractBearerToken(request);

      if (!tokenResult.ok || tokenResult.token !== authToken) {
        return {
          ok: false,
          status: 401,
          error: { error: "Unauthorized." },
        };
      }

      return {
        ok: true,
        user: {
          userId: authUserId,
          email: session.email,
          authProvider: "password",
        },
      };
    });
  });

  it("uses the local demo project ID only", () => {
    expect(AUTH_EMULATOR_PROJECT_ID).toBe("demo-private-tutor");
  });

  it("succeeds for a token-authenticated tutor request", async () => {
    const response = await postTutor(makeRequest({ ...baseBody, userId: authUserId }, `Bearer ${authToken}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message.role).toBe("tutor");
    expect(body.mockRouting.workMode).toBe("Learning");
  });

  it("returns 403 for a spoofed body userId", async () => {
    const response = await postTutor(makeRequest({ ...baseBody, userId: "spoofed-user" }, `Bearer ${authToken}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden." });
  });

  it("returns 401 when Authorization is missing", async () => {
    const response = await postTutor(makeRequest({ ...baseBody, userId: authUserId }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 401 when Authorization is malformed", async () => {
    const response = await postTutor(makeRequest({ ...baseBody, userId: authUserId }, `Token ${authToken}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 401 when Authorization is invalid", async () => {
    const response = await postTutor(makeRequest({ ...baseBody, userId: authUserId }, "Bearer bad-token"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });
});
