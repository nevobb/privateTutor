import { resolveAuthenticatedUser } from "../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../server/firebase/firestoreEmulatorClient";
import { workspaceApiService } from "../../../../../server/workspaces/workspaceApiService";
import {
  toWorkspaceApiResponse,
  validateMoveWorkspaceRequest,
} from "../../../../../server/workspaces/workspaceApiSchemas";
import type { AuthResult } from "../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceMoveContext = { params: Promise<{ workspaceId: string }> };

export function createWorkspaceMovePostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceMoveContext): Promise<Response> {
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

    const { workspaceId } = await context.params;
    if (!workspaceId || typeof workspaceId !== "string") {
      return Response.json({ error: "Missing workspace ID." }, { status: 400 });
    }

    const validation = validateMoveWorkspaceRequest(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const moved = await workspaceApiService.moveWorkspaceForUser(
        authResult.user,
        workspaceId,
        validation.input
      );

      if (!moved) {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json(toWorkspaceApiResponse(moved));
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to move workspace." }, { status: 500 });
    }
  };
}

export const POST = createWorkspaceMovePostHandler();
