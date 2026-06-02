import { resolveAuthenticatedUser } from "../../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../../server/firebase/firestoreEmulatorClient";
import { fileChunkEmbeddingService } from "../../../../../../../server/workspaces/fileChunkEmbeddingService";
import { updateUploadedFile } from "../../../../../../../server/workspaces/uploadedFileRepository";
import type { AuthResult } from "../../../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileEmbeddingsContext = { params: Promise<{ workspaceId: string; fileId: string }> };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createWorkspaceFileEmbeddingsPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceFileEmbeddingsContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId, fileId } = await context.params;
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(fileId)) {
      return Response.json({ error: "Missing workspace ID or file ID." }, { status: 400 });
    }

    try {
      const result = await fileChunkEmbeddingService.runEmbeddingLifecycleForFile(
        authResult.user,
        workspaceId,
        fileId
      );

      if (!result.ok) {
        if (result.code === "workspace_not_found" || result.code === "file_not_found") {
          return Response.json({ error: "Workspace or file not found." }, { status: 404 });
        }

        if (result.code === "chunking_not_completed" || result.code === "no_chunks") {
          return Response.json(
            {
              error:
                result.code === "chunking_not_completed"
                  ? "Chunking must be completed before embeddings can be generated."
                  : "No non-empty chunks were found for embedding.",
            },
            { status: 400 }
          );
        }

        return Response.json({ error: "Failed to run embedding lifecycle." }, { status: 500 });
      }

      const embeddingStatus = result.embeddedChunkCount > 0 ? "completed" : "failed";
      await updateUploadedFile(authResult.user.userId, fileId, {
        embeddingStatus,
        embeddingUpdatedAt: new Date(),
      }).catch(() => {
        // Non-fatal: embedding data is persisted on chunks; file status update is best-effort.
      });

      return Response.json({
        embeddedChunkCount: result.embeddedChunkCount,
        failedChunkCount: result.failedChunkCount,
      });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to run embedding lifecycle." }, { status: 500 });
    }
  };
}

export const POST = createWorkspaceFileEmbeddingsPostHandler();
