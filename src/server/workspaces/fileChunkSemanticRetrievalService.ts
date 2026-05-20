import { fileChunkEmbeddingProvider as defaultEmbeddingProvider } from "./fileChunkEmbeddingProvider";
import { getCurrentChunkEmbedding as defaultGetCurrentChunkEmbedding } from "./fileChunkEmbeddingRepository";
import { computeEmbeddingSourceTextHash } from "./fileChunkEmbeddingHash";
import type { FileChunkRecord } from "./workspaceTypes";

export type SemanticChunkRetrievalInput = {
  userId: string;
  workspaceId: string;
  query: string;
  maxChunks: number;
  maxTokens: number;
  candidates: Array<{
    fileId: string;
    sourceLabel: string;
    chunk: FileChunkRecord;
  }>;
};

export type SemanticRetrievedChunk = {
  chunkId: string;
  fileId: string;
  workspaceId: string;
  text: string;
  chunkIndex: number;
  tokenEstimate: number;
  semanticScore: number;
  keywordScore?: number;
  finalScore: number;
  sourceLabel: string;
  retrievalMethod: "semantic";
};

export type SemanticChunkRetrievalResult = {
  chunks: SemanticRetrievedChunk[];
  attempted: boolean;
};

interface Deps {
  embeddingProvider: typeof defaultEmbeddingProvider;
  getCurrentChunkEmbedding: typeof defaultGetCurrentChunkEmbedding;
}

function defaultDeps(): Deps {
  return {
    embeddingProvider: defaultEmbeddingProvider,
    getCurrentChunkEmbedding: defaultGetCurrentChunkEmbedding,
  };
}

export async function retrieveRelevantFileChunksSemantically(
  input: SemanticChunkRetrievalInput,
  deps: Deps = defaultDeps()
): Promise<SemanticChunkRetrievalResult> {
  if (input.candidates.length === 0) {
    return { attempted: false, chunks: [] };
  }

  const queryEmbedding = await deps.embeddingProvider.embedText({
    userId: input.userId,
    workspaceId: input.workspaceId,
    fileId: "semantic-query",
    chunkId: "semantic-query",
    text: input.query,
    embeddingPurpose: "query",
  });

  const scored: SemanticRetrievedChunk[] = [];

  for (const candidate of input.candidates) {
    const embedding = await deps.getCurrentChunkEmbedding(
      input.userId,
      input.workspaceId,
      candidate.fileId,
      candidate.chunk.chunkId
    );

    if (!embedding || embedding.vector.length === 0) continue;
    if (candidate.chunk.embeddingStatus !== "completed") continue;

    const currentTextHash = computeEmbeddingSourceTextHash(candidate.chunk.text);
    const chunkHash = candidate.chunk.embeddingSourceTextHash;
    if (chunkHash && chunkHash !== currentTextHash) continue;
    if (embedding.embeddingSourceTextHash !== currentTextHash) continue;

    const semanticScore = cosineSimilarity(queryEmbedding.vector, embedding.vector);
    scored.push({
      chunkId: candidate.chunk.chunkId,
      fileId: candidate.fileId,
      workspaceId: input.workspaceId,
      text: candidate.chunk.text,
      chunkIndex: candidate.chunk.chunkIndex,
      tokenEstimate: candidate.chunk.tokenEstimate,
      semanticScore,
      finalScore: semanticScore,
      sourceLabel: candidate.sourceLabel,
      retrievalMethod: "semantic",
    });
  }

  if (scored.length === 0) {
    return { attempted: true, chunks: [] };
  }

  scored.sort((a, b) => {
    if (b.semanticScore !== a.semanticScore) return b.semanticScore - a.semanticScore;
    if (a.chunkIndex !== b.chunkIndex) return a.chunkIndex - b.chunkIndex;
    return a.chunkId.localeCompare(b.chunkId);
  });

  const selected: SemanticRetrievedChunk[] = [];
  let remainingTokens = input.maxTokens;
  for (const chunk of scored) {
    if (selected.length >= input.maxChunks) break;
    if (chunk.tokenEstimate > remainingTokens) break;
    selected.push(chunk);
    remainingTokens -= chunk.tokenEstimate;
  }

  return { attempted: true, chunks: selected };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0;

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }

  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}
