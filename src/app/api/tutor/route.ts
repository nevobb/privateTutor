import { handleTutorRequest } from "../../../server/tutor/handleTutorRequest";
import { assertRequestUserMatchesAuthUser } from "../../../server/auth/assertRequestUserMatchesAuthUser";
import { resolveAuthenticatedUser } from "../../../server/auth/resolveAuthenticatedUser";
import { AuthResult } from "../../../server/auth/authTypes";
import { validateTutorRequest } from "../../../server/tutor/validateTutorRequest";
import { workspacePersistenceService } from "../../../server/workspaces/workspacePersistenceService";
import { isFirestoreEmulatorUnavailableError } from "../../../server/firebase/firestoreEmulatorClient";

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

    const validation = validateTutorRequest(trustedBody);

    if (!validation.ok || !validation.request) {
      return Response.json({ error: "Invalid tutor request." }, { status: 400 });
    }

    let result;
    try {
      result = await workspacePersistenceService.persistTutorExchange({
        user: authResult.user,
        request: validation.request,
        tutorHandler: handleTutorRequest,
      });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to persist tutor exchange." }, { status: 500 });
    }

    if (!result.ok) {
      return Response.json(result.error, { status: result.status });
    }

    return Response.json(result.response);
  };
}

export const POST = createTutorPostHandler();
