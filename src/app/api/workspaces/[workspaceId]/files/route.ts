import { resolveAuthenticatedUser } from "../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../server/firebase/firestoreEmulatorClient";
import {
  uploadedFileApiService,
  UploadedFileValidationError,
} from "../../../../../server/workspaces/uploadedFileApiService";
import {
  parseCreateUploadedFileRequest,
  toUploadedFileApiResponse,
} from "../../../../../server/workspaces/uploadedFileApiSchemas";
import type { AuthResult } from "../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFilesContext = { params: Promise<{ workspaceId: string }> };

export function createWorkspaceFilesGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request, context: WorkspaceFilesContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId } = await context.params;
    if (!workspaceId || typeof workspaceId !== "string") {
      return Response.json({ error: "Missing workspace ID." }, { status: 400 });
    }

    try {
      const files = await uploadedFileApiService.listFilesForWorkspace(authResult.user, workspaceId);
      if (!files) {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json({ files: files.map(toUploadedFileApiResponse) });
    } catch (error: unknown) {
      if (error instanceof UploadedFileValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to list uploaded files." }, { status: 500 });
    }
  };
}

export function createWorkspaceFilesPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceFilesContext): Promise<Response> {
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

    const validation = parseCreateUploadedFileRequest(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const created = await uploadedFileApiService.createFileForWorkspace(
        authResult.user,
        workspaceId,
        validation.input
      );

      if (!created) {
        return Response.json({ error: "Workspace not found." }, { status: 404 });
      }

      return Response.json(toUploadedFileApiResponse(created), { status: 201 });
    } catch (error: unknown) {
      if (
        error instanceof UploadedFileValidationError ||
        (error instanceof Error && error.name === "UploadedFileValidationError")
      ) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to create uploaded file metadata." }, { status: 500 });
    }
  };
}

export const GET = createWorkspaceFilesGetHandler();
export const POST = createWorkspaceFilesPostHandler();
