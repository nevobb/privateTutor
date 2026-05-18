import { describe, expect, it } from "vitest";
import { getDeepSeekModel } from "../../../src/server/tutor/deepseekConfig";

describe("deepseek model routing by cost mode", () => {
  it("routes Cheap Practice to deepseek-chat", () => {
    expect(getDeepSeekModel("Cheap Practice")).toBe("deepseek-chat");
  });

  it("routes Normal Learning to deepseek-chat", () => {
    expect(getDeepSeekModel("Normal Learning")).toBe("deepseek-chat");
  });

  it("routes Deep Research to deepseek-reasoner", () => {
    expect(getDeepSeekModel("Deep Research")).toBe("deepseek-reasoner");
  });
});
