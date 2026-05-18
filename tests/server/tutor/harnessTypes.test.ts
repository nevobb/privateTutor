import { describe, expect, it } from "vitest";
import { defaultClassification, parseHarnessJson } from "../../../src/server/tutor/harnessTypes";

describe("harnessTypes", () => {
  it("parses a valid harness JSON payload", () => {
    const raw = JSON.stringify({
      message: "Short tutor response",
      intent: "guidance_only",
      confidence: 0.91,
      shouldStopProgression: true,
      localQuestionDetected: true,
      localQuestionReason: "Needs local context",
      memoryUpdateNeeded: true,
      memoryUpdateType: "requires_approval",
      memoryType: "preference",
      memoryContent: "Prefers hints",
      memoryConfidence: 0.72,
      needs_retrieval: true,
      retrieval_scope: "topic",
      max_chunks: 4,
      max_tokens: 1400,
      should_ask_clarification_first: false,
    });

    const parsed = parseHarnessJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.message).toBe("Short tutor response");
    expect(parsed?.intent).toBe("guidance_only");
    expect(parsed?.memoryUpdateType).toBe("requires_approval");
    expect(parsed?.retrievalDecision).toEqual({
      needs_retrieval: true,
      retrieval_scope: "topic",
      max_chunks: 4,
      max_tokens: 1400,
      should_ask_clarification_first: false,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseHarnessJson("not json")).toBeNull();
  });

  it("provides safe temporary defaults", () => {
    const classification = defaultClassification(true);
    expect(classification.intent).toBe("temporary_chat");
    expect(classification.memoryUpdate.updateType).toBe("none");
  });

  it("falls back retrieval decision when retrieval fields are missing or invalid", () => {
    const raw = JSON.stringify({
      message: "Short tutor response",
      intent: "factual_or_regular",
      confidence: 0.8,
      shouldStopProgression: false,
      localQuestionDetected: false,
      localQuestionReason: "",
      memoryUpdateNeeded: false,
      memoryUpdateType: "none",
      memoryType: "none",
      memoryContent: "",
      memoryConfidence: 0,
      needs_retrieval: "yes",
      retrieval_scope: "invalid_scope",
      max_chunks: -1,
      max_tokens: "a lot",
      should_ask_clarification_first: "no",
    });

    const parsed = parseHarnessJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.retrievalDecision).toBeNull();
  });
});
