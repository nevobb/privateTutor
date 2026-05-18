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
    });

    const parsed = parseHarnessJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.message).toBe("Short tutor response");
    expect(parsed?.intent).toBe("guidance_only");
    expect(parsed?.memoryUpdateType).toBe("requires_approval");
  });

  it("returns null for invalid JSON", () => {
    expect(parseHarnessJson("not json")).toBeNull();
  });

  it("provides safe temporary defaults", () => {
    const classification = defaultClassification(true);
    expect(classification.intent).toBe("temporary_chat");
    expect(classification.memoryUpdate.updateType).toBe("none");
  });
});
