import type { AuthResult } from "../../../../../server/auth/authTypes";
import { resolveAuthenticatedUser } from "../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../server/firebase/firestoreEmulatorClient";
import {
  parseGetMessagesQuery,
  parsePostMessageRequest,
  serializeMessage,
} from "../../../../../server/workspaces/sessionMessageApiSchemas";
import { sessionMessageApiService } from "../../../../../server/workspaces/sessionMessageApiService";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type RouteContext = { params: Promise<{ sessionId: string }> };

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Workspace not found." || error.message === "Session not found.")
  );
}

export function createMessagesGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request, context: RouteContext): Promise<Response> {
    const { sessionId } = await context.params;

    if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
      return Response.json({ error: "sessionId is required." }, { status: 400 });
    }

    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const validation = parseGetMessagesQuery(searchParams);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const records = await sessionMessageApiService.listMessagesForUser(
        authResult.user,
        validation.input.workspaceId,
        sessionId.trim()
      );
      return Response.json({ messages: records.map(serializeMessage) });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      if (isNotFoundError(error)) {
        return Response.json({ error: (error as Error).message }, { status: 404 });
      }
      return Response.json({ error: "Failed to load messages." }, { status: 500 });
    }
  };
}

export function createMessagesPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: RouteContext): Promise<Response> {
    const { sessionId } = await context.params;

    if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
      return Response.json({ error: "sessionId is required." }, { status: 400 });
    }

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

    const validation = parsePostMessageRequest(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const result = await sessionMessageApiService.sendMessageForUser(
        authResult.user,
        sessionId.trim(),
        validation.input
      );
      return Response.json(result, { status: 201 });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      if (isNotFoundError(error)) {
        return Response.json({ error: (error as Error).message }, { status: 404 });
      }
      return Response.json({ error: "Failed to send message." }, { status: 500 });
    }
  };
}

export const GET = createMessagesGetHandler();
export const POST = createMessagesPostHandler();
