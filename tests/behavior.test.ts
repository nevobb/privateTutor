import { describe, it, expect } from 'vitest';
import { getMockTutorResponse } from '../src/lib/tutor';
import { mockAcademicKnowledge, mockDecisionLogEntry, mockLearnerMemory } from '../src/mock/data';

describe('Tutor Behavior Regressions', () => {
  it('does not rush the learner in default learning mode', async () => {
    const response = await getMockTutorResponse("I don't understand the theme.", "Learning", "Normal Learning");
    expect(response.message.content).toContain("מצב עבודה: Learning");
    expect(response.internalUpdate.should_stop_progression).toBe(false);
    expect(response.message.content).not.toContain("ללא פתרון מלא");
  });

  it('does not reveal a full solution when asked for a hint', async () => {
    const response = await getMockTutorResponse("I need a hint, not the full solution", "Practice", "Normal Learning");
    expect(response.message.content).toContain("ללא פתרון מלא");
    expect(response.message.content).not.toContain("התשובה הסופית");
    expect(response.message.content).not.toContain("שלב 1");
    expect(response.internalUpdate.detected_intent).toBe("guidance_only");
    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
  });

  it('answers local why-style questions locally and stops', async () => {
    const response = await getMockTutorResponse("למה המספר חשוב כאן?", "Learning", "Normal Learning");
    expect(response.message.content).toContain("אני עוצר כאן");
    expect(response.message.content).not.toContain("תרגול נוסף");
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.retrieval.scope).toBe("none");
  });

  it('keeps learner memory separate from academic knowledge', () => {
    expect(mockDecisionLogEntry.rationale).toContain("objective factual base");
    expect(mockDecisionLogEntry.decision).toContain("strictly separate entities");
    expect(mockLearnerMemory.observations[0]).toHaveProperty("confidence");
    expect(mockAcademicKnowledge).toHaveProperty("sourceId");
    expect(mockAcademicKnowledge).not.toHaveProperty("observation");
  });

  it('represents the Hebrew RTL assumption through Hebrew tutor copy', async () => {
    const response = await getMockTutorResponse("רק כיוון", "Practice", "Normal Learning");
    expect(response.message.content).toMatch(/[\u0590-\u05FF]/);
  });

  it('keeps Cheap Practice local and source-light', async () => {
    const responseCheap = await getMockTutorResponse("Theme", "Learning", "Cheap Practice");
    expect(responseCheap.message.content).toContain("מצב עלות: Cheap Practice");
    expect(responseCheap.message.citations).toBeUndefined();
    expect(responseCheap.internalUpdate.retrieval.used).toBe(false);
    expect(responseCheap.internalUpdate.retrieval.scope).toBe("none");
  });

  it('returns citations in Research mode without implying web search', async () => {
    const response = await getMockTutorResponse("What is the theme?", "Research", "Normal Learning");
    expect(response.message.content).toContain("מצב מחקר");
    expect(response.message.citations).toBeDefined();
    expect(response.message.citations?.length).toBeGreaterThan(0);
    expect(response.internalUpdate.retrieval.scope).toBe("topic");
    expect(response.internalUpdate.retrieval.used).toBe(true);
  });

  it('changes mock routing by cost and work mode', async () => {
    const responseDeep = await getMockTutorResponse("Theme", "Research", "Deep Research");
    expect(responseDeep.message.content).toContain("מצב עלות: Deep Research");
    expect(responseDeep.internalUpdate.detected_intent).toBe("research_request");
    expect(responseDeep.internalUpdate.retrieval.scope).toBe("workspace");
  });

  it('does not create permanent memory updates in Temporary Chat', async () => {
    const response = await getMockTutorResponse("This is a throwaway question", "Temporary Chat", "Normal Learning");
    expect(response.message.content).toContain("צ'אט זמני");
    expect(response.internalUpdate.learner_memory_update.needed).toBe(false);
  });
});
