import { resolveAuthenticatedUser } from "../../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../../server/firebase/firestoreEmulatorClient";
import { uploadedFileApiService } from "../../../../../../../server/workspaces/uploadedFileApiService";
import { toUploadedFileApiResponse } from "../../../../../../../server/workspaces/uploadedFileApiSchemas";
import type { AuthResult } from "../../../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileSummaryContext = { params: Promise<{ workspaceId: string; fileId: string }> };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createWorkspaceFileSummaryPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceFileSummaryContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId, fileId } = await context.params;
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(fileId)) {
      return Response.json({ error: "Missing workspace ID or file ID." }, { status: 400 });
    }

    try {
      const result = await uploadedFileApiService.runSummaryLifecycleForFile(
        authResult.user,
        workspaceId,
        fileId
      );

      if (!result.ok) {
        if (result.code === "workspace_not_found" || result.code === "file_not_found") {
          return Response.json({ error: "Workspace or file not found." }, { status: 404 });
        }

        if (result.code === "invalid_transition") {
          return Response.json({ error: "Summary lifecycle can only run from not_requested or failed." }, { status: 400 });
        }

        return Response.json({ error: "Failed to run summary lifecycle." }, { status: 500 });
      }

      return Response.json(toUploadedFileApiResponse(result.file));
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to run summary lifecycle." }, { status: 500 });
    }
  };
}

export const POST = createWorkspaceFileSummaryPostHandler();
