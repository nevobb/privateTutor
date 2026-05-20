import { resolveAuthenticatedUser } from "../../../../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../../../../server/firebase/firestoreEmulatorClient";
import { uploadedFileApiService } from "../../../../../../../server/workspaces/uploadedFileApiService";
import { toUploadedFileApiResponse } from "../../../../../../../server/workspaces/uploadedFileApiSchemas";
import type { AuthResult } from "../../../../../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type WorkspaceFileExtractContext = { params: Promise<{ workspaceId: string; fileId: string }> };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function readFileBufferFromRequest(request: Request): Promise<Buffer | undefined> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return undefined;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return undefined;
    return Buffer.from(await file.arrayBuffer());
  } catch {
    return undefined;
  }
}

export function createWorkspaceFileExtractPostHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function POST(request: Request, context: WorkspaceFileExtractContext): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const { workspaceId, fileId } = await context.params;
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(fileId)) {
      return Response.json({ error: "Missing workspace ID or file ID." }, { status: 400 });
    }

    try {
      const fileBuffer = await readFileBufferFromRequest(request);

      if (!fileBuffer) {
        return Response.json(
          { error: "File bytes are required for extraction. Send file as multipart/form-data." },
          { status: 400 }
        );
      }

      const result = await uploadedFileApiService.runExtractionLifecycleForFile(
        authResult.user,
        workspaceId,
        fileId,
        fileBuffer
      );

      if (!result.ok) {
        if (result.code === "workspace_not_found" || result.code === "file_not_found") {
          return Response.json({ error: "Workspace or file not found." }, { status: 404 });
        }

        if (
          result.code === "invalid_transition" ||
          result.code === "missing_storage_path" ||
          result.code === "unsupported_source_type"
        ) {
          return Response.json(
            {
              error:
                result.code === "invalid_transition"
                  ? "Extraction lifecycle can only run from not_started or failed."
                  : result.code === "missing_storage_path"
                    ? "File is missing storagePath and cannot be extracted."
                    : "Only pdf/docx files are supported for extraction.",
            },
            { status: 400 }
          );
        }

        return Response.json({ error: "Failed to run extraction lifecycle." }, { status: 500 });
      }

      return Response.json(toUploadedFileApiResponse(result.file));
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }

      return Response.json({ error: "Failed to run extraction lifecycle." }, { status: 500 });
    }
  };
}

export const POST = createWorkspaceFileExtractPostHandler();
