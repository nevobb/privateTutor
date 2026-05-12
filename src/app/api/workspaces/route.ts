import { resolveAuthenticatedUser } from "../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../server/firebase/firestoreEmulatorClient";
import { workspaceApiService } from "../../../server/workspaces/workspaceApiService";
import {
  toWorkspaceApiResponse,
  validateCreateWorkspaceRequest,
} from "../../../server/workspaces/workspaceApiSchemas";
import type { AuthResult } from "../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;

export function createWorkspacesGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request): Promise<Response> {
    const authResult = await authResolver(request);

    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    let workspaces;
    try {
      workspaces = await workspaceApiService.listWorkspacesForUser(authResult.user);
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to list workspaces." }, { status: 500 });
    }

    return Response.json({ workspaces: workspaces.map(toWorkspaceApiResponse) });
  };
}

export function createWorkspacesPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
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

    const validation = validateCreateWorkspaceRequest(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    let workspace;
    try {
      workspace = await workspaceApiService.createWorkspaceForUser(authResult.user, validation.input);
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to create workspace." }, { status: 500 });
    }

    return Response.json(toWorkspaceApiResponse(workspace), { status: 201 });
  };
}

export const GET = createWorkspacesGetHandler();
export const POST = createWorkspacesPostHandler();
