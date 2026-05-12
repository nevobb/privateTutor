import { resolveAuthenticatedUser } from "../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../server/firebase/firestoreEmulatorClient";
import { workspaceApiService } from "../../../../server/workspaces/workspaceApiService";
import { toWorkspaceApiResponse } from "../../../../server/workspaces/workspaceApiSchemas";
import type { AuthResult } from "../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceByIdContext = { params: Promise<{ workspaceId: string }> };

export function createWorkspaceByIdGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request, context: WorkspaceByIdContext): Promise<Response> {
    const authResult = await authResolver(request);

    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId } = await context.params;

    if (!workspaceId || typeof workspaceId !== "string") {
      return Response.json({ error: "Missing workspace ID." }, { status: 400 });
    }

    let workspace;
    try {
      workspace = await workspaceApiService.getWorkspaceForUser(authResult.user, workspaceId);
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to get workspace." }, { status: 500 });
    }

    if (!workspace) {
      return Response.json({ error: "Workspace not found." }, { status: 404 });
    }

    return Response.json(toWorkspaceApiResponse(workspace));
  };
}

export const GET = createWorkspaceByIdGetHandler();
