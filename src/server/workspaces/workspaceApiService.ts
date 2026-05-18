import type { AuthenticatedUser } from "../auth/authTypes";
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  moveWorkspace,
} from "./workspaceRepository";
import type {
  CreateWorkspaceApiRequest,
  MoveWorkspaceApiRequest,
} from "./workspaceApiSchemas";
import type { WorkspaceRecord } from "./workspaceTypes";

export interface WorkspaceApiService {
  createWorkspaceForUser(user: AuthenticatedUser, input: CreateWorkspaceApiRequest): Promise<WorkspaceRecord>;
  listWorkspacesForUser(user: AuthenticatedUser): Promise<WorkspaceRecord[]>;
  getWorkspaceForUser(user: AuthenticatedUser, workspaceId: string): Promise<WorkspaceRecord | null>;
  moveWorkspaceForUser(
    user: AuthenticatedUser,
    workspaceId: string,
    input: MoveWorkspaceApiRequest
  ): Promise<WorkspaceRecord | null>;
}

interface WorkspaceApiRepositories {
  createWorkspace: typeof createWorkspace;
  listWorkspaces: typeof listWorkspaces;
  getWorkspace: typeof getWorkspace;
  moveWorkspace: typeof moveWorkspace;
}

function defaultRepositories(): WorkspaceApiRepositories {
  return { createWorkspace, listWorkspaces, getWorkspace, moveWorkspace };
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

    async moveWorkspaceForUser(user, workspaceId, input) {
      return repositories.moveWorkspace(user.userId, workspaceId, input);
    },
  };
}

export const workspaceApiService: WorkspaceApiService = createWorkspaceApiService();
