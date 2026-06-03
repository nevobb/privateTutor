import type { CostMode, WorkMode } from "../../types";
import type { SessionRecord } from "./workspaceTypes";

const VALID_WORK_MODES: readonly WorkMode[] = ["Learning", "Practice", "Research", "Build", "Temporary Chat"];
const VALID_COST_MODES: readonly CostMode[] = ["Cheap Practice", "Normal Learning", "Deep Research"];

export interface CreateSessionApiRequest {
  workspaceId: string;
  title?: string;
  workMode?: WorkMode;
  costMode?: CostMode;
  activeTopic?: string;
}

export interface ListSessionsQuery {
  workspaceId: string;
}

export interface SessionApiResponse {
  id: string;
  workspaceId: string;
  title?: string;
  workMode: WorkMode;
  costMode: CostMode;
  activeTopic?: string;
  status: "active";
  startedAt: string;
  lastActiveAt: string;
}

export type CreateSessionValidationResult =
  | { ok: true; input: CreateSessionApiRequest }
  | { ok: false; error: string };

export type ListSessionsValidationResult =
  | { ok: true; input: ListSessionsQuery }
  | { ok: false; error: string };

export function parseCreateSessionRequest(body: unknown): CreateSessionValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;
  const workspaceId = asTrimmedString(raw.workspaceId);

  if (!workspaceId) {
    return { ok: false, error: "workspaceId is required and must be a non-empty string." };
  }

  if (raw.title !== undefined && typeof raw.title !== "string") {
    return { ok: false, error: "title must be a string." };
  }

  if (raw.workMode !== undefined && !isWorkMode(raw.workMode)) {
    return { ok: false, error: "workMode is invalid." };
  }

  if (raw.costMode !== undefined && !isCostMode(raw.costMode)) {
    return { ok: false, error: "costMode is invalid." };
  }

  if (raw.activeTopic !== undefined && typeof raw.activeTopic !== "string") {
    return { ok: false, error: "activeTopic must be a string." };
  }

  const title = asTrimmedString(raw.title);
  const activeTopic = asTrimmedString(raw.activeTopic);

  return {
    ok: true,
    input: {
      workspaceId,
      title,
      workMode: raw.workMode as WorkMode | undefined,
      costMode: raw.costMode as CostMode | undefined,
      activeTopic,
    },
  };
}

const SESSION_TITLE_MAX_LENGTH = 120;

export interface RenameSessionApiRequest {
  title: string;
  workspaceId: string;
}

export type RenameSessionValidationResult =
  | { ok: true; input: RenameSessionApiRequest }
  | { ok: false; error: string };

export function parseRenameSessionRequest(body: unknown): RenameSessionValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  const workspaceId = asTrimmedString(raw.workspaceId);
  if (!workspaceId) {
    return { ok: false, error: "workspaceId is required." };
  }

  if (typeof raw.title !== "string") {
    return { ok: false, error: "title must be a string." };
  }

  const title = raw.title.trim();
  if (title.length === 0) {
    return { ok: false, error: "title must not be empty." };
  }

  if (title.length > SESSION_TITLE_MAX_LENGTH) {
    return { ok: false, error: `title must not exceed ${SESSION_TITLE_MAX_LENGTH} characters.` };
  }

  return { ok: true, input: { title, workspaceId } };
}

export function parseListSessionsQuery(input: URLSearchParams | string | null | undefined): ListSessionsValidationResult {
  const workspaceId = asTrimmedString(
    typeof input === "string" || input == null
      ? input
      : input.get("workspaceId")
  );

  if (!workspaceId) {
    return { ok: false, error: "workspaceId query parameter is required." };
  }

  return {
    ok: true,
    input: { workspaceId },
  };
}

export function serializeSession(record: SessionRecord): SessionApiResponse {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    workMode: record.workMode,
    costMode: record.costMode,
    activeTopic: record.activeTopic,
    status: "active",
    startedAt: record.startedAt.toISOString(),
    lastActiveAt: record.lastActiveAt.toISOString(),
  };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === "string" && VALID_WORK_MODES.includes(value as WorkMode);
}

function isCostMode(value: unknown): value is CostMode {
  return typeof value === "string" && VALID_COST_MODES.includes(value as CostMode);
}
