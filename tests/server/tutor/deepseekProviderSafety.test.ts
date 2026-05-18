import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveTutorProvider } from "../../../src/server/tutor/providerRegistry";
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

describe("DeepSeek provider safety behavior", () => {
  it("falls back to mock provider when DEEPSEEK_API_KEY is missing", () => {
    delete process.env.DEEPSEEK_API_KEY;
    const provider = getActiveTutorProvider();
    expect(provider.name).toBe("mock");
  });

  it("throws a bounded error on upstream non-ok response", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "upstream failure" }), { status: 502 })
      )
    );

    const provider = new DeepSeekTutorProvider();

    await expect(
      provider.call({
        userId: "u1",
        workspaceId: "ws1",
        message: "hello",
        workMode: "Learning",
        costMode: "Normal Learning",
      })
    ).rejects.toThrow(/DeepSeek API error 502/);
  });

  it("propagates timeout/network failure as an exception", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));

    const provider = new DeepSeekTutorProvider();

    await expect(
      provider.call({
        userId: "u1",
        workspaceId: "ws1",
        message: "hello",
        workMode: "Practice",
        costMode: "Cheap Practice",
      })
    ).rejects.toThrow(/network timeout/);
  });
});
