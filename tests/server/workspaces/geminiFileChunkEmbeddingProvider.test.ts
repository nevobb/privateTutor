import { describe, expect, it, vi } from "vitest";
import {
  GeminiEmbeddingProviderError,
  GeminiFileChunkEmbeddingProvider,
} from "../../../src/server/workspaces/geminiFileChunkEmbeddingProvider";

function okResponse(values: number[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ embedding: { values } }),
  } as Response;
}

describe("GeminiFileChunkEmbeddingProvider", () => {
  it("uses gemini-embedding-001 and document task for chunks", async () => {
    const fetchMock = vi.fn(async () => okResponse([0.1, 0.2, 0.3]));
    const provider = new GeminiFileChunkEmbeddingProvider("key-123", fetchMock as never);

    const result = await provider.embedText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "file-1",
      chunkId: "chunk-1",
      text: "doc text",
      embeddingPurpose: "document",
    });

    expect(result.model).toBe("gemini-embedding-001");
    expect(result.provider).toBe("gemini");
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.taskType).toBe("RETRIEVAL_DOCUMENT");
  });

  it("uses question-answering task for query embeddings", async () => {
    const fetchMock = vi.fn(async () => okResponse([0.2, 0.3]));
    const provider = new GeminiFileChunkEmbeddingProvider("key-123", fetchMock as never);

    await provider.embedText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "semantic-query",
      chunkId: "semantic-query",
      text: "what is force",
      embeddingPurpose: "query",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.taskType).toBe("QUESTION_ANSWERING");
  });

  it("fails with controlled error when key is missing", async () => {
    const provider = new GeminiFileChunkEmbeddingProvider("");
    await expect(
      provider.embedText({
        userId: "alice",
        workspaceId: "ws-1",
        fileId: "file-1",
        chunkId: "chunk-1",
        text: "doc text",
      })
    ).rejects.toBeInstanceOf(GeminiEmbeddingProviderError);
  });

  it("fails on malformed provider response", async () => {
    const fetchMock = vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => ({ embedding: { values: [] } }) }) as Response
    );
    const provider = new GeminiFileChunkEmbeddingProvider("key-123", fetchMock as never);

    await expect(
      provider.embedText({
        userId: "alice",
        workspaceId: "ws-1",
        fileId: "file-1",
        chunkId: "chunk-1",
        text: "doc text",
      })
    ).rejects.toBeInstanceOf(GeminiEmbeddingProviderError);
  });
});
