import { resolveAuthenticatedUser } from "../../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../../server/firebase/firestoreEmulatorClient";
import { fileDocumentUnderstandingService } from "../../../../../../../server/workspaces/fileDocumentUnderstandingService";
import type { AuthResult } from "../../../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileUnderstandingContext = { params: Promise<{ workspaceId: string; fileId: string }> };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createWorkspaceFileUnderstandingPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceFileUnderstandingContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId, fileId } = await context.params;
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(fileId)) {
      return Response.json({ error: "Missing workspace ID or file ID." }, { status: 400 });
    }

    try {
      const result = await fileDocumentUnderstandingService.runDocumentUnderstandingLifecycleForFile(
        authResult.user,
        workspaceId,
        fileId
      );

      if (!result.ok) {
        if (result.code === "workspace_not_found" || result.code === "file_not_found") {
          return Response.json({ error: "Workspace or file not found." }, { status: 404 });
        }

        if (result.code === "extraction_not_completed" || result.code === "pages_not_found") {
          return Response.json(
            {
              error:
                result.code === "extraction_not_completed"
                  ? "Extraction must be completed before document understanding."
                  : "Document pages are not available yet.",
            },
            { status: 400 }
          );
        }

        return Response.json({ error: "Failed to run document understanding lifecycle." }, { status: 500 });
      }

      return Response.json({
        understandingStatus: result.understandingStatus,
        materialType: result.materialType,
        detectedQuestionCount: result.detectedQuestionCount,
        outlineSectionCount: result.outlineSectionCount,
      });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to run document understanding lifecycle." }, { status: 500 });
    }
  };
}

export const POST = createWorkspaceFileUnderstandingPostHandler();
