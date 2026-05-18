import type { WorkspaceRecord } from "./workspaceTypes";

export interface CreateWorkspaceApiRequest {
  name: string;
  description?: string;
  path?: string[];
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
}

export interface MoveWorkspaceApiRequest {
  currentPath: string;
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
}

export interface WorkspaceApiResponse {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  path?: string[];
  currentPath?: string;
  previousPaths?: string[];
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
  lastSessionId?: string;
  lastActivityAt?: string;
}

export interface WorkspaceListApiResponse {
  workspaces: WorkspaceApiResponse[];
}

export type CreateWorkspaceValidationResult =
  | { ok: true; input: CreateWorkspaceApiRequest }
  | { ok: false; error: string };

export type MoveWorkspaceValidationResult =
  | { ok: true; input: MoveWorkspaceApiRequest }
  | { ok: false; error: string };

export function validateCreateWorkspaceRequest(body: unknown): CreateWorkspaceValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return { ok: false, error: "name is required and must be a non-empty string." };
  }

  if (raw.description !== undefined && typeof raw.description !== "string") {
    return { ok: false, error: "description must be a string." };
  }

  if (raw.path !== undefined) {
    if (!Array.isArray(raw.path) || raw.path.some((item) => typeof item !== "string")) {
      return { ok: false, error: "path must be an array of strings." };
    }
  }

  if (raw.parentWorkspaceId !== undefined && typeof raw.parentWorkspaceId !== "string") {
    return { ok: false, error: "parentWorkspaceId must be a string." };
  }

  if (raw.stableIdentityNote !== undefined && typeof raw.stableIdentityNote !== "string") {
    return { ok: false, error: "stableIdentityNote must be a string." };
  }

  return {
    ok: true,
    input: {
      name: raw.name.trim(),
      description: typeof raw.description === "string" ? raw.description : undefined,
      path: Array.isArray(raw.path) ? (raw.path as string[]) : undefined,
      parentWorkspaceId: typeof raw.parentWorkspaceId === "string" ? raw.parentWorkspaceId : undefined,
      stableIdentityNote: typeof raw.stableIdentityNote === "string" ? raw.stableIdentityNote : undefined,
    },
  };
}

export function validateMoveWorkspaceRequest(body: unknown): MoveWorkspaceValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;
  if (typeof raw.currentPath !== "string") {
    return { ok: false, error: "currentPath is required and must be a string." };
  }

  const currentPath = normalizeCurrentPath(raw.currentPath);
  if (!currentPath) {
    return { ok: false, error: "currentPath must be a non-empty path." };
  }

  if (raw.parentWorkspaceId !== undefined && typeof raw.parentWorkspaceId !== "string") {
    return { ok: false, error: "parentWorkspaceId must be a string." };
  }

  if (raw.stableIdentityNote !== undefined && typeof raw.stableIdentityNote !== "string") {
    return { ok: false, error: "stableIdentityNote must be a string." };
  }

  return {
    ok: true,
    input: {
      currentPath,
      parentWorkspaceId:
        typeof raw.parentWorkspaceId === "string" ? raw.parentWorkspaceId : undefined,
      stableIdentityNote:
        typeof raw.stableIdentityNote === "string" ? raw.stableIdentityNote : undefined,
    },
  };
}

export function toWorkspaceApiResponse(record: WorkspaceRecord): WorkspaceApiResponse {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    path: record.path,
    currentPath: record.currentPath,
    previousPaths: record.previousPaths,
    parentWorkspaceId: record.parentWorkspaceId,
    stableIdentityNote: record.stableIdentityNote,
    lastSessionId: record.lastSessionId,
    lastActivityAt: record.lastActivityAt?.toISOString(),
  };
}

function normalizeCurrentPath(value: string): string {
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return "";
  return parts.join(" / ");
}
