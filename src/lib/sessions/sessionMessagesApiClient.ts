import type { TutorMessage } from "../../types";
import type { FetchMessagesApiResponse, SendMessageApiResponse, SendMessageInput } from "./sessionMessagesApiTypes";

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
  const res = await fetch(url, {
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
  };

  const res = await fetch(`/api/sessions/${encodeURIComponent(normalizedSessionId)}/messages`, {
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
