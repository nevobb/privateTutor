import { describe, expect, it, vi } from "vitest";

const mockVerifyIdToken = vi.fn();

vi.mock("../../../src/server/firebase/firebaseAdminApp", () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
}));

describe("verifyFirebaseTokenProduction", () => {
  it("returns mapped token fields on success", async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: "user-1",
      email: "user@example.com",
      firebase: { sign_in_provider: "google.com" },
    });

    const mod = await import("../../../src/server/auth/verifyFirebaseTokenProduction");
    const result = await mod.verifyFirebaseTokenProduction("valid-token");

    expect(result).toEqual({
      uid: "user-1",
      email: "user@example.com",
      firebase: { sign_in_provider: "google.com" },
    });
  });

  it("returns null when key missing/invalid token", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("auth/argument-error"));

    const mod = await import("../../../src/server/auth/verifyFirebaseTokenProduction");
    const result = await mod.verifyFirebaseTokenProduction("bad-token");

    expect(result).toBeNull();
  });
});
