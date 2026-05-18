export function buildHarnessJsonContract(): string {
  return [
    "Return ONLY a valid JSON object (no markdown, no code fences, no extra text).",
    "Required JSON fields:",
    "{",
    '  "message": string,',
    '  "intent": "factual_or_regular" | "guidance_only" | "local_question" | "user_correction" | "user_preference" | "research_request" | "temporary_chat",',
    '  "confidence": number,',
    '  "shouldStopProgression": boolean,',
    '  "localQuestionDetected": boolean,',
    '  "localQuestionReason": string,',
    '  "memoryUpdateNeeded": boolean,',
    '  "memoryUpdateType": "none" | "small_auto" | "requires_approval",',
    '  "memoryType": string,',
    '  "memoryContent": string,',
    '  "memoryConfidence": number,',
    '  "needs_retrieval": boolean,',
    '  "retrieval_scope": "none" | "session" | "topic" | "workspace" | "concept_library" | "global_learner_memory" | "web",',
    '  "max_chunks": number,',
    '  "max_tokens": number,',
    '  "should_ask_clarification_first": boolean',
    "}",
  ].join("\n");
}
