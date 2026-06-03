import type { CostMode, TutorInternalUpdate, TutorMessage, WorkMode } from "../../types";
import type { MessageRecord } from "./workspaceTypes";

const VALID_WORK_MODES: readonly WorkMode[] = ["Learning", "Practice", "Research", "Build", "Temporary Chat"];
const VALID_COST_MODES: readonly CostMode[] = ["Cheap Practice", "Normal Learning", "Deep Research"];
const MAX_ATTACHED_FILE_IDS = 5;

export interface PostMessageRequest {
  workspaceId: string;
  userMessage: string;
  workMode: WorkMode;
  costMode: CostMode;
  attachedFileIds?: string[];
}

export interface GetMessagesQuery {
  workspaceId: string;
}

export interface MessageApiResponse {
  id: string;
  role: "user" | "tutor";
  content: string;
  citations?: TutorMessage["citations"];
  attachedFileIds?: string[];
}

export interface PostMessageApiResponse {
  userMessage: MessageApiResponse;
  assistantMessage: MessageApiResponse;
  internalUpdate: TutorInternalUpdate;
}

export type PostMessageValidationResult =
  | { ok: true; input: PostMessageRequest }
  | { ok: false; error: string };

export type GetMessagesValidationResult =
  | { ok: true; input: GetMessagesQuery }
  | { ok: false; error: string };

export function parsePostMessageRequest(body: unknown): PostMessageValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  const workspaceId = asTrimmedString(raw.workspaceId);
  if (!workspaceId) {
    return { ok: false, error: "workspaceId is required and must be a non-empty string." };
  }

  const userMessage = asTrimmedString(raw.userMessage);
  if (!userMessage) {
    return { ok: false, error: "userMessage is required and must be a non-empty string." };
  }

  if (!isWorkMode(raw.workMode)) {
    return { ok: false, error: "workMode is invalid." };
  }

  if (!isCostMode(raw.costMode)) {
    return { ok: false, error: "costMode is invalid." };
  }

  const attachedFileIds = parseAttachedFileIds(raw.attachedFileIds);
  if (!attachedFileIds.ok) {
    return { ok: false, error: attachedFileIds.error };
  }

  return {
    ok: true,
    input: {
      workspaceId,
      userMessage,
      workMode: raw.workMode as WorkMode,
      costMode: raw.costMode as CostMode,
      attachedFileIds: attachedFileIds.value,
    },
  };
}

export function parseGetMessagesQuery(searchParams: URLSearchParams): GetMessagesValidationResult {
  const workspaceId = asTrimmedString(searchParams.get("workspaceId"));
  if (!workspaceId) {
    return { ok: false, error: "workspaceId query parameter is required." };
  }
  return { ok: true, input: { workspaceId } };
}

export function serializeMessage(record: MessageRecord): MessageApiResponse {
  return {
    id: record.id,
    role: record.role,
    content: record.content,
    citations: record.citations,
    attachedFileIds: record.attachedFileIds,
  };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === "string" && VALID_WORK_MODES.includes(value as WorkMode);
}

function isCostMode(value: unknown): value is CostMode {
  return typeof value === "string" && VALID_COST_MODES.includes(value as CostMode);
}

function parseAttachedFileIds(
  value: unknown
): { ok: true; value: string[] | undefined } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "attachedFileIds must be an array of non-empty strings." };
  }

  if (value.length === 0) {
    return { ok: true, value: undefined };
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") {
      return { ok: false, error: "attachedFileIds must contain only strings." };
    }

    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: "attachedFileIds cannot contain empty file IDs." };
    }

    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }

  if (normalized.length > MAX_ATTACHED_FILE_IDS) {
    return {
      ok: false,
      error: `attachedFileIds cannot contain more than ${MAX_ATTACHED_FILE_IDS} file IDs.`,
    };
  }

  return { ok: true, value: normalized };
}
