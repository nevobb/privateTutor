import { describe, expect, it } from "vitest";
import {
  DeterministicFileChunkEmbeddingProvider,
  buildFileChunkEmbeddingProvider,
} from "../../../src/server/workspaces/fileChunkEmbeddingProvider";
import { GeminiFileChunkEmbeddingProvider } from "../../../src/server/workspaces/geminiFileChunkEmbeddingProvider";

describe("DeterministicFileChunkEmbeddingProvider", () => {
  it("returns stable vectors for same text", async () => {
    const provider = new DeterministicFileChunkEmbeddingProvider({ dimension: 8 });

    const first = await provider.embedText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "file-1",
      chunkId: "chunk_0000",
      text: "Hebrew and English mechanics notes",
    });

    const second = await provider.embedText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "file-1",
      chunkId: "chunk_0000",
      text: "Hebrew and English mechanics notes",
    });

    expect(first.vector).toEqual(second.vector);
    expect(first.sourceTextHash).toBe(second.sourceTextHash);
    expect(first.vector).toHaveLength(8);
  });

  it("returns different vectors for different text", async () => {
    const provider = new DeterministicFileChunkEmbeddingProvider({ dimension: 8 });

    const first = await provider.embedText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "file-1",
      chunkId: "chunk_0000",
      text: "First text",
    });

    const second = await provider.embedText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "file-1",
      chunkId: "chunk_0001",
      text: "Second text",
    });

    expect(first.vector).not.toEqual(second.vector);
    expect(first.sourceTextHash).not.toBe(second.sourceTextHash);
  });

  it("selects Gemini provider only when EMBEDDING_PROVIDER=gemini", () => {
    const deterministic = buildFileChunkEmbeddingProvider({ EMBEDDING_PROVIDER: "deterministic" } as never);
    const gemini = buildFileChunkEmbeddingProvider({ EMBEDDING_PROVIDER: "gemini", GEMINI_API_KEY: "k" } as never);

    expect(deterministic).toBeInstanceOf(DeterministicFileChunkEmbeddingProvider);
    expect(gemini).toBeInstanceOf(GeminiFileChunkEmbeddingProvider);
  });
});
