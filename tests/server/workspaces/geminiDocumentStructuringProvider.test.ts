import { describe, expect, it, vi } from "vitest";
import {
  GeminiDocumentStructuringProvider,
  GeminiDocumentStructuringProviderError,
} from "../../../src/server/workspaces/geminiDocumentStructuringProvider";

describe("GeminiDocumentStructuringProvider", () => {
  it("throws when GEMINI_API_KEY is missing", async () => {
    const provider = new GeminiDocumentStructuringProvider("");
    await expect(
      provider.structureDocument({
        userId: "u1",
        workspaceId: "w1",
        fileId: "f1",
        fileName: "test.pdf",
        sourceType: "pdf",
        pages: [{ pageNumber: 1, extractedText: "Question 1", textQuality: "good" }],
      })
    ).rejects.toBeInstanceOf(GeminiDocumentStructuringProviderError);
  });

  it("parses JSON response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      materialType: "assignment",
                      sections: [{ sectionId: "section_0001" }],
                      detectedQuestions: [{ labelRaw: "Question 1", confidence: "high" }],
                      confidence: "medium",
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const provider = new GeminiDocumentStructuringProvider("key", fetchMock as unknown as typeof fetch);
    const result = await provider.structureDocument({
      userId: "u1",
      workspaceId: "w1",
      fileId: "f1",
      fileName: "test.pdf",
      sourceType: "pdf",
      pages: [{ pageNumber: 1, extractedText: "Question 1", textQuality: "good" }],
    });

    expect(result.materialType).toBe("assignment");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails on malformed provider output", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "not-json" }] } }],
        }),
        { status: 200 }
      )
    );

    const provider = new GeminiDocumentStructuringProvider("key", fetchMock as unknown as typeof fetch);
    await expect(
      provider.structureDocument({
        userId: "u1",
        workspaceId: "w1",
        fileId: "f1",
        fileName: "test.pdf",
        sourceType: "pdf",
        pages: [{ pageNumber: 1, extractedText: "Question 1", textQuality: "good" }],
      })
    ).rejects.toBeInstanceOf(GeminiDocumentStructuringProviderError);
  });
});
