import { handleTutorRequest } from "../../../server/tutor/handleTutorRequest";
import { assertRequestUserMatchesAuthUser } from "../../../server/auth/assertRequestUserMatchesAuthUser";
import { resolveAuthenticatedUser } from "../../../server/auth/resolveAuthenticatedUser";
import { AuthResult } from "../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;

export function createTutorPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const authResult = await authResolver(request);

    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const userMatch = assertRequestUserMatchesAuthUser(body, authResult.user);

    if (!userMatch.ok) {
      return Response.json(userMatch.error, { status: userMatch.status });
    }

    const trustedBody = {
      ...(typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}),
      userId: authResult.user.userId,
    };

    const result = await handleTutorRequest(trustedBody);

    if (!result.ok) {
      return Response.json(result.error, { status: result.status });
    }

    return Response.json(result.response);
  };
}

export const POST = createTutorPostHandler();
