import type { AuthenticatedUser } from "../auth/authTypes";
import { createSession, listSessions, softDeleteSession, updateSession } from "./sessionRepository";
import { getWorkspace } from "./workspaceRepository";
import type { CreateSessionApiRequest, DeleteSessionApiRequest, RenameSessionApiRequest } from "./sessionApiSchemas";
import type { SessionRecord } from "./workspaceTypes";

export interface SessionApiService {
  createSessionForUser(user: AuthenticatedUser | string, input: CreateSessionApiRequest): Promise<SessionRecord>;
  listSessionsForUser(user: AuthenticatedUser | string, workspaceId: string): Promise<SessionRecord[]>;
  renameSessionForUser(
    user: AuthenticatedUser | string,
    sessionId: string,
    input: RenameSessionApiRequest
  ): Promise<SessionRecord | null>;
  softDeleteSessionForUser(
    user: AuthenticatedUser | string,
    sessionId: string,
    input: DeleteSessionApiRequest
  ): Promise<SessionRecord | null>;
}

interface SessionApiRepositories {
  getWorkspace: typeof getWorkspace;
  createSession: typeof createSession;
  listSessions: typeof listSessions;
  updateSession: typeof updateSession;
  softDeleteSession: typeof softDeleteSession;
}

function defaultRepositories(): SessionApiRepositories {
  return {
    getWorkspace,
    createSession,
    listSessions,
    updateSession,
    softDeleteSession,
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

    async renameSessionForUser(user, sessionId, input) {
      const trustedUserId = resolveTrustedUserId(user);
      const workspace = await repositories.getWorkspace(trustedUserId, input.workspaceId);

      if (!workspace) {
        throw new Error("Workspace not found.");
      }

      return repositories.updateSession(trustedUserId, input.workspaceId, sessionId, {
        title: input.title,
      });
    },

    async softDeleteSessionForUser(user, sessionId, input) {
      const trustedUserId = resolveTrustedUserId(user);
      const workspace = await repositories.getWorkspace(trustedUserId, input.workspaceId);

      if (!workspace) {
        throw new Error("Workspace not found.");
      }

      return repositories.softDeleteSession(trustedUserId, input.workspaceId, sessionId);
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
