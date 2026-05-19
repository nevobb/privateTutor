import { describe, expect, it } from "vitest";
import { chunkExtractedText } from "../../../src/server/workspaces/fileChunker";

describe("chunkExtractedText", () => {
  it("returns one chunk for short text", () => {
    const result = chunkExtractedText({ text: "Hello world" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ chunkIndex: 0, charStart: 0 });
  });

  it("returns multiple chunks for long text", () => {
    const longText = "a".repeat(2800);
    const result = chunkExtractedText({ text: longText, maxChars: 1200, overlapChars: 150 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].chunkIndex).toBe(0);
    expect(result[1].chunkIndex).toBe(1);
  });

  it("keeps stable ranges and token estimate", () => {
    const text = "First paragraph.\n\nSecond paragraph.\nThird paragraph.".repeat(80);
    const result = chunkExtractedText({ text, maxChars: 400, overlapChars: 50 });
    for (let i = 0; i < result.length; i += 1) {
      const chunk = result[i];
      expect(chunk.charEnd).toBeGreaterThan(chunk.charStart);
      expect(chunk.tokenEstimate).toBe(Math.ceil(chunk.text.length / 4));
      if (i > 0) {
        expect(chunk.chunkIndex).toBe(result[i - 1].chunkIndex + 1);
      }
    }
  });

  it("returns empty for empty text", () => {
    const result = chunkExtractedText({ text: "   \n\n  " });
    expect(result).toEqual([]);
  });
});
