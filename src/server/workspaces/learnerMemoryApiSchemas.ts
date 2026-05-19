import type { MemoryObservationType } from "../../types";
import type { LearnerMemoryObservationRecord } from "./learnerMemoryRepository";

const VALID_TYPES: MemoryObservationType[] = [
  "preference",
  "difficulty",
  "correction",
  "explanation_pattern",
  "pacing",
  "behavior_rule",
];

export interface LearnerMemoryObservationApiItem {
  id: string;
  type?: MemoryObservationType;
  scope?: "global" | "workspace" | "topic" | "session";
  content: string;
  confidence: number;
  state: "candidate" | "active" | "tentative" | "superseded" | "archived" | "deleted";
  source: "conversation" | "user-correction" | "behavior-test" | "manual" | "user_explicit" | "model_inferred" | "repeated_pattern";
  workspaceId?: string;
  requiresApproval?: boolean;
  timestamp: string;
  updatedAt: string;
}

export interface LearnerMemoryListApiResponse {
  observations: LearnerMemoryObservationApiItem[];
}

export interface LearnerMemoryPatchRequest {
  action: "edit" | "approve" | "reject";
  content?: string;
  type?: MemoryObservationType;
}

export function parseLearnerMemoryPatchRequest(body: unknown):
  | { ok: true; input: LearnerMemoryPatchRequest }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;
  if (raw.action !== "edit" && raw.action !== "approve" && raw.action !== "reject") {
    return { ok: false, error: "action must be one of: edit, approve, reject." };
  }

  if (raw.action === "edit") {
    if (typeof raw.content !== "string" || raw.content.trim().length === 0) {
      return { ok: false, error: "content is required for edit action." };
    }
    if (raw.type !== undefined && !VALID_TYPES.includes(raw.type as MemoryObservationType)) {
      return { ok: false, error: "type is invalid." };
    }
  }

  return {
    ok: true,
    input: {
      action: raw.action,
      content: typeof raw.content === "string" ? raw.content.trim() : undefined,
      type: VALID_TYPES.includes(raw.type as MemoryObservationType)
        ? (raw.type as MemoryObservationType)
        : undefined,
    },
  };
}

export function toLearnerMemoryObservationApiItem(
  observation: LearnerMemoryObservationRecord
): LearnerMemoryObservationApiItem {
  return {
    id: observation.id,
    type: observation.type,
    scope: observation.scope,
    content: observation.content ?? observation.observation,
    confidence: observation.confidence,
    state: observation.state,
    source: observation.source,
    workspaceId: observation.workspaceId,
    requiresApproval: observation.requiresApproval,
    timestamp: observation.timestamp.toISOString(),
    updatedAt: observation.updatedAt.toISOString(),
  };
}
