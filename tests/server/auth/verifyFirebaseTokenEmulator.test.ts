import { describe, it, expect, vi } from "vitest";
import { verifyFirebaseTokenEmulator } from "../../../src/server/auth/verifyFirebaseTokenEmulator";

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue(makeResponse(200, body));
}

describe("verifyFirebaseTokenEmulator", () => {
  it("maps localId to uid on valid lookup response", async () => {
    const fetch = mockFetchOk({ users: [{ localId: "user-abc", email: "test@example.com" }] });

    const result = await verifyFirebaseTokenEmulator("valid-token", fetch);

    expect(result).toEqual({ uid: "user-abc", email: "test@example.com" });
  });

  it("maps email when present", async () => {
    const fetch = mockFetchOk({ users: [{ localId: "user-123", email: "hello@test.example" }] });

    const result = await verifyFirebaseTokenEmulator("token", fetch);

    expect(result?.email).toBe("hello@test.example");
  });

  it("omits email field when missing from response", async () => {
    const fetch = mockFetchOk({ users: [{ localId: "user-no-email" }] });

    const result = await verifyFirebaseTokenEmulator("token", fetch);

    expect(result?.uid).toBe("user-no-email");
    expect(result?.email).toBeUndefined();
  });

  it("calls only 127.0.0.1:9099 — never a cloud endpoint", async () => {
    const fetch = mockFetchOk({ users: [{ localId: "user-1" }] });

    await verifyFirebaseTokenEmulator("token", fetch);

    const url = fetch.mock.calls[0][0] as string;
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:9099\//);
  });

  it("sends idToken in POST body", async () => {
    const fetch = mockFetchOk({ users: [{ localId: "user-1" }] });

    await verifyFirebaseTokenEmulator("my-id-token", fetch);

    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ idToken: "my-id-token" });
    expect(init.method).toBe("POST");
  });

  it("returns null on empty users array — fail closed", async () => {
    const fetch = mockFetchOk({ users: [] });

    expect(await verifyFirebaseTokenEmulator("bad-token", fetch)).toBeNull();
  });

  it("returns null when users key is missing — fail closed", async () => {
    const fetch = mockFetchOk({});

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null on 400 response — fail closed", async () => {
    const fetch = vi.fn().mockResolvedValue(
      makeResponse(400, { error: { message: "INVALID_ID_TOKEN" } })
    );

    expect(await verifyFirebaseTokenEmulator("bad", fetch)).toBeNull();
  });

  it("returns null on 401 response — fail closed", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(401, { error: "Unauthorized" }));

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null on 500 response — fail closed", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(500, {}));

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null on network error — fail closed", async () => {
    const fetch = vi.fn().mockImplementation(
      () => Promise.reject(new Error("ECONNREFUSED"))
    );

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null on malformed JSON in response body — fail closed", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null when localId is empty string — fail closed", async () => {
    const fetch = mockFetchOk({ users: [{ localId: "" }] });

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null when localId is not a string — fail closed", async () => {
    const fetch = mockFetchOk({ users: [{ localId: 42 }] });

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });

  it("returns null when users entry is not an object — fail closed", async () => {
    const fetch = mockFetchOk({ users: ["not-an-object"] });

    expect(await verifyFirebaseTokenEmulator("token", fetch)).toBeNull();
  });
});
