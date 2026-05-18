import type {
  FetchDecisionLogApiResponse,
  FetchDecisionLogInput,
  DecisionLogListItem,
} from "./decisionLogApiTypes";

const REQUEST_TIMEOUT_MS = 8000;

export class DecisionLogApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DecisionLogApiError";
  }
}

export async function fetchDecisionLogEntries(
  authToken: string,
  input: FetchDecisionLogInput
): Promise<DecisionLogListItem[]> {
  const token = requireAuthToken(authToken);
  const workspaceId = requireString(input.workspaceId, "workspaceId");
  const sessionId = requireString(input.sessionId, "sessionId");
  const limit = sanitizeLimit(input.limit);

  const query = new URLSearchParams({
    workspaceId,
    sessionId,
    limit: String(limit),
  });
  const res = await runDecisionLogRequest(`/api/decision-log?${query.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await createApiError(res, "שגיאה בטעינת trace החלטות.");
  }

  const body = (await res.json()) as FetchDecisionLogApiResponse;
  return body.entries;
}

function requireAuthToken(authToken: string): string {
  if (typeof authToken !== "string" || authToken.trim().length === 0) {
    throw new DecisionLogApiError("Unauthorized.", 401);
  }
  return authToken.trim();
}

function requireString(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DecisionLogApiError(`${name} is required.`, 400);
  }
  return value.trim();
}

function sanitizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new DecisionLogApiError("limit must be an integer between 1 and 100.", 400);
  }
  return limit;
}

async function createApiError(response: Response, fallback: string): Promise<DecisionLogApiError> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return new DecisionLogApiError(body.error ?? fallback, response.status);
}

async function runDecisionLogRequest(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new DecisionLogApiError("שירות ה-trace לא הגיב בזמן. נסה שוב.", 503);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
