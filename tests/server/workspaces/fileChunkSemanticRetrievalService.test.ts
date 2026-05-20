import { describe, expect, it, vi } from "vitest";
import {
  cosineSimilarity,
  retrieveRelevantFileChunksSemantically,
} from "../../../src/server/workspaces/fileChunkSemanticRetrievalService";
import { computeEmbeddingSourceTextHash } from "../../../src/server/workspaces/fileChunkEmbeddingHash";

function chunk(chunkId: string, text: string, chunkIndex = 0, tokenEstimate = 50) {
  return {
    chunkId,
    userId: "alice",
    workspaceId: "ws-1",
    fileId: "file-1",
    text,
    chunkIndex,
    charStart: 0,
    charEnd: text.length,
    tokenEstimate,
    source: "extracted_text" as const,
    embeddingStatus: "completed" as const,
    embeddingSourceTextHash: undefined,
    createdAt: new Date(),
  };
}

describe("cosineSimilarity", () => {
  it("returns 0 for empty or mismatched vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it("returns deterministic similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
});

describe("retrieveRelevantFileChunksSemantically", () => {
  it("ranks by semantic score and tie-breaks by chunkIndex/chunkId", async () => {
    const deps = {
      embeddingProvider: {
        embedText: vi.fn(async () => ({
          vector: [1, 0],
          provider: "deterministic_mock",
          model: "deterministic-2d-v1",
          dimension: 2,
          sourceTextHash: "q",
        })),
      },
      getCurrentChunkEmbedding: vi
        .fn()
        .mockResolvedValueOnce({ embeddingSourceTextHash: computeEmbeddingSourceTextHash("x"), vector: [0.8, 0], embeddingStatus: "completed" })
        .mockResolvedValueOnce({ embeddingSourceTextHash: computeEmbeddingSourceTextHash("y"), vector: [0.8, 0], embeddingStatus: "completed" })
        .mockResolvedValueOnce({ embeddingSourceTextHash: computeEmbeddingSourceTextHash("z"), vector: [0.2, 0], embeddingStatus: "completed" }),
    };

    const result = await retrieveRelevantFileChunksSemantically(
      {
        userId: "alice",
        workspaceId: "ws-1",
        query: "force",
        maxChunks: 3,
        maxTokens: 1000,
        candidates: [
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c2", "x", 1, 50) },
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c1", "y", 0, 50) },
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c3", "z", 2, 50) },
        ],
      },
      deps as never
    );

    expect(result.chunks.map((c) => c.chunkId)).toEqual(["c1", "c2", "c3"]);
    expect(deps.embeddingProvider.embedText).toHaveBeenCalledWith(
      expect.objectContaining({ embeddingPurpose: "query" })
    );
  });

  it("respects maxChunks and maxTokens", async () => {
    const deps = {
      embeddingProvider: {
        embedText: vi.fn(async () => ({ vector: [1, 0], provider: "d", model: "m", dimension: 2, sourceTextHash: "q" })),
      },
      getCurrentChunkEmbedding: vi
        .fn()
        .mockResolvedValue({ embeddingSourceTextHash: computeEmbeddingSourceTextHash("x"), vector: [1, 0], embeddingStatus: "completed" }),
    };

    const result = await retrieveRelevantFileChunksSemantically(
      {
        userId: "alice",
        workspaceId: "ws-1",
        query: "force",
        maxChunks: 1,
        maxTokens: 80,
        candidates: [
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c1", "x", 0, 70) },
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c2", "y", 1, 70) },
        ],
      },
      deps as never
    );

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].chunkId).toBe("c1");
  });

  it("ignores stale/missing embeddings", async () => {
    const deps = {
      embeddingProvider: {
        embedText: vi.fn(async () => ({ vector: [1, 0], provider: "d", model: "m", dimension: 2, sourceTextHash: "q" })),
      },
      getCurrentChunkEmbedding: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ embeddingSourceTextHash: "other", vector: [1, 0], embeddingStatus: "completed" }),
    };

    const result = await retrieveRelevantFileChunksSemantically(
      {
        userId: "alice",
        workspaceId: "ws-1",
        query: "force",
        maxChunks: 2,
        maxTokens: 100,
        candidates: [
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c1", "x", 0, 50) },
          { fileId: "file-1", sourceLabel: "A", chunk: chunk("c2", "y", 1, 50) },
        ],
      },
      deps as never
    );

    expect(result.chunks).toEqual([]);
    expect(result.attempted).toBe(true);
  });
});
