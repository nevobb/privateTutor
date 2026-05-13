import type { AuthenticatedUser } from "../auth/authTypes";
import { createSession, listSessions } from "./sessionRepository";
import { getWorkspace } from "./workspaceRepository";
import type { CreateSessionApiRequest } from "./sessionApiSchemas";
import type { SessionRecord } from "./workspaceTypes";

export interface SessionApiService {
  createSessionForUser(user: AuthenticatedUser | string, input: CreateSessionApiRequest): Promise<SessionRecord>;
  listSessionsForUser(user: AuthenticatedUser | string, workspaceId: string): Promise<SessionRecord[]>;
}

interface SessionApiRepositories {
  getWorkspace: typeof getWorkspace;
  createSession: typeof createSession;
  listSessions: typeof listSessions;
}

function defaultRepositories(): SessionApiRepositories {
  return {
    getWorkspace,
    createSession,
    listSessions,
  };
}

export function createSessionApiService(
  repositories: SessionApiRepositories = defaultRepositories()
): SessionApiService {
  return {
    async createSessionForUser(user, input) {
      const trustedUserId = resolveTrustedUserId(user);
      const workspace = await repositories.getWorkspace(trustedUserId, input.workspaceId);

      if (!workspace) {
        throw new Error("Workspace not found.");
      }

      return repositories.createSession(trustedUserId, input.workspaceId, {
        title: input.title,
        workMode: input.workMode,
        costMode: input.costMode,
        activeTopic: input.activeTopic,
        status: "active",
      });
    },

    async listSessionsForUser(user, workspaceId) {
      const trustedUserId = resolveTrustedUserId(user);
      const workspace = await repositories.getWorkspace(trustedUserId, workspaceId);

      if (!workspace) {
        throw new Error("Workspace not found.");
      }

      return repositories.listSessions(trustedUserId, workspaceId);
    },
  };
}

export const sessionApiService: SessionApiService = createSessionApiService();

function resolveTrustedUserId(user: AuthenticatedUser | string): string {
  if (typeof user === "string") {
    return user;
  }

  return user.userId;
}
