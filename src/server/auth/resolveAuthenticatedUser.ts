import { AuthResult, FirebaseTokenVerifier } from "./authTypes";
import { extractBearerToken } from "./extractBearerToken";
import { verifyFirebaseToken } from "./verifyFirebaseToken";

const UNAUTHORIZED = { error: "Unauthorized." };

export async function resolveAuthenticatedUser(
  request: Request,
  verifier: FirebaseTokenVerifier = verifyFirebaseToken
): Promise<AuthResult> {
  const tokenResult = extractBearerToken(request);

  if (!tokenResult.ok) {
    return tokenResult;
  }

  let verifiedToken;

  try {
    verifiedToken = await verifier(tokenResult.token);
  } catch {
    verifiedToken = null;
  }

  if (!verifiedToken || typeof verifiedToken.uid !== "string" || verifiedToken.uid.trim().length === 0) {
    return {
      ok: false,
      status: 401,
      error: UNAUTHORIZED,
    };
  }

  return {
    ok: true,
    user: {
      userId: verifiedToken.uid,
      authProvider: verifiedToken.firebase?.sign_in_provider,
      email: verifiedToken.email,
    },
  };
}
