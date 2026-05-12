import type { AuthenticatedUser } from "../auth/authTypes";
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
} from "./workspaceRepository";
import type { CreateWorkspaceApiRequest } from "./workspaceApiSchemas";
import type { WorkspaceRecord } from "./workspaceTypes";

export interface WorkspaceApiService {
  createWorkspaceForUser(user: AuthenticatedUser, input: CreateWorkspaceApiRequest): Promise<WorkspaceRecord>;
  listWorkspacesForUser(user: AuthenticatedUser): Promise<WorkspaceRecord[]>;
  getWorkspaceForUser(user: AuthenticatedUser, workspaceId: string): Promise<WorkspaceRecord | null>;
}

interface WorkspaceApiRepositories {
  createWorkspace: typeof createWorkspace;
  listWorkspaces: typeof listWorkspaces;
  getWorkspace: typeof getWorkspace;
}

function defaultRepositories(): WorkspaceApiRepositories {
  return { createWorkspace, listWorkspaces, getWorkspace };
}

export function createWorkspaceApiService(
  repositories: WorkspaceApiRepositories = defaultRepositories()
): WorkspaceApiService {
  return {
    async createWorkspaceForUser(user, input) {
      return repositories.createWorkspace(user.userId, input);
    },

    async listWorkspacesForUser(user) {
      return repositories.listWorkspaces(user.userId);
    },

    async getWorkspaceForUser(user, workspaceId) {
      return repositories.getWorkspace(user.userId, workspaceId);
    },
  };
}

export const workspaceApiService: WorkspaceApiService = createWorkspaceApiService();
