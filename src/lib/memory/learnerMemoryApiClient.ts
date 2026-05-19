import type { LearnerMemoryListResponse, LearnerMemoryObservationItem } from "./learnerMemoryApiTypes";
import type { MemoryObservationType } from "../../types";

async function parseJson<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in (payload as Record<string, unknown>)
        ? String((payload as Record<string, unknown>).error)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchLearnerMemory(
  getToken: () => Promise<string | null>,
  workspaceId?: string
): Promise<LearnerMemoryObservationItem[]> {
  const token = await getToken();
  if (!token) throw new Error("Authentication required.");

  const url = workspaceId ? `/api/learner-memory?workspaceId=${encodeURIComponent(workspaceId)}` : "/api/learner-memory";
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await parseJson<LearnerMemoryListResponse>(response);
  return Array.isArray(payload.observations) ? payload.observations : [];
}

export async function patchLearnerMemory(
  getToken: () => Promise<string | null>,
  observationId: string,
  input:
    | { action: "approve" | "reject" }
    | { action: "edit"; content: string; type?: MemoryObservationType }
): Promise<LearnerMemoryObservationItem> {
  const token = await getToken();
  if (!token) throw new Error("Authentication required.");

  const response = await fetch(`/api/learner-memory/${encodeURIComponent(observationId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  return parseJson<LearnerMemoryObservationItem>(response);
}

export async function deleteLearnerMemory(
  getToken: () => Promise<string | null>,
  observationId: string
): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error("Authentication required.");

  const response = await fetch(`/api/learner-memory/${encodeURIComponent(observationId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  await parseJson<{ ok: boolean }>(response);
}
