import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepSeekTutorProvider } from "../../../src/server/tutor/deepseekTutorProvider";

const ORIGINAL_KEY = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = ORIGINAL_KEY;
  }
  vi.restoreAllMocks();
});

describe("DeepSeek harness mapping", () => {
  it("maps valid harness JSON into tutor message + internalUpdate", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    message: "Use chain rule here.",
                    intent: "guidance_only",
                    confidence: 0.9,
                    shouldStopProgression: true,
                    localQuestionDetected: false,
                    localQuestionReason: "",
                    memoryUpdateNeeded: true,
                    memoryUpdateType: "small_auto",
                    memoryType: "preference",
                    memoryContent: "Wants hints first",
                    memoryConfidence: 0.7,
                  }),
                },
              },
            ],
          }),
          { status: 200 }
        )
      )
    );

    const provider = new DeepSeekTutorProvider();
    const response = await provider.call({
      userId: "u1",
      workspaceId: "w1",
      message: "help",
      workMode: "Practice",
      costMode: "Cheap Practice",
    });

    expect(response.message.content).toBe("Use chain rule here.");
    expect(response.internalUpdate.detected_intent).toBe("guidance_only");
    expect(response.internalUpdate.should_stop_progression).toBe(true);
    expect(response.internalUpdate.learner_memory_update.update_type).toBe("small_auto");
    expect(response.decisionLogEvents?.some((e) => e.type === "harness_classification")).toBe(true);
  });

  it("falls back when model returns non-JSON content", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Plain tutor text without JSON." } }],
          }),
          { status: 200 }
        )
      )
    );

    const provider = new DeepSeekTutorProvider();
    const response = await provider.call({
      userId: "u1",
      workspaceId: "w1",
      message: "help",
      workMode: "Learning",
      costMode: "Normal Learning",
    });

    expect(response.message.content).toBe("Plain tutor text without JSON.");
    expect(response.internalUpdate.detected_intent).toBe("factual_or_regular");
    expect(response.decisionLogEvents?.some((e) => e.type === "harness_fallback")).toBe(true);
  });
});
