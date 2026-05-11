import type { AuthenticatedUser } from "../auth/authTypes";
import { handleTutorRequest } from "../tutor/handleTutorRequest";
import type { TutorBoundaryResponse, TutorHandlerResult, TutorRequest } from "../tutor/schemas";
import { appendMessage as appendMessageRepo } from "./messageRepository";
import { createSession, getSession } from "./sessionRepository";
import { createWorkspaceWithId, getWorkspace } from "./workspaceRepository";
import { writeDecisionLogEntry as writeDecisionLogEntryRepo } from "./decisionLogRepository";

export interface PersistTutorExchangeInput {
  user: AuthenticatedUser;
  request: TutorRequest;
  tutorHandler?: (request: TutorRequest) => Promise<TutorHandlerResult>;
}

export interface WorkspacePersistenceService {
  persistTutorExchange(input: PersistTutorExchangeInput): Promise<TutorHandlerResult>;
}

interface WorkspacePersistenceRepositories {
  getWorkspace: typeof getWorkspace;
  createWorkspaceWithId: typeof createWorkspaceWithId;
  getSession: typeof getSession;
  createSession: typeof createSession;
  appendMessage: typeof appendMessageRepo;
  writeDecisionLogEntry: typeof writeDecisionLogEntryRepo;
}

function defaultRepositories(): WorkspacePersistenceRepositories {
  return {
    getWorkspace,
    createWorkspaceWithId,
    getSession,
    createSession,
    appendMessage: appendMessageRepo,
    writeDecisionLogEntry: writeDecisionLogEntryRepo,
  };
}

export function createWorkspacePersistenceService(
  repositories: WorkspacePersistenceRepositories = defaultRepositories()
): WorkspacePersistenceService {
  return {
    async persistTutorExchange(input: PersistTutorExchangeInput): Promise<TutorHandlerResult> {
      const trustedUserId = input.user.userId;

      const workspaceId = input.request.workspaceId;
      const existingWorkspace = await repositories.getWorkspace(trustedUserId, workspaceId);
      if (!existingWorkspace) {
        await repositories.createWorkspaceWithId(trustedUserId, workspaceId, {
          name: workspaceId,
          description: "Auto-created by tutor persistence service.",
        });
      }

      const existingSession = input.request.sessionId
        ? await repositories.getSession(trustedUserId, workspaceId, input.request.sessionId)
        : null;
      const ensuredSession =
        existingSession ??
        (await repositories.createSession(trustedUserId, workspaceId, {
          id: input.request.sessionId,
          title: "Tutor session",
        }));

      await repositories.appendMessage(trustedUserId, workspaceId, ensuredSession.id, {
        role: "user",
        content: input.request.message,
      });

      const request: TutorRequest = {
        ...input.request,
        userId: trustedUserId,
        sessionId: ensuredSession.id,
      };

      const tutorHandler = input.tutorHandler ?? handleTutorRequest;
      const result = await tutorHandler(request);

      if (!result.ok) {
        return result;
      }

      await repositories.appendMessage(trustedUserId, workspaceId, ensuredSession.id, {
        role: "tutor",
        content: result.response.message.content,
        citations: result.response.message.citations,
      });

      await repositories.writeDecisionLogEntry(trustedUserId, {
        decisionType: "mock_alignment",
        title: "Tutor turn persisted",
        decision: "Persisted user and tutor messages in workspace session.",
        rationale: "Keeps transcript order consistent while the tutor provider remains mock-only.",
        workspaceId,
        sessionId: ensuredSession.id,
      });

      return withSessionId(result.response, ensuredSession.id);
    },
  };
}

function withSessionId(response: TutorBoundaryResponse, sessionId: string): TutorHandlerResult {
  return {
    ok: true,
    response: {
      ...response,
      decisionLogEvents: [
        ...(response.decisionLogEvents ?? []),
        {
          type: "mock_provider",
          title: "Tutor turn persisted",
          detail: `workspace persistence stored this turn under session ${sessionId}`,
        },
      ],
    },
  };
}

export const workspacePersistenceService = createWorkspacePersistenceService();
