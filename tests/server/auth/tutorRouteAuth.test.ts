import { describe, expect, it } from "vitest";
import { createTutorPostHandler } from "../../../src/app/api/tutor/route";
import { AuthResult } from "../../../src/server/auth/authTypes";

const baseBody = {
  userId: "alice",
  workspaceId: "ws-1",
  sessionId: "session-1",
  message: "What is the theme?",
  workMode: "Learning",
  costMode: "Normal Learning",
  activeFileIds: ["f-1"],
};

function postTutor(body: unknown, authorization?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== undefined) headers.set("authorization", authorization);

  return createTutorPostHandler(async (request): Promise<AuthResult> => {
    const auth = request.headers.get("authorization");

    if (auth !== "Bearer good-token") {
      return {
        ok: false,
        status: 401,
        error: { error: "Unauthorized." },
      };
    }

    return {
      ok: true,
      user: {
        userId: "alice",
        email: "alice@example.test",
        authProvider: "google.com",
      },
    };
  })(
    new Request("http://localhost/api/tutor", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/tutor auth boundary", () => {
  it("returns 400 for invalid JSON before auth resolution", async () => {
    const response = await createTutorPostHandler()(
      new Request("http://localhost/api/tutor", {
        method: "POST",
        headers: { authorization: "Bearer any-token" },
        body: "{",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("returns 401 when Authorization is missing", async () => {
    const response = await postTutor(baseBody);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 401 when Authorization is malformed", async () => {
    const response = await postTutor(baseBody, "Token bad-token");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 401 when token verification fails", async () => {
    const response = await postTutor(baseBody, "Bearer bad-token");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 200 for valid auth and matching body userId", async () => {
    const response = await postTutor(baseBody, "Bearer good-token");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message.role).toBe("tutor");
    expect(body.mockRouting.workMode).toBe("Learning");
  });

  it("returns 200 for valid auth and missing body userId by using trusted uid", async () => {
    const bodyWithoutUserId: Partial<typeof baseBody> = { ...baseBody };
    delete bodyWithoutUserId.userId;
    const response = await postTutor(bodyWithoutUserId, "Bearer good-token");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message.role).toBe("tutor");
    expect(body.mockRouting.costMode).toBe("Normal Learning");
  });

  it("returns 403 for spoofed body userId", async () => {
    const response = await postTutor({ ...baseBody, userId: "bob" }, "Bearer good-token");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden." });
  });

  it("returns 400 for valid auth with invalid tutor payload", async () => {
    const response = await postTutor({ ...baseBody, message: "" }, "Bearer good-token");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid tutor request." });
  });
});
