import { computeEmbeddingSourceTextHash } from "./fileChunkEmbeddingHash";
import type { FileChunkEmbeddingInput, FileChunkEmbeddingProvider, FileChunkEmbeddingResult } from "./fileChunkEmbeddingProvider";

const GEMINI_MODEL = "gemini-embedding-001";

export class GeminiEmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiEmbeddingProviderError";
  }
}

export class GeminiFileChunkEmbeddingProvider implements FileChunkEmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async embedText(input: FileChunkEmbeddingInput): Promise<FileChunkEmbeddingResult> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new GeminiEmbeddingProviderError("GEMINI_API_KEY is required for Gemini embedding provider.");
    }

    const normalized = input.text.trim();
    const taskType = input.embeddingPurpose === "query" ? "QUESTION_ANSWERING" : "RETRIEVAL_DOCUMENT";

    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: { parts: [{ text: normalized }] },
          taskType,
        }),
      }
    );

    if (!response.ok) {
      throw new GeminiEmbeddingProviderError(`Gemini embeddings request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      embedding?: {
        values?: number[];
      };
    };

    const vector = data.embedding?.values;
    if (!Array.isArray(vector) || vector.length === 0 || vector.some((v) => typeof v !== "number")) {
      throw new GeminiEmbeddingProviderError("Gemini embeddings response is missing numeric values.");
    }

    return {
      vector,
      provider: "gemini",
      model: GEMINI_MODEL,
      dimension: vector.length,
      sourceTextHash: computeEmbeddingSourceTextHash(normalized),
    };
  }
}
