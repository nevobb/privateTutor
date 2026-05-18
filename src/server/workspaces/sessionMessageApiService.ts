import { getMockTutorResponse as defaultGetMockTutorResponse } from "../../lib/tutor";
import { getActiveTutorProvider } from "../tutor/providerRegistry";
import type { ConversationTurn } from "../tutor/schemas";
import type { AuthenticatedUser } from "../auth/authTypes";
import {
  appendMessage as defaultAppendMessage,
  listSessionMessages as defaultListSessionMessages,
} from "./messageRepository";
import type { PostMessageApiResponse, PostMessageRequest } from "./sessionMessageApiSchemas";
import { serializeMessage } from "./sessionMessageApiSchemas";
import { getSession as defaultGetSession } from "./sessionRepository";
import { getWorkspace as defaultGetWorkspace } from "./workspaceRepository";
import { writeDecisionLogEntry as defaultWriteDecisionLogEntry } from "./decisionLogRepository";
import type { MessageRecord } from "./workspaceTypes";
import type { DecisionLogEvent } from "../tutor/schemas";
import type { DecisionLogEntry } from "../../types";

// Maximum number of previous turns to include as context for the AI provider.
// Each "turn" is one message (user or tutor). 20 = 10 exchanges.
const MAX_HISTORY_TURNS = 20;

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
  writeDecisionLogEntry: typeof defaultWriteDecisionLogEntry;
  getMockTutorResponse: (
    message: string,
    workMode: Parameters<typeof defaultGetMockTutorResponse>[1],
    costMode: Parameters<typeof defaultGetMockTutorResponse>[2],
    conversationHistory?: ConversationTurn[]
  ) => ReturnType<typeof defaultGetMockTutorResponse>;
}

function defaultGetTutorResponse(
  message: string,
  workMode: Parameters<typeof defaultGetMockTutorResponse>[1],
  costMode: Parameters<typeof defaultGetMockTutorResponse>[2],
  conversationHistory?: ConversationTurn[]
): ReturnType<typeof defaultGetMockTutorResponse> {
  const provider = getActiveTutorProvider();
  return provider.call({
    userId: "session-service",
    workspaceId: "session-service",
    message,
    workMode,
    costMode,
    conversationHistory,
  }) as ReturnType<typeof defaultGetMockTutorResponse>;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace: defaultGetWorkspace,
    getSession: defaultGetSession,
    listSessionMessages: defaultListSessionMessages,
    appendMessage: defaultAppendMessage,
    writeDecisionLogEntry: defaultWriteDecisionLogEntry,
    getMockTutorResponse: defaultGetTutorResponse,
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

      // Fetch existing messages BEFORE appending the current user message,
      // so history only includes previous turns.
      const existingMessages = await repositories.listSessionMessages(userId, input.workspaceId, sessionId);
      const conversationHistory: ConversationTurn[] = existingMessages
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      const userRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "user",
        content: input.userMessage,
      });

      const tutorResponse = await repositories.getMockTutorResponse(
        input.userMessage,
        input.workMode,
        input.costMode,
        conversationHistory
      );

      const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "tutor",
        content: tutorResponse.message.content,
        citations: tutorResponse.message.citations,
      });

      await persistDecisionLogEvents(
        repositories,
        userId,
        input.workspaceId,
        sessionId,
        tutorResponse.decisionLogEvents
      );

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

async function persistDecisionLogEvents(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  sessionId: string,
  events: DecisionLogEvent[] | undefined
): Promise<void> {
  if (!events || events.length === 0) return;

  await Promise.all(
    events.map((event) =>
      repositories.writeDecisionLogEntry(userId, {
        decisionType: mapDecisionType(event.type),
        title: event.title,
        decision: event.detail,
        rationale: `Event type: ${event.type}`,
        workspaceId,
        sessionId,
      })
    )
  );
}

function mapDecisionType(eventType: DecisionLogEvent["type"]): DecisionLogEntry["decisionType"] {
  switch (eventType) {
    case "memory_not_written":
      return "memory_not_written";
    case "retrieval_scope":
      return "retrieval_scope";
    case "mock_provider":
    case "deepseek_provider":
    case "harness_classification":
    case "harness_fallback":
    case "request_validation":
    case "response_validation":
    default:
      return "model_provider";
  }
}
