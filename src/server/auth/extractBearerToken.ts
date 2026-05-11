import { BearerTokenResult } from "./authTypes";

const UNAUTHORIZED = { error: "Unauthorized." };

export function extractBearerToken(request: Request): BearerTokenResult {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return {
      ok: false,
      status: 401,
      error: UNAUTHORIZED,
    };
  }

  const [scheme, token, ...extraParts] = authorization.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || extraParts.length > 0) {
    return {
      ok: false,
      status: 401,
      error: UNAUTHORIZED,
    };
  }

  return {
    ok: true,
    token,
  };
}
