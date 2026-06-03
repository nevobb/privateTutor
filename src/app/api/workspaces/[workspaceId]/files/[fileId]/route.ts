import { resolveAuthenticatedUser } from "../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../server/firebase/firestoreEmulatorClient";
import { uploadedFileApiService } from "../../../../../../server/workspaces/uploadedFileApiService";
import type { AuthResult } from "../../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileContext = { params: Promise<{ workspaceId: string; fileId: string }> };

export function createWorkspaceFileDeleteHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function DELETE(request: Request, context: WorkspaceFileContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId, fileId } = await context.params;

    if (!workspaceId || typeof workspaceId !== "string" || !workspaceId.trim()) {
      return Response.json({ error: "Missing workspace ID." }, { status: 400 });
    }

    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
      return Response.json({ error: "Missing file ID." }, { status: 400 });
    }

    try {
      const deleted = await uploadedFileApiService.softDeleteFileForWorkspace(
        authResult.user,
        workspaceId.trim(),
        fileId.trim()
      );

      if (!deleted) {
        return Response.json({ error: "File not found." }, { status: 404 });
      }

      return Response.json({ deleted: true, fileId: deleted.id });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to delete file." }, { status: 500 });
    }
  };
}

export const DELETE = createWorkspaceFileDeleteHandler();
