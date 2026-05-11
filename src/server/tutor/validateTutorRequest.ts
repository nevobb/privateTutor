import { CostMode, WorkMode } from "../../types";
import { isCostMode, isRecord, isStringArray, isWorkMode, TutorRequest } from "./schemas";

export interface TutorRequestValidationResult {
  ok: boolean;
  request?: TutorRequest;
  errors: string[];
}

export function validateTutorRequest(input: unknown): TutorRequestValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const errors: string[] = [];

  if (typeof input.userId !== "string" || input.userId.trim().length === 0) {
    errors.push("Missing userId.");
  }

  if (typeof input.workspaceId !== "string" || input.workspaceId.trim().length === 0) {
    errors.push("Missing workspaceId.");
  }

  if (typeof input.message !== "string" || input.message.trim().length === 0) {
    errors.push("Message must be a non-empty string.");
  }

  if (!isWorkMode(input.workMode)) {
    errors.push("Invalid workMode.");
  }

  if (!isCostMode(input.costMode)) {
    errors.push("Invalid costMode.");
  }

  if (input.sessionId !== undefined && typeof input.sessionId !== "string") {
    errors.push("sessionId must be a string when present.");
  }

  if (input.activeFileIds !== undefined && !isStringArray(input.activeFileIds)) {
    errors.push("activeFileIds must be a string array when present.");
  }

  if (input.temporary !== undefined && typeof input.temporary !== "boolean") {
    errors.push("temporary must be a boolean when present.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    request: {
      userId: input.userId as string,
      workspaceId: input.workspaceId as string,
      sessionId: input.sessionId as string | undefined,
      message: (input.message as string).trim(),
      workMode: input.workMode as WorkMode,
      costMode: input.costMode as CostMode,
      activeFileIds: input.activeFileIds as string[] | undefined,
      temporary: input.temporary as boolean | undefined,
    },
  };
}
