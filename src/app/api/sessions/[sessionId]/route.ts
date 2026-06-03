import type { AuthResult } from "../../../../server/auth/authTypes";
import { resolveAuthenticatedUser } from "../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../server/firebase/firestoreEmulatorClient";
import {
  parseDeleteSessionRequest,
  parseRenameSessionRequest,
  serializeSession,
} from "../../../../server/workspaces/sessionApiSchemas";
import { sessionApiService } from "../../../../server/workspaces/sessionApiService";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type RouteContext = { params: Promise<{ sessionId: string }> };

export function createSessionPatchHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function PATCH(request: Request, context: RouteContext): Promise<Response> {
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

    const validation = parseRenameSessionRequest(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const updated = await sessionApiService.renameSessionForUser(
        authResult.user,
        sessionId.trim(),
        validation.input
      );

      if (!updated) {
        return Response.json({ error: "Session not found." }, { status: 404 });
      }

      return Response.json({ session: serializeSession(updated) });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      if (error instanceof Error && error.message === "Workspace not found.") {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json({ error: "Failed to rename session." }, { status: 500 });
    }
  };
}

export const PATCH = createSessionPatchHandler();

export function createSessionDeleteHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function DELETE(request: Request, context: RouteContext): Promise<Response> {
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

    const validation = parseDeleteSessionRequest(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const deleted = await sessionApiService.softDeleteSessionForUser(
        authResult.user,
        sessionId.trim(),
        validation.input
      );

      if (!deleted) {
        return Response.json({ error: "Session not found." }, { status: 404 });
      }

      return Response.json({ deleted: true, sessionId: deleted.id });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      if (error instanceof Error && error.message === "Workspace not found.") {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json({ error: "Failed to delete session." }, { status: 500 });
    }
  };
}

export const DELETE = createSessionDeleteHandler();
