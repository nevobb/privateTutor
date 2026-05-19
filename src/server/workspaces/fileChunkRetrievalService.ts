import type { FileChunkRecord, UploadedFileRecord } from "./workspaceTypes";
import { listUploadedFiles as defaultListUploadedFiles } from "./uploadedFileRepository";
import { listFileChunks as defaultListFileChunks } from "./fileChunkRepository";

export type FileChunkRetrievalInput = {
  userId: string;
  workspaceId: string;
  query: string;
  maxChunks: number;
  maxTokens: number;
};

export type RetrievedFileChunk = {
  chunkId: string;
  fileId: string;
  workspaceId: string;
  text: string;
  chunkIndex: number;
  tokenEstimate: number;
  score: number;
  sourceLabel: string;
};

export type FileChunkRetrievalResult = {
  chunks: RetrievedFileChunk[];
  eligibleFileCount: number;
};

interface RetrievalDeps {
  listUploadedFiles: (userId: string, workspaceId: string) => Promise<UploadedFileRecord[]>;
  listFileChunks: (userId: string, workspaceId: string, fileId: string) => Promise<FileChunkRecord[]>;
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

export async function retrieveRelevantFileChunks(
  input: FileChunkRetrievalInput,
  deps: RetrievalDeps = {
    listUploadedFiles: defaultListUploadedFiles,
    listFileChunks: defaultListFileChunks,
  }
): Promise<FileChunkRetrievalResult> {
  const { userId, workspaceId, query, maxChunks, maxTokens } = input;

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

  const queryTokens = tokenize(query);

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

  const scored: RetrievedFileChunk[] = allPairs
    .map(({ file, chunk }) => ({
      chunkId: chunk.chunkId,
      fileId: file.id,
      workspaceId,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      tokenEstimate: chunk.tokenEstimate,
      score: scoreChunk(queryTokens, chunk.text),
      sourceLabel: file.name,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunkIndex - b.chunkIndex;
    });

  const result: RetrievedFileChunk[] = [];
  let remainingTokens = maxTokens;
  for (const chunk of scored) {
    if (result.length >= maxChunks) break;
    if (chunk.tokenEstimate > remainingTokens) break;
    result.push(chunk);
    remainingTokens -= chunk.tokenEstimate;
  }

  return { chunks: result, eligibleFileCount: eligible.length };
}
