import type { AuthResult } from "../../../server/auth/authTypes";
import { resolveAuthenticatedUser } from "../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../server/firebase/firestoreEmulatorClient";
import {
  parseCreateSessionRequest,
  parseListSessionsQuery,
  serializeSession,
} from "../../../server/workspaces/sessionApiSchemas";
import { sessionApiService } from "../../../server/workspaces/sessionApiService";

type AuthResolver = (request: Request) => Promise<AuthResult>;

function isWorkspaceNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === "Workspace not found.";
}

function omitClientUserId<T extends object>(input: T): T {
  if (!input || typeof input !== "object") {
    return input;
  }

  const { userId, ...rest } = input as T & { userId?: unknown };
  void userId;
  return rest as T;
}

export function createSessionsPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
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

    const validation = parseCreateSessionRequest(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const safeInput = omitClientUserId(validation.input);
      const session = await sessionApiService.createSessionForUser(authResult.user, safeInput);
      return Response.json({ session: serializeSession(session) }, { status: 201 });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      if (isWorkspaceNotFoundError(error)) {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json({ error: "Failed to create session." }, { status: 500 });
    }
  };
}

export function createSessionsGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request): Promise<Response> {
    const authResult = await authResolver(request);

    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const validation = parseListSessionsQuery(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const sessions = await sessionApiService.listSessionsForUser(authResult.user, validation.input.workspaceId);
      return Response.json({ sessions: sessions.map(serializeSession) });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      if (isWorkspaceNotFoundError(error)) {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json({ error: "Failed to list sessions." }, { status: 500 });
    }
  };
}

export const GET = createSessionsGetHandler();
export const POST = createSessionsPostHandler();
