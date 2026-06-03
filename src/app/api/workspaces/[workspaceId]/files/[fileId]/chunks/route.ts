import { resolveAuthenticatedUser } from "../../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../../server/firebase/firestoreEmulatorClient";
import { uploadedFileApiService } from "../../../../../../../server/workspaces/uploadedFileApiService";
import { toUploadedFileApiResponse } from "../../../../../../../server/workspaces/uploadedFileApiSchemas";
import type { AuthResult } from "../../../../../../../server/auth/authTypes";
import type { CostMode } from "../../../../../../../types/index";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileChunksContext = { params: Promise<{ workspaceId: string; fileId: string }> };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseCostMode(value: unknown): CostMode | undefined {
  if (
    value === "Cheap Practice" ||
    value === "Normal Learning" ||
    value === "Deep Research"
  ) {
    return value;
  }
  return undefined;
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

    // Parse optional costMode from JSON body. Old clients that send no body are handled safely.
    let costMode: CostMode | undefined;
    try {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as Record<string, unknown>;
        costMode = parseCostMode(body?.costMode);
      }
    } catch {
      // Malformed body — ignore, costMode remains undefined → defaults to Normal Learning
    }

    try {
      const result = await uploadedFileApiService.runChunkingLifecycleForFile(
        authResult.user,
        workspaceId,
        fileId,
        { costMode }
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
