import type { WorkspaceListItem, CreateWorkspaceInput } from "./workspaceApiTypes";

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

export async function fetchWorkspaces(authToken: string): Promise<WorkspaceListItem[]> {
  const res = await fetch("/api/workspaces", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new WorkspaceApiError(body.error ?? "שגיאה בטעינת המרחבים.", res.status);
  }

  const data = await res.json() as { workspaces: WorkspaceListItem[] };
  return data.workspaces;
}

export async function createWorkspace(
  authToken: string,
  input: CreateWorkspaceInput
): Promise<WorkspaceListItem> {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new WorkspaceApiError(body.error ?? "יצירת מרחב נכשלה.", res.status);
  }

  return await res.json() as WorkspaceListItem;
}
