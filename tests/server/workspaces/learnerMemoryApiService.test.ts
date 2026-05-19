import { describe, expect, it, vi } from "vitest";
import { createLearnerMemoryApiService } from "../../../src/server/workspaces/learnerMemoryApiService";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";

const user: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const now = new Date("2026-05-20T10:00:00.000Z");

function makeRepos() {
  const created: Array<Record<string, unknown>> = [];
  return {
    listLearnerMemoryObservations: vi.fn(async () => []),
    getLearnerMemoryObservation: vi.fn(async () => null),
    createLearnerMemoryObservation: vi.fn(async (_userId: string, input: Record<string, unknown>) => {
      const record = {
        id: "mem-1",
        userId: "alice",
        observation: String(input.content),
        timestamp: now,
        confidence: Number(input.confidence ?? 0),
        state: input.state,
        source: input.source,
        type: input.type,
        scope: input.scope,
        content: String(input.content),
        workspaceId: input.workspaceId,
        requiresApproval: Boolean(input.requiresApproval),
        updatedAt: now,
      };
      created.push(record);
      return record as never;
    }),
    updateLearnerMemoryObservation: vi.fn(async () => null),
    deleteLearnerMemoryObservation: vi.fn(async () => true),
    writeDecisionLogEntry: vi.fn(async () => ({ id: "d1" })),
    created,
  };
}

describe("learnerMemoryApiService.processMemoryCandidate", () => {
  it("auto-saves high-confidence small updates", async () => {
    const repos = makeRepos();
    const service = createLearnerMemoryApiService(repos as never);

    await service.processMemoryCandidate({
      user,
      workspaceId: "ws-1",
      userMessage: "I prefer hints first",
      temporaryChat: false,
      internalUpdate: {
        detected_intent: "user_preference",
        confidence: 0.9,
        should_stop_progression: false,
        local_question: { detected: false, reason: "" },
        retrieval: { used: false, scope: "none", source_ids: [], why: "" },
        learner_memory_update: {
          needed: true,
          update_type: "small_auto",
          memory_type: "preference",
          content: "User prefers hints first",
          confidence: 0.92,
        },
        knowledge_base_action: { needed: false, action: "none", confidence: 0, requires_user_confirmation: false },
        decision_log_entries: [],
      },
    });

    expect(repos.createLearnerMemoryObservation).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ state: "active", requiresApproval: false, type: "preference" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "memory_write", workspaceId: "ws-1" })
    );
  });

  it("requires approval for medium confidence", async () => {
    const repos = makeRepos();
    const service = createLearnerMemoryApiService(repos as never);

    await service.processMemoryCandidate({
      user,
      workspaceId: "ws-1",
      userMessage: "This is hard for me",
      temporaryChat: false,
      internalUpdate: {
        detected_intent: "factual_or_regular",
        confidence: 0.7,
        should_stop_progression: false,
        local_question: { detected: false, reason: "" },
        retrieval: { used: false, scope: "none", source_ids: [], why: "" },
        learner_memory_update: {
          needed: true,
          update_type: "requires_approval",
          memory_type: "difficulty",
          content: "User struggles with this topic",
          confidence: 0.63,
        },
        knowledge_base_action: { needed: false, action: "none", confidence: 0, requires_user_confirmation: false },
        decision_log_entries: [],
      },
    });

    expect(repos.createLearnerMemoryObservation).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ state: "tentative", requiresApproval: true, type: "difficulty" })
    );
    expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ decisionType: "memory_not_written", workspaceId: "ws-1" })
    );
  });
});
