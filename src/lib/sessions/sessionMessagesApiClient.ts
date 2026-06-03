import type { TutorMessage } from "../../types";
import type { FetchMessagesApiResponse, SendMessageApiResponse, SendMessageInput } from "./sessionMessagesApiTypes";

const REQUEST_TIMEOUT_MS = 25000;

export class SessionMessagesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "SessionMessagesApiError";
  }
}

export async function fetchSessionMessages(
  authToken: string,
  workspaceId: string,
  sessionId: string
): Promise<TutorMessage[]> {
  const token = requireAuthToken(authToken);
  const normalizedWorkspaceId = requireString(workspaceId, "workspaceId");
  const normalizedSessionId = requireString(sessionId, "sessionId");

  const url = `/api/sessions/${encodeURIComponent(normalizedSessionId)}/messages?workspaceId=${encodeURIComponent(normalizedWorkspaceId)}`;
  const res = await runMessagesRequest(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await createApiError(res, "שגיאה בטעינת השיחה.");
  }

  const body = (await res.json()) as FetchMessagesApiResponse;
  return body.messages;
}

export async function sendSessionMessage(
  authToken: string,
  input: SendMessageInput
): Promise<SendMessageApiResponse> {
  const token = requireAuthToken(authToken);
  const normalizedSessionId = requireString(input.sessionId, "sessionId");

  const payload = {
    workspaceId: input.workspaceId,
    userMessage: input.userMessage,
    workMode: input.workMode,
    costMode: input.costMode,
    attachedFileIds: input.attachedFileIds,
  };

  const res = await runMessagesRequest(`/api/sessions/${encodeURIComponent(normalizedSessionId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw await createApiError(res, "שגיאה בשליחת ההודעה.");
  }

  return (await res.json()) as SendMessageApiResponse;
}

function requireAuthToken(authToken: string): string {
  if (typeof authToken !== "string" || authToken.trim().length === 0) {
    throw new SessionMessagesApiError("Unauthorized.", 401);
  }
  return authToken.trim();
}

function requireString(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SessionMessagesApiError(`${name} is required.`, 400);
  }
  return value.trim();
}

async function createApiError(response: Response, fallback: string): Promise<SessionMessagesApiError> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return new SessionMessagesApiError(body.error ?? fallback, response.status);
}

async function runMessagesRequest(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new SessionMessagesApiError("שירות ההודעות לא הגיב בזמן. נסה שוב.", 503);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
