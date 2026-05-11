import { describe } from "vitest";

export const AUTH_EMULATOR_TEST_ENABLED = process.env.FIREBASE_AUTH_EMULATOR_TEST === "1";
export const describeFirebaseAuthEmulator = AUTH_EMULATOR_TEST_ENABLED ? describe : describe.skip;

export const AUTH_EMULATOR_PROJECT_ID = "demo-private-tutor";
export const AUTH_EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_PORT = 9099;
export const AUTH_EMULATOR_BASE_URL = `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;
export const AUTH_EMULATOR_USER_EMAIL = "auth-emulator-test@example.test";
export const AUTH_EMULATOR_USER_PASSWORD = "auth-emulator-password-123!";

type AuthEmulatorIdentityToolkitResponse = {
  localId: string;
  idToken: string;
  refreshToken: string;
  email?: string;
  expiresIn?: string;
};

type JwtPayload = {
  aud?: string;
  auth_time?: number;
  email?: string;
  exp?: number;
  firebase?: {
    identities?: Record<string, unknown>;
    sign_in_provider?: string;
  };
  iat?: number;
  iss?: string;
  sub?: string;
  user_id?: string;
};

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timeoutId);
    },
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

export async function assertAuthEmulatorRunning(): Promise<void> {
  const { signal, cancel } = createTimeoutSignal(1500);

  try {
    await fetch(AUTH_EMULATOR_BASE_URL, { signal });
  } catch {
    throw new Error(
      [
        "FIREBASE_AUTH_EMULATOR_TEST=1 is set, but the Firebase Auth emulator is not reachable.",
        `Expected a local Auth emulator at ${AUTH_EMULATOR_BASE_URL} for project ${AUTH_EMULATOR_PROJECT_ID}.`,
        "Start the emulator and rerun the test.",
      ].join(" "),
    );
  } finally {
    cancel();
  }
}

async function signUpAuthEmulatorUser(): Promise<AuthEmulatorIdentityToolkitResponse> {
  const { response, body } = await fetchJson(
    `${AUTH_EMULATOR_BASE_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      body: JSON.stringify({
        email: AUTH_EMULATOR_USER_EMAIL,
        password: AUTH_EMULATOR_USER_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );

  if (response.ok && body) {
    return body as AuthEmulatorIdentityToolkitResponse;
  }

  const errorMessage = body?.error?.message;
  if (errorMessage === "EMAIL_EXISTS") {
    return signInAuthEmulatorUser();
  }

  throw new Error(
    `Firebase Auth emulator sign-up failed with ${response.status}: ${JSON.stringify(body)}`,
  );
}

async function signInAuthEmulatorUser(): Promise<AuthEmulatorIdentityToolkitResponse> {
  const { response, body } = await fetchJson(
    `${AUTH_EMULATOR_BASE_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      body: JSON.stringify({
        email: AUTH_EMULATOR_USER_EMAIL,
        password: AUTH_EMULATOR_USER_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );

  if (response.ok && body) {
    return body as AuthEmulatorIdentityToolkitResponse;
  }

  throw new Error(
    `Firebase Auth emulator sign-in failed with ${response.status}: ${JSON.stringify(body)}`,
  );
}

export async function createOrSignInAuthEmulatorUser(): Promise<AuthEmulatorIdentityToolkitResponse> {
  await assertAuthEmulatorRunning();
  return signUpAuthEmulatorUser();
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Expected a JWT with three parts from the Firebase Auth emulator.");
  }

  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(payload) as JwtPayload;
}
