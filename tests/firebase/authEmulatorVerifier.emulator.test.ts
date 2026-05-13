import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  AUTH_EMULATOR_USER_EMAIL,
  createOrSignInAuthEmulatorUser,
  describeFirebaseAuthEmulator,
} from "./authEmulatorTestUtils";
import { verifyFirebaseTokenEmulator } from "../../src/server/auth/verifyFirebaseTokenEmulator";
import { createWorkspacesGetHandler } from "../../src/app/api/workspaces/route";
import type { AuthResult } from "../../src/server/auth/authTypes";

vi.mock("../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

vi.mock("../../src/server/workspaces/workspaceApiService", () => ({
  workspaceApiService: {
    listWorkspacesForUser: vi.fn(async () => []),
  },
}));

let session: Awaited<ReturnType<typeof createOrSignInAuthEmulatorUser>> | undefined;

describeFirebaseAuthEmulator("Auth emulator verifier — end-to-end token verification", () => {
  beforeAll(async () => {
    session = await createOrSignInAuthEmulatorUser();
  });

  afterAll(() => {
    session = undefined;
  });

  it("verifies an emulator-issued ID token and returns the user uid", async () => {
    if (!session) throw new Error("No auth session.");

    const result = await verifyFirebaseTokenEmulator(session.idToken, fetch);

    expect(result).not.toBeNull();
    expect(result?.uid).toBe(session.localId);
  });

  it("returns the correct email for the emulator user", async () => {
    if (!session) throw new Error("No auth session.");

    const result = await verifyFirebaseTokenEmulator(session.idToken, fetch);

    expect(result?.email).toBe(AUTH_EMULATOR_USER_EMAIL);
  });

  it("returns null for a clearly invalid token", async () => {
    const result = await verifyFirebaseTokenEmulator("not-a-real-token");

    expect(result).toBeNull();
  });

  it("GET /api/workspaces with emulator-verified token returns 200 — not 401", async () => {
    if (!session) throw new Error("No auth session.");
    const token = session.idToken;

    const authResolver = async (_req: Request): Promise<AuthResult> => {
      const verified = await verifyFirebaseTokenEmulator(token);
      if (!verified?.uid) {
        return { ok: false, status: 401, error: { error: "Unauthorized." } };
      }
      return { ok: true, user: { userId: verified.uid, email: verified.email } };
    };

    const GET = createWorkspacesGetHandler(authResolver);
    const req = new Request("http://localhost/api/workspaces", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json() as { workspaces: unknown[] };
    expect(Array.isArray(body.workspaces)).toBe(true);
  });
});
