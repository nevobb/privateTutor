import {
  DeterministicDocumentStructuringProvider,
  type DocumentStructuringProvider,
} from "./documentStructuringProvider";
import { GeminiDocumentStructuringProvider } from "./geminiDocumentStructuringProvider";

export function buildDocumentStructuringProvider(
  env: NodeJS.ProcessEnv = process.env
): DocumentStructuringProvider {
  const mode = (env.DOCUMENT_STRUCTURING_PROVIDER ?? "deterministic").toLowerCase();

  if (mode === "gemini") {
    return new GeminiDocumentStructuringProvider(env.GEMINI_API_KEY ?? "");
  }

  return new DeterministicDocumentStructuringProvider();
}

export const documentStructuringProvider = buildDocumentStructuringProvider();
