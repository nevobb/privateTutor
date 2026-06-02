import { describe, expect, it, vi } from "vitest";
import { createWorkspacePersistenceService } from "../../../src/server/workspaces/workspacePersistenceService";
import type { TutorHandlerResult, TutorRequest } from "../../../src/server/tutor/schemas";

const baseRequest: TutorRequest = {
  userId: "alice",
  workspaceId: "ws-1",
  message: "What is the theme?",
  workMode: "Learning",
  costMode: "Normal Learning",
  activeFileIds: ["f-1"],
};

function tutorOk(content: string): TutorHandlerResult {
  return {
    ok: true,
    response: {
      message: {
        id: "tutor-message-1",
        role: "tutor",
        content,
      },
      internalUpdate: {
        detected_intent: "factual_or_regular",
        confidence: 0.74,
        should_stop_progression: false,
        local_question: {
          detected: false,
          reason: "",
        },
        retrieval: {
          used: false,
          scope: "none",
          source_ids: [],
          why: "test_mock_no_retrieval",
        },
        learner_memory_update: {
          needed: false,
          update_type: "none",
          memory_type: "none",
          content: "",
          confidence: 0,
        },
        knowledge_base_action: {
          needed: false,
          action: "none",
          confidence: 0,
          requires_user_confirmation: false,
        },
        decision_log_entries: [],
      },
    },
  };
}

describe("workspacePersistenceService", () => {
  it("persists workspace/session and message order around tutor handler", async () => {
    const callOrder: string[] = [];
    const service = createWorkspacePersistenceService({
      getWorkspace: vi.fn(async () => {
        callOrder.push("getWorkspace");
        return null;
      }),
      createWorkspaceWithId: vi.fn(async () => {
        callOrder.push("createWorkspaceWithId");
        return {
          id: "ws-1",
          userId: "alice",
          name: "ws-1",
          description: "",
          status: "active" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
      getSession: vi.fn(async () => {
        callOrder.push("getSession");
        return null;
      }),
      createSession: vi.fn(async () => {
        callOrder.push("createSession");
        return {
          id: "session-abc",
          userId: "alice",
          workspaceId: "ws-1",
          title: "Tutor session",
          workMode: "Learning" as const,
          costMode: "Normal Learning" as const,
          status: "active" as const,
          startedAt: new Date(),
          lastActiveAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
        };
      }),
      appendMessage: vi.fn(async (_userId, _workspaceId, _sessionId, input) => {
        callOrder.push(`appendMessage:${input.role}`);
        return {
          id: `message-${input.role}`,
          userId: "alice",
          workspaceId: "ws-1",
          sessionId: "session-abc",
          role: input.role,
          content: input.content,
          sequence: input.role === "user" ? 1 : 2,
          createdAt: new Date(),
          status: "sent" as const,
        };
      }),
      writeDecisionLogEntry: vi.fn(async () => {
        callOrder.push("writeDecisionLogEntry");
        return {
          id: "decision-1",
          userId: "alice",
          decisionType: "mock_alignment" as const,
          title: "Tutor turn persisted",
          decision: "ok",
          rationale: "ok",
          date: new Date().toISOString(),
          createdAt: new Date(),
        };
      }),
    });

    const result = await service.persistTutorExchange({
      user: { userId: "alice" },
      request: baseRequest,
      tutorHandler: async (request) => {
        callOrder.push("tutorHandler");
        expect(request.sessionId).toBe("session-abc");
        return tutorOk("Here is the tutor reply.");
      },
    });

    expect(result.ok).toBe(true);
    expect(callOrder).toEqual([
      "getWorkspace",
      "createWorkspaceWithId",
      "createSession",
      "appendMessage:user",
      "tutorHandler",
      "appendMessage:tutor",
      "writeDecisionLogEntry",
    ]);
  });

  it("uses trusted auth userId even when request body userId differs", async () => {
    const service = createWorkspacePersistenceService({
      getWorkspace: vi.fn(async () => ({
        id: "ws-1",
        userId: "alice",
        name: "ws-1",
        description: "",
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      createWorkspaceWithId: vi.fn(),
      getSession: vi.fn(async () => null),
      createSession: vi.fn(async () => ({
        id: "session-xyz",
        userId: "alice",
        workspaceId: "ws-1",
        title: "Tutor session",
        workMode: "Learning" as const,
        costMode: "Normal Learning" as const,
        status: "active" as const,
        startedAt: new Date(),
        lastActiveAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
      })),
      appendMessage: vi.fn(async () => ({
        id: "message-1",
        role: "user" as const,
        content: "ok",
        userId: "alice",
        workspaceId: "ws-1",
        sessionId: "session-xyz",
        sequence: 1,
        createdAt: new Date(),
        status: "sent" as const,
      })),
      writeDecisionLogEntry: vi.fn(async () => ({
        id: "decision-1",
        userId: "alice",
        decisionType: "mock_alignment" as const,
        title: "x",
        decision: "x",
        rationale: "x",
        date: new Date().toISOString(),
        createdAt: new Date(),
      })),
    });

    const result = await service.persistTutorExchange({
      user: { userId: "alice" },
      request: { ...baseRequest, userId: "bob" },
      tutorHandler: async (request) => {
        expect(request.userId).toBe("alice");
        return tutorOk("ignored");
      },
    });

    expect(result.ok).toBe(true);
  });
});
