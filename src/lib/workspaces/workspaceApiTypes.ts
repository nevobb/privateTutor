export interface WorkspaceListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  path?: string[];
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
  lastSessionId?: string;
  lastActivityAt?: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
}
