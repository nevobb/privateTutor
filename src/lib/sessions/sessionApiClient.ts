import type { CreateSessionInput, SessionApiSession } from "./sessionApiTypes";

interface ErrorBody {
  error?: string;
}

interface ListSessionsResponse {
  sessions: SessionApiSession[];
}

interface CreateSessionResponse {
  session: SessionApiSession;
}

export class SessionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "SessionApiError";
  }
}

export async function fetchSessions(
  authToken: string,
  workspaceId: string
): Promise<SessionApiSession[]> {
  const token = requireAuthToken(authToken);
  const normalizedWorkspaceId = requireWorkspaceId(workspaceId);

  const res = await fetch(`/api/sessions?workspaceId=${encodeURIComponent(normalizedWorkspaceId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw await createSessionApiError(res, "שגיאה בטעינת המפגשים.");
  }

  const body = await res.json() as ListSessionsResponse;
  return body.sessions;
}

export async function createSession(
  authToken: string,
  input: CreateSessionInput
): Promise<SessionApiSession> {
  const token = requireAuthToken(authToken);
  const normalizedWorkspaceId = requireWorkspaceId(input.workspaceId);

  const payload: CreateSessionInput = {
    workspaceId: normalizedWorkspaceId,
    title: normalizeOptionalString(input.title),
    workMode: input.workMode,
    costMode: input.costMode,
    activeTopic: normalizeOptionalString(input.activeTopic),
  };

  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw await createSessionApiError(res, "יצירת מפגש נכשלה.");
  }

  const body = await res.json() as CreateSessionResponse;
  return body.session;
}

function requireAuthToken(authToken: string): string {
  if (typeof authToken !== "string" || authToken.trim().length === 0) {
    throw new SessionApiError("Unauthorized.", 401);
  }

  return authToken.trim();
}

function requireWorkspaceId(workspaceId: string): string {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new SessionApiError("workspaceId is required.", 400);
  }

  return workspaceId.trim();
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function createSessionApiError(response: Response, fallbackMessage: string): Promise<SessionApiError> {
  const body = await response.json().catch(() => ({})) as ErrorBody;
  return new SessionApiError(body.error ?? fallbackMessage, response.status);
}
