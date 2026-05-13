import { describe, expect, it } from "vitest";
import { handleTutorRequest } from "../../src/server/tutor/handleTutorRequest";
import { TutorRequest } from "../../src/server/tutor/schemas";

const baseRequest: TutorRequest = {
  userId: "user-1",
  workspaceId: "ws-1",
  sessionId: "session-1",
  message: "What is the theme?",
  workMode: "Learning",
  costMode: "Normal Learning",
  activeFileIds: ["f-1"],
};

async function expectOkResponse(request: TutorRequest) {
  const result = await handleTutorRequest(request);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful tutor handler response.");
  return result.response;
}

describe("tutor backend handler", () => {
  it("returns a valid structured response for Learning / Normal Learning", async () => {
    const response = await expectOkResponse(baseRequest);

    expect(response.message.role).toBe("tutor");
    expect(response.message.content).toContain("מצב עבודה: Learning");
    expect(typeof response.internalUpdate.detected_intent).toBe("string");
    expect(typeof response.internalUpdate.retrieval.used).toBe("boolean");
    expect(typeof response.internalUpdate.learner_memory_update.needed).toBe("boolean");
    expect(response.decisionLogEvents?.[0].type).toBe("mock_provider");
  });

  it("preserves hint-only behavior", async () => {
    const response = await expectOkResponse({
      ...baseRequest,
      message: "I need a hint, not the full solution",
      workMode: "Practice",
    });

    expect(response.message.content).toContain("ללא פתרון מלא");
    expect(response.message.content).not.toContain("התשובה הסופית");
    expect(response.internalUpdate.detected_intent).toBe("guidance_only");
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
  });

  it("preserves local question stop behavior", async () => {
    const response = await expectOkResponse({
      ...baseRequest,
      message: "למה המספר חשוב כאן?",
    });

    expect(response.message.content).toContain("אני עוצר כאן");
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.local_question.detected).toBe(true);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
  });

  it("keeps Cheap Practice source-light", async () => {
    const response = await expectOkResponse({
      ...baseRequest,
      costMode: "Cheap Practice",
    });

    expect(response.message.citations).toBeUndefined();
    expect(response.internalUpdate.retrieval.used).toBe(false);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
  });

  it("returns mock citations in Research mode", async () => {
    const response = await expectOkResponse({
      ...baseRequest,
      workMode: "Research",
    });

    expect(response.message.citations?.length).toBeGreaterThan(0);
    expect(response.internalUpdate.retrieval.used).toBe(true);
    expect(response.internalUpdate.retrieval.scope).toBe("topic");
  });

  it("preserves Temporary Chat no-memory behavior", async () => {
    const response = await expectOkResponse({
      ...baseRequest,
      workMode: "Temporary Chat",
      temporary: true,
    });

    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
    expect(response.decisionLogEvents?.some((event) => event.type === "memory_not_written")).toBe(true);
  });

  it("never reports web search usage from the mock provider", async () => {
    const learning = await expectOkResponse(baseRequest);
    const research = await expectOkResponse({ ...baseRequest, workMode: "Research", costMode: "Deep Research" });

    expect(learning.internalUpdate.retrieval.scope).toBe("none");
    expect(learning.internalUpdate.retrieval.used).toBe(false);
    expect(research.internalUpdate.retrieval.scope).toBe("workspace");
    expect(research.internalUpdate.retrieval.used).toBe(true);
  });
});
