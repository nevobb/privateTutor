import { computeEmbeddingSourceTextHash } from "./fileChunkEmbeddingHash";
import { GeminiFileChunkEmbeddingProvider } from "./geminiFileChunkEmbeddingProvider";

export type FileChunkEmbeddingInput = {
  text: string;
  chunkId: string;
  fileId: string;
  workspaceId: string;
  userId: string;
  embeddingPurpose?: "document" | "query";
};

export type FileChunkEmbeddingResult = {
  vector: number[];
  provider: string;
  model: string;
  dimension: number;
  sourceTextHash: string;
};

export interface FileChunkEmbeddingProvider {
  embedText(input: FileChunkEmbeddingInput): Promise<FileChunkEmbeddingResult>;
}

export type DeterministicEmbeddingProviderOptions = {
  dimension?: number;
  providerName?: string;
  modelName?: string;
};

const DEFAULT_DIMENSION = 8;

export class DeterministicFileChunkEmbeddingProvider implements FileChunkEmbeddingProvider {
  private readonly dimension: number;
  private readonly providerName: string;
  private readonly modelName: string;

  constructor(options: DeterministicEmbeddingProviderOptions = {}) {
    this.dimension = Math.max(2, options.dimension ?? DEFAULT_DIMENSION);
    this.providerName = options.providerName ?? "deterministic_mock";
    this.modelName = options.modelName ?? `deterministic-${this.dimension}d-v1`;
  }

  async embedText(input: FileChunkEmbeddingInput): Promise<FileChunkEmbeddingResult> {
    const normalized = input.text.trim();
    const sourceTextHash = computeEmbeddingSourceTextHash(normalized);
    const vector = buildDeterministicVector(normalized, this.dimension);

    return {
      vector,
      provider: this.providerName,
      model: this.modelName,
      dimension: this.dimension,
      sourceTextHash,
    };
  }
}

export const fileChunkEmbeddingProvider: FileChunkEmbeddingProvider =
  buildFileChunkEmbeddingProvider();

export function buildFileChunkEmbeddingProvider(
  env: NodeJS.ProcessEnv = process.env
): FileChunkEmbeddingProvider {
  const mode = (env.EMBEDDING_PROVIDER ?? "deterministic").toLowerCase();
  if (mode === "gemini") {
    return new GeminiFileChunkEmbeddingProvider(env.GEMINI_API_KEY ?? "");
  }
  return new DeterministicFileChunkEmbeddingProvider();
}

function buildDeterministicVector(text: string, dimension: number): number[] {
  const buckets = new Array<number>(dimension).fill(0);
  const normalized = text.length > 0 ? text : "_";

  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    const bucket = i % dimension;
    buckets[bucket] += (code % 127) * (1 + (i % 7));
  }

  const magnitude = Math.sqrt(buckets.reduce((sum, value) => sum + value * value, 0)) || 1;
  return buckets.map((value) => Number((value / magnitude).toFixed(6)));
}
