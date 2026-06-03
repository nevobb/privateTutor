import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const PROMPT_FILE = resolve(process.cwd(), "src/server/tutor/deepseekGroundingPrompt.ts");
const hasFile = existsSync(PROMPT_FILE);
const describeGrounding = hasFile ? describe : describe.skip;

type GroundingModule = {
  buildGroundingSection: (groundingContext?: {
    mode: "none" | "file_chunks";
    chunks: Array<{
      sourceId: string;
      fileId: string;
      chunkId: string;
      chunkIndex: number;
      text: string;
      tokenEstimate: number;
      sourceLabel?: string;
    }>;
    totalTokenEstimate: number;
    instruction: string;
  }) => string;
};

let mod: GroundingModule;

describeGrounding("buildGroundingSection", () => {
  beforeAll(async () => {
    mod = (await import("../../../src/server/tutor/deepseekGroundingPrompt")) as GroundingModule;
  });

  it("returns empty string when groundingContext is undefined", () => {
    expect(mod.buildGroundingSection(undefined)).toBe("");
  });

  it("returns empty string when mode is none", () => {
    const ctx = {
      mode: "none" as const,
      chunks: [],
      totalTokenEstimate: 0,
      instruction: "test",
    };
    expect(mod.buildGroundingSection(ctx)).toBe("");
  });

  it("returns empty string when chunks array is empty", () => {
    const ctx = {
      mode: "file_chunks" as const,
      chunks: [],
      totalTokenEstimate: 0,
      instruction: "test",
    };
    expect(mod.buildGroundingSection(ctx)).toBe("");
  });

  it("includes SOURCE blocks with sourceId and text when chunks present", () => {
    const ctx = {
      mode: "file_chunks" as const,
      chunks: [
        {
          sourceId: "fileA:chunk1",
          fileId: "fileA",
          chunkId: "chunk1",
          chunkIndex: 0,
          text: "Newton's first law states that an object at rest stays at rest.",
          tokenEstimate: 40,
        },
      ],
      totalTokenEstimate: 40,
      instruction: "Use these excerpts.",
    };

    const section = mod.buildGroundingSection(ctx);
    expect(section).toContain("[SOURCE fileA:chunk1 chunkIndex=0]");
    expect(section).toContain("Newton's first law");
    expect(section).toContain("[/SOURCE]");
  });

  it("includes multiple SOURCE blocks for multiple chunks", () => {
    const ctx = {
      mode: "file_chunks" as const,
      chunks: [
        {
          sourceId: "f1:c1",
          fileId: "f1",
          chunkId: "c1",
          chunkIndex: 0,
          text: "First chunk text",
          tokenEstimate: 20,
        },
        {
          sourceId: "f1:c2",
          fileId: "f1",
          chunkId: "c2",
          chunkIndex: 1,
          text: "Second chunk text",
          tokenEstimate: 20,
        },
      ],
      totalTokenEstimate: 40,
      instruction: "Use these.",
    };

    const section = mod.buildGroundingSection(ctx);
    expect(section).toContain("[SOURCE f1:c1 chunkIndex=0]");
    expect(section).toContain("First chunk text");
    expect(section).toContain("[SOURCE f1:c2 chunkIndex=1]");
    expect(section).toContain("Second chunk text");
  });

  it("includes instruction text directing model not to invent", () => {
    const ctx = {
      mode: "file_chunks" as const,
      chunks: [
        {
          sourceId: "f1:c1",
          fileId: "f1",
          chunkId: "c1",
          chunkIndex: 0,
          text: "Some content",
          tokenEstimate: 20,
        },
      ],
      totalTokenEstimate: 20,
      instruction: "Use these.",
    };

    const section = mod.buildGroundingSection(ctx);
    expect(section).toContain("learning-material");
    expect(section).toContain("inventing");
  });

  it("includes custom grounding instruction text when provided", () => {
    const ctx = {
      mode: "file_chunks" as const,
      chunks: [
        {
          sourceId: "f1:c1",
          fileId: "f1",
          chunkId: "c1",
          chunkIndex: 0,
          text: "Some content",
          tokenEstimate: 20,
        },
      ],
      totalTokenEstimate: 20,
      instruction:
        'Use retrieved chunks as the main evidence. The learner likely refers to section "מקטע ג׳" on page 2.',
    };

    const section = mod.buildGroundingSection(ctx);
    expect(section).toContain('The learner likely refers to section "מקטע ג׳" on page 2.');
  });
});
