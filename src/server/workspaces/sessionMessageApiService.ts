import { getMockTutorResponse as defaultGetMockTutorResponse } from "../../lib/tutor";
import type { AuthenticatedUser } from "../auth/authTypes";
import {
  appendMessage as defaultAppendMessage,
  listSessionMessages as defaultListSessionMessages,
} from "./messageRepository";
import type { PostMessageApiResponse, PostMessageRequest } from "./sessionMessageApiSchemas";
import { serializeMessage } from "./sessionMessageApiSchemas";
import { getSession as defaultGetSession } from "./sessionRepository";
import { getWorkspace as defaultGetWorkspace } from "./workspaceRepository";
import type { MessageRecord } from "./workspaceTypes";

export interface SessionMessageApiService {
  listMessagesForUser(
    user: AuthenticatedUser | string,
    workspaceId: string,
    sessionId: string
  ): Promise<MessageRecord[]>;

  sendMessageForUser(
    user: AuthenticatedUser | string,
    sessionId: string,
    input: PostMessageRequest
  ): Promise<PostMessageApiResponse>;
}

interface Repositories {
  getWorkspace: typeof defaultGetWorkspace;
  getSession: typeof defaultGetSession;
  listSessionMessages: typeof defaultListSessionMessages;
  appendMessage: typeof defaultAppendMessage;
  getMockTutorResponse: typeof defaultGetMockTutorResponse;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace: defaultGetWorkspace,
    getSession: defaultGetSession,
    listSessionMessages: defaultListSessionMessages,
    appendMessage: defaultAppendMessage,
    getMockTutorResponse: defaultGetMockTutorResponse,
  };
}

export function createSessionMessageApiService(
  repositories: Repositories = defaultRepositories()
): SessionMessageApiService {
  return {
    async listMessagesForUser(user, workspaceId, sessionId) {
      const userId = resolveTrustedUserId(user);

      const workspace = await repositories.getWorkspace(userId, workspaceId);
      if (!workspace) throw new Error("Workspace not found.");

      const session = await repositories.getSession(userId, workspaceId, sessionId);
      if (!session) throw new Error("Session not found.");

      return repositories.listSessionMessages(userId, workspaceId, sessionId);
    },

    async sendMessageForUser(user, sessionId, input) {
      const userId = resolveTrustedUserId(user);

      const workspace = await repositories.getWorkspace(userId, input.workspaceId);
      if (!workspace) throw new Error("Workspace not found.");

      const session = await repositories.getSession(userId, input.workspaceId, sessionId);
      if (!session) throw new Error("Session not found.");

      const userRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "user",
        content: input.userMessage,
      });

      const tutorResponse = await repositories.getMockTutorResponse(
        input.userMessage,
        input.workMode,
        input.costMode
      );

      const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "tutor",
        content: tutorResponse.message.content,
        citations: tutorResponse.message.citations,
      });

      return {
        userMessage: serializeMessage(userRecord),
        assistantMessage: serializeMessage(assistantRecord),
        internalUpdate: tutorResponse.internalUpdate,
      };
    },
  };
}

export const sessionMessageApiService: SessionMessageApiService = createSessionMessageApiService();

function resolveTrustedUserId(user: AuthenticatedUser | string): string {
  return typeof user === "string" ? user : user.userId;
}
