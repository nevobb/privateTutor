import { resolveAuthenticatedUser } from "../../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../../server/firebase/firestoreEmulatorClient";
import { uploadedFileApiService } from "../../../../../../../server/workspaces/uploadedFileApiService";
import { toUploadedFileApiResponse } from "../../../../../../../server/workspaces/uploadedFileApiSchemas";
import type { AuthResult } from "../../../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileChunksContext = { params: Promise<{ workspaceId: string; fileId: string }> };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createWorkspaceFileChunksPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceFileChunksContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId, fileId } = await context.params;
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(fileId)) {
      return Response.json({ error: "Missing workspace ID or file ID." }, { status: 400 });
    }

    try {
      const result = await uploadedFileApiService.runChunkingLifecycleForFile(
        authResult.user,
        workspaceId,
        fileId
      );

      if (!result.ok) {
        if (result.code === "workspace_not_found" || result.code === "file_not_found") {
          return Response.json({ error: "Workspace or file not found." }, { status: 404 });
        }

        if (
          result.code === "extraction_not_completed" ||
          result.code === "missing_extracted_text" ||
          result.code === "invalid_transition"
        ) {
          return Response.json(
            {
              error:
                result.code === "extraction_not_completed"
                  ? "Extraction must be completed before chunking."
                  : result.code === "missing_extracted_text"
                    ? "Extracted text is missing or empty."
                    : "Chunking lifecycle is already pending.",
            },
            { status: 400 }
          );
        }

        return Response.json({ error: "Failed to run chunking lifecycle." }, { status: 500 });
      }

      return Response.json({
        file: toUploadedFileApiResponse(result.file),
        chunkCount: result.chunkCount,
      });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to run chunking lifecycle." }, { status: 500 });
    }
  };
}

export const POST = createWorkspaceFileChunksPostHandler();
