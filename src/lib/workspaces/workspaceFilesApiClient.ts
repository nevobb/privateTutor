import type { WorkspaceFileItem, WorkspaceFileSourceType } from "./workspaceFilesApiTypes";

const REQUEST_TIMEOUT_MS = 15000;

export class WorkspaceFilesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "WorkspaceFilesApiError";
  }
}

export async function fetchWorkspaceFiles(
  authToken: string,
  workspaceId: string
): Promise<WorkspaceFileItem[]> {
  const res = await runWorkspaceFilesRequest(`/api/workspaces/${workspaceId}/files`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new WorkspaceFilesApiError(body.error ?? "Failed to load workspace files.", res.status);
  }

  const data = (await res.json()) as { files: WorkspaceFileItem[] };
  return data.files;
}

export async function createWorkspaceFileMetadata(input: {
  workspaceId: string;
  idToken: string;
  fileName: string;
  sourceType: WorkspaceFileSourceType;
  storagePath: string;
  topicHint?: string;
}): Promise<WorkspaceFileItem> {
  const res = await runWorkspaceFilesRequest(`/api/workspaces/${input.workspaceId}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: input.fileName,
      sourceType: input.sourceType,
      storagePath: input.storagePath,
      topicHint: input.topicHint,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new WorkspaceFilesApiError(body.error ?? "Failed to create uploaded file metadata.", res.status);
  }

  return (await res.json()) as WorkspaceFileItem;
}

export async function runWorkspaceFileExtraction(input: {
  workspaceId: string;
  fileId: string;
  idToken: string;
  file: File;
}): Promise<WorkspaceFileItem> {
  const formData = new FormData();
  formData.append("file", input.file, input.file.name);

  const res = await runWorkspaceFilesRequest(
    `/api/workspaces/${input.workspaceId}/files/${input.fileId}/extract`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.idToken}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new WorkspaceFilesApiError(body.error ?? "Failed to extract file content.", res.status);
  }

  return (await res.json()) as WorkspaceFileItem;
}

export async function runWorkspaceFileChunking(input: {
  workspaceId: string;
  fileId: string;
  idToken: string;
}): Promise<{ file: WorkspaceFileItem; chunkCount: number }> {
  const res = await runWorkspaceFilesRequest(
    `/api/workspaces/${input.workspaceId}/files/${input.fileId}/chunks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.idToken}`,
      },
    }
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new WorkspaceFilesApiError(body.error ?? "Failed to create file chunks.", res.status);
  }

  return (await res.json()) as { file: WorkspaceFileItem; chunkCount: number };
}

export async function runWorkspaceFileEmbeddings(input: {
  workspaceId: string;
  fileId: string;
  idToken: string;
}): Promise<{ embeddedChunkCount: number; failedChunkCount: number }> {
  const res = await runWorkspaceFilesRequest(
    `/api/workspaces/${input.workspaceId}/files/${input.fileId}/embeddings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.idToken}`,
      },
    }
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new WorkspaceFilesApiError(body.error ?? "Failed to generate embeddings.", res.status);
  }

  return (await res.json()) as { embeddedChunkCount: number; failedChunkCount: number };
}

async function runWorkspaceFilesRequest(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new WorkspaceFilesApiError("File service timed out. Please try again.", 503);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
