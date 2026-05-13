import type { VerifiedFirebaseToken } from "./authTypes";
import { authEmulatorConfig } from "./authEmulatorConfig";

interface AuthEmulatorUser {
  localId?: unknown;
  email?: unknown;
}

interface AuthEmulatorLookupResponse {
  users?: unknown[];
}

const LOOKUP_ENDPOINT = `${authEmulatorConfig.baseUrl}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${authEmulatorConfig.apiKey}`;

type FetchFn = typeof fetch;

export async function verifyFirebaseTokenEmulator(
  token: string,
  fetchFn: FetchFn = fetch
): Promise<VerifiedFirebaseToken | null> {
  let response: Response;
  try {
    response = await fetchFn(LOOKUP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let data: AuthEmulatorLookupResponse;
  try {
    data = (await response.json()) as AuthEmulatorLookupResponse;
  } catch {
    return null;
  }

  const users = data.users;
  if (!Array.isArray(users) || users.length === 0) {
    return null;
  }

  const user = users[0] as AuthEmulatorUser;
  if (typeof user.localId !== "string" || user.localId.trim().length === 0) {
    return null;
  }

  return {
    uid: user.localId,
    email: typeof user.email === "string" ? user.email : undefined,
  };
}
