import { describe, expect, it } from "vitest";
import { getMockTutorResponse } from "../src/lib/tutor";
import { mockAcademicKnowledge, mockLearnerMemory } from "../src/mock/data";

function expectHebrewVisibleMessage(response: Awaited<ReturnType<typeof getMockTutorResponse>>) {
  expect(response.message.content.trim().length).toBeGreaterThan(0);
  expect(response.message.content).toMatch(/[\u0590-\u05FF]/);
}

describe("Tutor Behavior Regressions (internalUpdate semantics)", () => {
  it("T001 guidance only does not solve", async () => {
    const response = await getMockTutorResponse(
      "תן לי רק כיוון לשאלה הזאת, אל תפתור",
      "Learning",
      "Normal Learning"
    );

    expect(response.internalUpdate.detected_intent).toBe("guidance_only");
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.retrieval.used).toBe(false);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
    expectHebrewVisibleMessage(response);
  });

  it("T002 local or personal question stops locally", async () => {
    const response = await getMockTutorResponse("רגע, למה בכלל מותר המעבר הזה?", "Learning", "Normal Learning");

    expect(response.internalUpdate.local_question.detected).toBe(true);
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.retrieval.used).toBe(false);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
    expectHebrewVisibleMessage(response);
  });

  it("T003 regular learning / simple fact avoids retrieval", async () => {
    const response = await getMockTutorResponse("מה הנגזרת של sin(x)?", "Learning", "Normal Learning");

    expect(response.internalUpdate.detected_intent).toBe("factual_or_regular");
    expect(response.internalUpdate.should_stop_progression).toBe(false);
    expect(response.internalUpdate.retrieval.used).toBe(false);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
    expectHebrewVisibleMessage(response);
  });

  it("T004 user correction proposes correction memory update", async () => {
    const response = await getMockTutorResponse(
      "לא, זה לא שייך לפיזיקה 2. תשייך את זה לחדו״א 2",
      "Learning",
      "Normal Learning"
    );

    expect(response.internalUpdate.detected_intent).toBe("user_correction");
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.learner_memory_update.needed).toBe(true);
    expect(["requires_approval", "small_auto"]).toContain(response.internalUpdate.learner_memory_update.update_type);
    expect(response.internalUpdate.learner_memory_update.memory_type).toBe("correction");
    expectHebrewVisibleMessage(response);
  });

  it("T005 user preference proposes preference memory update", async () => {
    const response = await getMockTutorResponse("אני מעדיף הסברים קצרים וברורים", "Learning", "Normal Learning");

    expect(response.internalUpdate.detected_intent).toBe("user_preference");
    expect(response.internalUpdate.learner_memory_update.needed).toBe(true);
    expect(response.internalUpdate.learner_memory_update.memory_type).toBe("preference");
    expect(response.internalUpdate.learner_memory_update.confidence).toBeGreaterThan(0);
    expectHebrewVisibleMessage(response);
  });

  it("T006 Temporary Chat avoids permanent memory writes", async () => {
    const response = await getMockTutorResponse(
      "שאלה זמנית: תסביר לי בקצרה מה זה eigenvalue",
      "Temporary Chat",
      "Normal Learning"
    );

    expect(response.internalUpdate.detected_intent).toBe("temporary_chat");
    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
    expect(response.internalUpdate.learner_memory_update.update_type).toBe("none");
    expect(response.internalUpdate.retrieval.used).toBe(false);
    expectHebrewVisibleMessage(response);
  });

  it("T007 Research mode uses retrieval", async () => {
    const response = await getMockTutorResponse("What is the theme?", "Research", "Normal Learning");

    expect(response.internalUpdate.detected_intent).toBe("research_request");
    expect(response.internalUpdate.retrieval.used).toBe(true);
    expect(response.internalUpdate.retrieval.scope).toBe("topic");
    expect(response.internalUpdate.retrieval.source_ids.length).toBeGreaterThan(0);
    expect(response.message.citations?.length).toBeGreaterThan(0);
  });

  it("T008 Deep Research broadens retrieval scope", async () => {
    const response = await getMockTutorResponse("Theme analysis", "Research", "Deep Research");

    expect(response.internalUpdate.detected_intent).toBe("research_request");
    expect(response.internalUpdate.retrieval.used).toBe(true);
    expect(response.internalUpdate.retrieval.scope).toBe("workspace");
  });

  it("T009 research freshness cue uses web scope", async () => {
    const response = await getMockTutorResponse(
      "מה העדכון האחרון? תבדוק מה חדש ב-Gemini File Search",
      "Research",
      "Normal Learning"
    );

    expect(response.internalUpdate.retrieval.used).toBe(true);
    expect(response.internalUpdate.retrieval.scope).toBe("web");
  });

  it("T010 Cheap Practice stays source-light", async () => {
    const response = await getMockTutorResponse("Theme", "Learning", "Cheap Practice");

    expect(response.internalUpdate.retrieval.used).toBe(false);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
    expect(response.message.citations).toBeUndefined();
  });

  it("T011 memory and academic knowledge remain separate", () => {
    expect(mockLearnerMemory.observations[0]).toHaveProperty("id");
    expect(mockLearnerMemory.observations[0]).toHaveProperty("confidence");
    expect(mockLearnerMemory.observations[0]).toHaveProperty("state");
    expect(mockAcademicKnowledge).toHaveProperty("sourceId");
    expect(mockAcademicKnowledge).toHaveProperty("sourceType");
    expect(mockAcademicKnowledge).not.toHaveProperty("observation");
  });

  it("T012 internalUpdate shape is complete", async () => {
    const response = await getMockTutorResponse("בדיקה למבנה תשובה", "Learning", "Normal Learning");

    expect(response.internalUpdate).toHaveProperty("detected_intent");
    expect(response.internalUpdate).toHaveProperty("confidence");
    expect(response.internalUpdate).toHaveProperty("should_stop_progression");
    expect(response.internalUpdate).toHaveProperty("local_question");
    expect(response.internalUpdate).toHaveProperty("retrieval");
    expect(response.internalUpdate).toHaveProperty("learner_memory_update");
    expect(response.internalUpdate).toHaveProperty("knowledge_base_action");
    expect(response.internalUpdate).toHaveProperty("decision_log_entries");
  });

  it("T013 Hebrew RTL sanity for visible response", async () => {
    const response = await getMockTutorResponse("רק כיוון", "Practice", "Normal Learning");

    expectHebrewVisibleMessage(response);
  });
});
