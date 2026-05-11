import { afterAll, beforeAll, expect, it } from "vitest";
import {
  AUTH_EMULATOR_PROJECT_ID,
  AUTH_EMULATOR_USER_EMAIL,
  createOrSignInAuthEmulatorUser,
  decodeJwtPayload,
  describeFirebaseAuthEmulator,
} from "./authEmulatorTestUtils";

let authSession: Awaited<ReturnType<typeof createOrSignInAuthEmulatorUser>> | undefined;

function requireAuthSession() {
  if (!authSession) {
    throw new Error("Auth emulator session was not initialized.");
  }

  return authSession;
}

describeFirebaseAuthEmulator("Auth emulator local token flow", () => {
  beforeAll(async () => {
    authSession = await createOrSignInAuthEmulatorUser();
  });

  afterAll(() => {
    authSession = undefined;
  });

  it("uses the local demo project only", () => {
    expect(AUTH_EMULATOR_PROJECT_ID).toBe("demo-private-tutor");
  });

  it("creates or signs in a local emulator user and returns an ID token", () => {
    const session = requireAuthSession();

    expect(session.localId).toBeTruthy();
    expect(session.idToken).toContain(".");
    expect(session.refreshToken).toBeTruthy();
  });

  it("returns a token that decodes to the local emulator user", () => {
    const session = requireAuthSession();
    const payload = decodeJwtPayload(session.idToken);

    expect(payload.aud).toBe("demo-private-tutor");
    expect(payload.email).toBe(AUTH_EMULATOR_USER_EMAIL);
    expect(payload.firebase?.sign_in_provider).toBe("password");
    expect(payload.user_id).toBe(session.localId);
    expect(payload.sub).toBe(session.localId);
    expect(payload.iss).toContain("demo-private-tutor");
  });
});
