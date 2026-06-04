import type { FileChunkRecord, UploadedFileRecord } from "./workspaceTypes";
import { listUploadedFiles as defaultListUploadedFiles } from "./uploadedFileRepository";
import { listFileChunks as defaultListFileChunks } from "./fileChunkRepository";
import {
  retrieveRelevantFileChunksSemantically,
  type SemanticChunkRetrievalResult,
} from "./fileChunkSemanticRetrievalService";

export type FileChunkRetrievalInput = {
  userId: string;
  workspaceId: string;
  query: string;
  maxChunks: number;
  maxTokens: number;
  /** When provided, retrieval tries these file IDs first before falling back to workspace-wide. */
  prioritizedFileIds?: string[];
};

export type RetrievedFileChunk = {
  chunkId: string;
  fileId: string;
  workspaceId: string;
  text: string;
  chunkIndex: number;
  tokenEstimate: number;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  finalScore?: number;
  sourceLabel: string;
  retrievalMethod?: "semantic" | "keyword_fallback" | "keyword_only" | "structural";
};

export type FileChunkRetrievalResult = {
  chunks: RetrievedFileChunk[];
  eligibleFileCount: number;
};

interface RetrievalDeps {
  listUploadedFiles: (userId: string, workspaceId: string) => Promise<UploadedFileRecord[]>;
  listFileChunks: (userId: string, workspaceId: string, fileId: string) => Promise<FileChunkRecord[]>;
  retrieveSemantically?: typeof retrieveRelevantFileChunksSemantically;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,.!?;:()\[\]{}"'\/\\|@#$%^&*+=<>~`]+/)
      .filter((t) => t.length >= 2)
  );
}

function scoreChunk(queryTokens: Set<string>, chunkText: string): number {
  if (queryTokens.size === 0) return 0;
  const chunkTokens = tokenize(chunkText);
  let matches = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) matches++;
  }
  return matches;
}

function selectByBudget(chunks: RetrievedFileChunk[], maxChunks: number, maxTokens: number): RetrievedFileChunk[] {
  const result: RetrievedFileChunk[] = [];
  let remainingTokens = maxTokens;
  for (const chunk of chunks) {
    if (result.length >= maxChunks) break;
    if (chunk.tokenEstimate > remainingTokens) break;
    result.push(chunk);
    remainingTokens -= chunk.tokenEstimate;
  }
  return result;
}

export async function retrieveRelevantFileChunks(
  input: FileChunkRetrievalInput,
  deps: RetrievalDeps = {
    listUploadedFiles: defaultListUploadedFiles,
    listFileChunks: defaultListFileChunks,
    retrieveSemantically: retrieveRelevantFileChunksSemantically,
  }
): Promise<FileChunkRetrievalResult> {
  const { userId, workspaceId, query, maxChunks, maxTokens, prioritizedFileIds } = input;
  const prioritizedSet =
    prioritizedFileIds && prioritizedFileIds.length > 0 ? new Set(prioritizedFileIds) : null;

  const files = await deps.listUploadedFiles(userId, workspaceId);
  const eligible = files.filter(
    (f) =>
      f.extractionStatus === "completed" &&
      f.chunkingStatus === "completed" &&
      (f.chunkCount ?? 0) > 0
  );

  if (eligible.length === 0) {
    return { chunks: [], eligibleFileCount: 0 };
  }

  const allPairs: Array<{ file: UploadedFileRecord; chunk: FileChunkRecord }> = [];
  await Promise.all(
    eligible.map(async (file) => {
      const chunks = await deps.listFileChunks(userId, workspaceId, file.id);
      for (const chunk of chunks) {
        allPairs.push({ file, chunk });
      }
    })
  );

  if (allPairs.length === 0) {
    return { chunks: [], eligibleFileCount: eligible.length };
  }

  // When prioritized file IDs are present, try them first before falling back
  // to workspace-wide retrieval. This implements C4 attached-file prioritization.
  if (prioritizedSet) {
    const prioritizedPairs = allPairs.filter(({ file }) => prioritizedSet.has(file.id));

    if (prioritizedPairs.length > 0) {
      // Semantic retrieval restricted to prioritized files.
      let semResult: SemanticChunkRetrievalResult = { attempted: false, chunks: [] };
      if (deps.retrieveSemantically) {
        try {
          semResult = await deps.retrieveSemantically({
            userId,
            workspaceId,
            query,
            maxChunks,
            maxTokens,
            candidates: prioritizedPairs.map(({ file, chunk }) => ({
              fileId: file.id,
              sourceLabel: file.name,
              chunk,
            })),
          });
        } catch {
          semResult = { attempted: true, chunks: [] };
        }
      }

      if (semResult.chunks.length > 0) {
        return {
          chunks: semResult.chunks.map((chunk) => ({
            chunkId: chunk.chunkId,
            fileId: chunk.fileId,
            workspaceId: chunk.workspaceId,
            text: chunk.text,
            chunkIndex: chunk.chunkIndex,
            tokenEstimate: chunk.tokenEstimate,
            score: chunk.finalScore,
            semanticScore: chunk.semanticScore,
            keywordScore: chunk.keywordScore,
            finalScore: chunk.finalScore,
            sourceLabel: chunk.sourceLabel,
            retrievalMethod: "semantic",
          })),
          eligibleFileCount: eligible.length,
        };
      }

      // Keyword retrieval restricted to prioritized files.
      const queryTokens = tokenize(query);
      const prioritizedMethod: RetrievedFileChunk["retrievalMethod"] = semResult.attempted
        ? "keyword_fallback"
        : "keyword_only";
      const prioritizedScored: RetrievedFileChunk[] = prioritizedPairs
        .map(({ file, chunk }) => ({
          chunkId: chunk.chunkId,
          fileId: file.id,
          workspaceId,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          tokenEstimate: chunk.tokenEstimate,
          score: scoreChunk(queryTokens, chunk.text),
          keywordScore: scoreChunk(queryTokens, chunk.text),
          finalScore: scoreChunk(queryTokens, chunk.text),
          sourceLabel: file.name,
          retrievalMethod: prioritizedMethod,
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.chunkIndex - b.chunkIndex;
        });

      const prioritizedResult = selectByBudget(prioritizedScored, maxChunks, maxTokens);
      // Strictly restrict search to prioritized files when specified; do not fall back workspace-wide.
      return { chunks: prioritizedResult, eligibleFileCount: eligible.length };
    }
  }

  // Workspace-wide retrieval (existing behavior, unchanged).
  let semanticResult: SemanticChunkRetrievalResult = { attempted: false, chunks: [] };
  if (deps.retrieveSemantically) {
    try {
      semanticResult = await deps.retrieveSemantically({
        userId,
        workspaceId,
        query,
        maxChunks,
        maxTokens,
        candidates: allPairs.map(({ file, chunk }) => ({
          fileId: file.id,
          sourceLabel: file.name,
          chunk,
        })),
      });
    } catch {
      semanticResult = { attempted: true, chunks: [] };
    }
  }

  if (semanticResult.chunks.length > 0) {
    return {
      chunks: semanticResult.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        fileId: chunk.fileId,
        workspaceId: chunk.workspaceId,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        tokenEstimate: chunk.tokenEstimate,
        score: chunk.finalScore,
        semanticScore: chunk.semanticScore,
        keywordScore: chunk.keywordScore,
        finalScore: chunk.finalScore,
        sourceLabel: chunk.sourceLabel,
        retrievalMethod: "semantic",
      })),
      eligibleFileCount: eligible.length,
    };
  }

  const queryTokens = tokenize(query);
  const fallbackMethod: RetrievedFileChunk["retrievalMethod"] = semanticResult.attempted
    ? "keyword_fallback"
    : "keyword_only";
  const scored: RetrievedFileChunk[] = allPairs
    .map(({ file, chunk }) => ({
      chunkId: chunk.chunkId,
      fileId: file.id,
      workspaceId,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      tokenEstimate: chunk.tokenEstimate,
      score: scoreChunk(queryTokens, chunk.text),
      keywordScore: scoreChunk(queryTokens, chunk.text),
      finalScore: scoreChunk(queryTokens, chunk.text),
      sourceLabel: file.name,
      retrievalMethod: fallbackMethod,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunkIndex - b.chunkIndex;
    });

  const result = selectByBudget(scored, maxChunks, maxTokens);
  return { chunks: result, eligibleFileCount: eligible.length };
}
